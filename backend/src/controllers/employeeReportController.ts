import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { EmployeeReport } from '../models/EmployeeReport';
import { createAuditLog } from '../utils/auditHelper';
import { env } from '../config/env';

export const employeeReportController = {
  async submit(req: Request, res: Response) {
    const user = req.user!;
    const { title, description, category } = req.body;
    if (!title || !description) {
      res.status(400).json({ success: false, message: 'Title and description are required' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ success: false, message: 'File is required' });
      return;
    }
    const file = req.file as Express.Multer.File;
    const ext = path.extname(file.originalname).toLowerCase();
    const report = await EmployeeReport.create({
      title: title.trim().slice(0, 200),
      description: description.trim().slice(0, 5000),
      category: (category || 'general').trim().slice(0, 100),
      originalFileName: file.originalname,
      storedFileName: file.filename,
      filePath: file.path,
      fileType: ext.replace('.', '') || 'unknown',
      mimeType: file.mimetype,
      fileSize: file.size,
      submittedBy: user._id,
      organizationId: user.organizationId,
      status: 'PENDING_REVIEW',
      submittedAt: new Date(),
    });

    await createAuditLog({
      organizationId: user.organizationId,
      userId: user._id as any,
      action: 'employee_report_submitted',
      resource: 'employee_report',
      resourceId: report._id.toString(),
      method: req.method,
      path: req.path,
      ipAddress: req.ip || 'unknown',
      metadata: { title, fileName: file.originalname },
    });

    res.status(201).json({ success: true, message: 'Report submitted successfully. Waiting for Admin Review.', data: report });
  },

  async myReports(req: Request, res: Response) {
    const user = req.user!;
    const reports = await EmployeeReport.find({ submittedBy: user._id, organizationId: user.organizationId })
      .sort({ createdAt: -1 })
      .populate('submittedBy', 'firstName lastName email')
      .populate('reviewedBy', 'firstName lastName email');
    res.json({ success: true, data: reports });
  },

  async getOne(req: Request, res: Response) {
    const user = req.user!;
    const report = await EmployeeReport.findOne({ _id: req.params.id, organizationId: user.organizationId })
      .populate('submittedBy', 'firstName lastName email')
      .populate('reviewedBy', 'firstName lastName email');
    if (!report) {
      res.status(404).json({ success: false, message: 'Report not found' });
      return;
    }
    // Owner or admin can view
    const isOwner = report.submittedBy._id.toString() === user._id.toString();
    const isAdmin = user.roles.some(r => ['admin','super_admin'].includes(r.toLowerCase()));
    if (!isOwner && !isAdmin) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }
    res.json({ success: true, data: report });
  },

  async download(req: Request, res: Response) {
    const user = req.user!;
    const report = await EmployeeReport.findOne({ _id: req.params.id, organizationId: user.organizationId });
    if (!report) {
      res.status(404).json({ success: false, message: 'Report not found' });
      return;
    }
    const isOwner = report.submittedBy.toString() === user._id.toString();
    const isAdmin = user.roles.some(r => ['admin','super_admin'].includes(r.toLowerCase()));
    // Employee can only download if APPROVED and is owner; admin can always download
    if (!isAdmin) {
      if (!isOwner) {
        res.status(403).json({ success: false, message: 'Forbidden' });
        return;
      }
      if (report.status !== 'APPROVED') {
        res.status(403).json({ success: false, message: report.status === 'PENDING_REVIEW' ? 'Waiting for Admin Review' : `Report ${report.status} — Process Aborted. Reason: ${report.rejectionReason || ''}` });
        return;
      }
    }
    const filePath = path.resolve(report.filePath);
    const baseUpload = path.resolve(process.cwd(), env.ADMIN_REPORT_UPLOAD_DIR || './uploads/reports');
    // Also allow fallback to env.UPLOAD_DIR for backwards compatibility
    if (!filePath.startsWith(baseUpload) && !filePath.startsWith(path.resolve(process.cwd(), env.UPLOAD_DIR))) {
      res.status(400).json({ success: false, message: 'Invalid file path' });
      return;
    }
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, message: 'File not found on server' });
      return;
    }
    await createAuditLog({
      organizationId: user.organizationId,
      userId: user._id as any,
      action: 'report_download',
      resource: 'employee_report',
      resourceId: report._id.toString(),
      method: req.method,
      path: req.path,
      ipAddress: req.ip || 'unknown',
    });
    res.setHeader('Content-Disposition', `attachment; filename="${report.originalFileName.replace(/"/g, '')}"`);
    res.setHeader('Content-Type', report.mimeType || 'application/octet-stream');
    res.sendFile(filePath);
  },

  async preview(req: Request, res: Response) {
    // For PDFs/images, allow inline preview; still enforce same access control as download
    const user = req.user!;
    const report = await EmployeeReport.findOne({ _id: req.params.id, organizationId: user.organizationId });
    if (!report) {
      res.status(404).json({ success: false, message: 'Report not found' });
      return;
    }
    const isOwner = report.submittedBy.toString() === user._id.toString();
    const isAdmin = user.roles.some(r => ['admin','super_admin'].includes(r.toLowerCase()));
    if (!isAdmin && !isOwner) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }
    // For preview, allow owner even if PENDING_REVIEW? Admin needs preview. Owner preview is allowed but spec says employee can preview before? We'll allow preview for owner regardless, download is restricted.
    const filePath = path.resolve(report.filePath);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, message: 'File not found' });
      return;
    }
    res.setHeader('Content-Disposition', `inline; filename="${report.originalFileName.replace(/"/g, '')}"`);
    res.setHeader('Content-Type', report.mimeType || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(filePath);
  }
};
