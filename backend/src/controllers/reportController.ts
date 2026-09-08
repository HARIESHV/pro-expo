import { Request, Response } from 'express';
import { Report } from '../models/Report';
import { AppError } from '../middleware/errorHandler';
import { ApiResponse } from '../types';
import { hasPermission } from '../config/permissions';
import { reportService } from '../services/reportService';
import { openai, AI_MODEL } from '../config/openai';
import mongoose from 'mongoose';
import PDFDocument from 'pdfkit';
import { Document as WordDocument, Packer, Paragraph, HeadingLevel } from 'docx';
import * as XLSX from 'xlsx';

function csvEscape(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function reportRows(report: any): string[][] {
  const rows: string[][] = [['Section', 'Metric', 'Value']];
  report.content.kpis?.forEach((kpi: any) => rows.push(['KPI', kpi.name, kpi.value]));
  report.content.trends?.forEach((trend: any) => rows.push(['Trend', `${trend.period} - ${trend.metric}`, String(trend.value)]));
  report.content.risks?.forEach((risk: any) => rows.push(['Risk', risk.title, `${risk.severity}: ${risk.status}`]));
  report.content.recommendations?.forEach((recommendation: string) => rows.push(['Recommendation', '', recommendation]));
  return rows;
}

export const reportController = {
  async generateReport(req: Request, res: Response): Promise<void> {
    const { title, type, startDate, endDate, departmentId, sources = [], context = {} } = req.body;
    const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);
    const userRoles = req.user!.roles;

    if (!hasPermission(userRoles, 'reports.generate')) {
      throw new AppError('Report generation is restricted for your role.', 403);
    }

    if (!title || !type || !startDate || !endDate) {
      throw new AppError('Title, type, startDate, and endDate are required', 400);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const report = await Report.create({
      organizationId: orgId,
      createdById: req.user!._id,
      title,
      type,
      status: 'pending',
      parameters: { startDate: start, endDate: end, departmentId, sources, context },
    });

    try {
      // 1. Fetch strict, real report data
      const { aggregatedData, kpis, trends, risks: reportRisks } = await reportService.fetchReportData({
        type,
        orgId,
        start,
        end,
        context,
        sources,
        userId: req.user!._id.toString(),
        roles: userRoles,
      });

      // 2. AI Summarization (with graceful fallback if the AI call fails)
      const prompt = `You are an AI Executive Intelligence Agent. Generate a comprehensive corporate report based on these real database metrics.
      
Report Title: ${title}
Report Type: ${type}
Date Range: ${startDate} to ${endDate}

Facts & Database Metrics:
${JSON.stringify(aggregatedData)}

Please analyze this data and generate a JSON response strictly matching this structure:
{
  "executiveSummary": "A concise executive summary.",
  "aiInsights": ["Insight 1", "Insight 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}`;

      let aiContent: any = {};
      try {
        const aiResponse = await openai.chat.completions.create({
          model: AI_MODEL,
          messages: [
            { role: 'system', content: 'You are an executive advisor writing a board report. Be analytical, professional, and use the exact facts and numbers provided.' },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        });
        aiContent = JSON.parse(aiResponse.choices[0].message.content || '{}');
      } catch (aiErr: any) {
        console.error('[Report] AI summarization failed, using data-derived summary:', aiErr?.message);
        aiContent = {
          executiveSummary:
            `This ${type} report summarizes enterprise activity from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}. ` +
            (kpis.length ? `Key figures include: ${kpis.map((k) => `${k.name}: ${k.value}`).join(', ')}.` : 'No KPI data was available for this period.'),
          aiInsights: kpis.length
            ? [`Data reflects ${kpis[0].name} of ${kpis.find((k) => k.name === 'Total Revenue')?.value || 'n/a'} for the selected period.`]
            : ['No analytical insights could be derived from the available data.'],
          recommendations: [],
        };
      }

      // Update Report with real derived data
      report.status = 'completed';
      report.content = {
        executiveSummary: aiContent.executiveSummary || 'No summary generated.',
        kpis,
        trends,
        risks: reportRisks,
        aiInsights: aiContent.aiInsights || [],
        recommendations: aiContent.recommendations && aiContent.recommendations.length
          ? aiContent.recommendations
          : reportRisks.length
            ? reportRisks.map((r) => `Mitigate ${r.severity} risk: ${r.title}`)
            : [],
        aggregatedData,
      } as any;
      await report.save();

      res.status(201).json({ success: true, data: { report } } as ApiResponse);
    } catch (err: any) {
      report.status = 'failed';
      report.content = { errors: [err.message || 'AI Generation error'] };
      await report.save();
      throw new AppError(`Report generation failed: ${err.message}`, 500);
    }
  },

  async getReports(req: Request, res: Response): Promise<void> {
    const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);
    const filter: Record<string, unknown> = { organizationId: orgId };
    if (!hasPermission(req.user!.roles, 'reports.view_all')) filter.createdById = req.user!._id;
    const reports = await Report.find(filter).populate('createdById', 'firstName lastName email').sort({ createdAt: -1 });
    res.json({ success: true, data: { reports } } as ApiResponse);
  },

  async getReport(req: Request, res: Response): Promise<void> {
    const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);
    const report = await Report.findOne({ _id: req.params.id, organizationId: orgId }).populate('createdById', 'firstName lastName email');
    if (!report) throw new AppError('Report not found', 404);
    
    const creatorId = (report.createdById as any)._id ? (report.createdById as any)._id : report.createdById;
    if (!hasPermission(req.user!.roles, 'reports.view_all') && creatorId.toString() !== req.user!._id.toString()) {
      throw new AppError('Access denied: Unauthorized to view this report', 403);
    }
    res.json({ success: true, data: { report } } as ApiResponse);
  },

  async deleteReport(req: Request, res: Response): Promise<void> {
    const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);
    if (!hasPermission(req.user!.roles, 'reports.delete')) throw new AppError('Access denied: Unauthorized to delete reports', 403);
    const result = await Report.deleteOne({ _id: req.params.id, organizationId: orgId });
    if (result.deletedCount === 0) throw new AppError('Report not found', 404);
    res.json({ success: true, message: 'Report deleted successfully' } as ApiResponse);
  },

  async exportReport(req: Request, res: Response): Promise<void> {
    const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);
    if (!hasPermission(req.user!.roles, 'reports.export')) throw new AppError('Access denied: Unauthorized to export reports', 403);
    const report = await Report.findOne({ _id: req.params.id, organizationId: orgId });
    if (!report) throw new AppError('Report not found', 404);
    const { format } = req.body;
    if (!format || !['pdf', 'excel', 'docx', 'csv', 'json'].includes(format)) throw new AppError('Invalid export format', 400);
    res.json({ success: true, message: `Formatted for ${format}`, data: { reportId: report._id, format, content: report.content } } as ApiResponse);
  },

  async regenerateReport(req: Request, res: Response): Promise<void> {
    // Same logic as generate for simplicity in this overhaul — org-scoped lookup
    const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);
    const existing = await Report.findOne({ _id: req.params.id, organizationId: orgId });
    if (!existing) throw new AppError('Report not found', 404);
    req.body = { ...req.body, ...((existing.parameters as any) || {}) };
    await this.generateReport(req, res);
  },

  async exportPdf(req: Request, res: Response): Promise<void> {
    const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);
    if (!hasPermission(req.user!.roles, 'reports.export')) throw new AppError('Access denied: Unauthorized to export reports', 403);
    const report = await Report.findOne({ _id: req.params.id, organizationId: orgId });
    if (!report) throw new AppError('Report not found', 404);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-${report._id}.pdf"`);
    const document = new PDFDocument({ margin: 48 });
    document.pipe(res);
    document.fontSize(20).text(report.title).moveDown();
    document.fontSize(10).text(`${report.type} report | ${report.parameters.startDate.toLocaleDateString()} - ${report.parameters.endDate.toLocaleDateString()}`).moveDown();
    document.fontSize(13).text('Executive Summary', { underline: true }).moveDown(0.3);
    document.fontSize(10).text(report.content.executiveSummary || 'No summary available.').moveDown();
    document.end();
  },

  async exportExcel(req: Request, res: Response): Promise<void> {
    const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);
    if (!hasPermission(req.user!.roles, 'reports.export')) throw new AppError('Access denied: Unauthorized to export reports', 403);
    const report = await Report.findOne({ _id: req.params.id, organizationId: orgId });
    if (!report) throw new AppError('Report not found', 404);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(reportRows(report)), 'Report');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="report-${report._id}.xlsx"`);
    res.send(buffer);
  },

  async exportDocx(req: Request, res: Response): Promise<void> {
    const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);
    if (!hasPermission(req.user!.roles, 'reports.export')) throw new AppError('Access denied: Unauthorized to export reports', 403);
    const report = await Report.findOne({ _id: req.params.id, organizationId: orgId });
    if (!report) throw new AppError('Report not found', 404);
    const children = [
      new Paragraph({ text: report.title, heading: HeadingLevel.TITLE }),
      new Paragraph({ text: report.content.executiveSummary || 'No summary available.' }),
      ...reportRows(report).slice(1).map(([section, metric, value]) => new Paragraph({ text: `${section}: ${metric}${metric ? ' - ' : ''}${value}`, bullet: { level: 0 } })),
    ];
    const buffer = await Packer.toBuffer(new WordDocument({ sections: [{ children }] }));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="report-${report._id}.docx"`);
    res.send(buffer);
  },

  async exportCsv(req: Request, res: Response): Promise<void> {
    const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);
    if (!hasPermission(req.user!.roles, 'reports.export')) throw new AppError('Access denied: Unauthorized to export reports', 403);
    const report = await Report.findOne({ _id: req.params.id, organizationId: orgId });
    if (!report) throw new AppError('Report not found', 404);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="report-${report._id}.csv"`);
    let csvContent = `Section,Metric,Value\n`;
    reportRows(report).slice(1).forEach(([section, metric, value]) => {
      csvContent += [section, metric, value].map(csvEscape).join(',') + '\n';
    });
    res.send(csvContent);
  }
};
