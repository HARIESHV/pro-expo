import { Request, Response } from 'express';
import { SalesRecord } from '../models/SalesRecord';
import { Customer } from '../models/Customer';
import { ApiResponse } from '../types';
import mongoose from 'mongoose';
import { analyzeCompanies, getLatestAnalysis } from '../services/company-intelligence/businessIntelligenceService';
import { logger } from '../config/logger';
import { getCompanyProfile, getValidation, getRevenueAnalysis, getSalesAnalysis, getCustomerAnalysis, getFinanceAnalysis, getOperationsAnalysis, getPastAnalysis, getPresentAnalysis, getFutureAnalysis, getAnomalies, getComparison, getSummaryDashboard, getRecommendations } from '../services/bi/businessIntelligenceService';
import { generateAIAnalysis } from '../services/bi/aiAnalysisService';
import { AnalysisOptions, ComparisonInput, TimeGranularity } from '../services/bi/types';

function toAnalysisOptions(req: Request): AnalysisOptions {
  const opts: AnalysisOptions = {};
  if (req.query.granularity) {
    const g = String(req.query.granularity);
    if ((['daily', 'weekly', 'monthly', 'quarterly', 'annual'] as string[]).includes(g)) opts.granularity = g as TimeGranularity;
  }
  if (req.query.horizon) {
    const h = parseInt(String(req.query.horizon), 10);
    if (Number.isFinite(h) && h > 0 && h <= 12) opts.horizon = h;
  }
  return opts;
}

function orgRef(req: Request): string {
  return String(req.user!.organizationId);
}

function sendData(res: Response, data: unknown): void {
  res.json({ success: true, data } as ApiResponse);
}

function fail(res: Response, context: string, err: unknown): void {
  logger.error(`[BI:${context}] ${(err as Error).message}`);
  res.status(500).json({ success: false, message: `Failed to run ${context} analysis: ${(err as Error).message}` } as ApiResponse);
}

type Handler = (req: Request, res: Response) => Promise<void>;

function wrap(context: string, fn: (req: Request, opts: AnalysisOptions) => Promise<unknown>): Handler {
  return async (req, res) => {
    try {
      const opts = toAnalysisOptions(req);
      sendData(res, await fn(req, opts));
    } catch (err) {
      fail(res, context, err);
    }
  };
}

export const businessIntelligenceController = {
  async getOverview(req: Request, res: Response): Promise<void> {
    try {
      const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);
      const now = new Date();
      const thisYear = now.getFullYear();
      const thisQuarter = Math.ceil((now.getMonth() + 1) / 3);

      const [currentRevenue, customers, activeCustomers, trend, customerSegments] = await Promise.all([
        SalesRecord.aggregate([
          {
            $match: {
              organizationId: orgId,
              $or: [
                { 'period.year': { $gt: thisYear } },
                { 'period.year': thisYear, 'period.quarter': { $lte: thisQuarter } },
              ],
            },
          },
          { $sort: { 'period.year': 1, 'period.quarter': 1 } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
          { $project: { _id: 0, total: 1 } },
        ]),
        Customer.aggregate([
          { $match: { organizationId: orgId } },
          { $group: { _id: null, avgLTV: { $avg: '$lifetimeValue' }, totalCustomers: { $sum: 1 } } },
        ]),
        Customer.countDocuments({ organizationId: orgId, status: 'active' }),
        SalesRecord.aggregate([
          { $match: { organizationId: orgId } },
          { $group: { _id: { year: '$period.year', quarter: '$period.quarter' }, revenue: { $sum: '$amount' }, deals: { $sum: 1 } } },
          { $sort: { '_id.year': 1, '_id.quarter': 1 } },
        ]),
        Customer.aggregate([
          { $match: { organizationId: orgId } },
          { $group: { _id: '$segment', count: { $sum: 1 } } },
        ]),
      ]);

      const totalRevenue = currentRevenue[0]?.total || 0;
      const averageCustomerLtv = customers[0]?.avgLTV || 0;

      res.json({
        success: true,
        data: {
          totalRevenue,
          activeCustomers,
          averageCustomerLtv,
          revenuePerformance: trend,
          customerSegments,
        },
      } as ApiResponse);
    } catch (err: any) {
      res.status(500).json({ success: false, message: `Failed to fetch BI data: ${err.message}` } as ApiResponse);
    }
  },

  /**
   * Real-world company analysis (Long Company vs Short Company).
   *
   * POST /api/business-intelligence/analyze
   * Body: { longCompany, shortCompany }
   */
  async analyze(req: Request, res: Response): Promise<void> {
    const { longCompany, shortCompany, refresh } = req.body || {};

    if (!longCompany || !shortCompany) {
      res.status(400).json({
        success: false,
        message: 'Both longCompany and shortCompany are required.',
      } as ApiResponse);
      return;
    }

    try {
      const result = await analyzeCompanies(
        { longCompany, shortCompany, refresh: Boolean(refresh) },
        {
          organizationId: String(req.user!.organizationId),
          createdById: String(req.user!._id),
        }
      );
      res.json({ success: true, data: result } as ApiResponse);
    } catch (err: any) {
      if (err?.message?.includes('required') || err?.message?.includes('200 characters')) {
        res.status(400).json({ success: false, message: err.message } as ApiResponse);
        return;
      }
      res.status(500).json({
        success: false,
        message: `Unable to retrieve company data. Please try again. (${err?.message || 'unknown error'})`,
      } as ApiResponse);
    }
  },

  /** Refresh endpoint — same workflow but forces fresh AI-referenced retrieval. */
  async refresh(req: Request, res: Response): Promise<void> {
    const { longCompany, shortCompany } = req.body || {};
    if (!longCompany || !shortCompany) {
      res.status(400).json({
        success: false,
        message: 'Both longCompany and shortCompany are required.',
      } as ApiResponse);
      return;
    }
    try {
      const result = await analyzeCompanies(
        { longCompany, shortCompany, refresh: true, mode: 'refresh' },
        {
          organizationId: String(req.user!.organizationId),
          createdById: String(req.user!._id),
        }
      );
      res.json({ success: true, data: result } as ApiResponse);
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: `Unable to refresh company data. Please try again. (${err?.message || 'unknown error'})`,
      } as ApiResponse);
    }
  },

  /** Fetch the most recent stored analysis for a company pair. */
  async getLatest(req: Request, res: Response): Promise<void> {
    const longCompany = String(req.query.longCompany || '');
    const shortCompany = String(req.query.shortCompany || '');
    if (!longCompany || !shortCompany) {
      res.status(400).json({ success: false, message: 'longCompany and shortCompany query params are required.' } as ApiResponse);
      return;
    }
    try {
      const existing = await getLatestAnalysis(String(req.user!.organizationId), longCompany, shortCompany);
      if (!existing) {
        res.status(404).json({ success: false, message: 'No stored analysis found for this company pair.' } as ApiResponse);
        return;
      }
      res.json({ success: true, data: existing } as ApiResponse);
    } catch (err: any) {
      res.status(500).json({ success: false, message: `Failed to fetch stored analysis: ${err.message}` } as ApiResponse);
    }
  },

  // -------------------------------------------------------------------------
  // /api/bi/* — real-data BI engine endpoints
  // -------------------------------------------------------------------------
  getProfile: wrap('profile', (req) => getCompanyProfile(orgRef(req))),
  getValidation: wrap('validation', (req) => getValidation(orgRef(req))),
  getRevenue: wrap('revenue', (req, opts) => getRevenueAnalysis(orgRef(req), opts)),
  getSales: wrap('sales', (req, opts) => getSalesAnalysis(orgRef(req), opts)),
  getCustomers: wrap('customers', (req, opts) => getCustomerAnalysis(orgRef(req), opts)),
  getFinance: wrap('finance', (req, opts) => getFinanceAnalysis(orgRef(req), opts)),
  getOperations: wrap('operations', (req) => getOperationsAnalysis(orgRef(req))),
  getPast: wrap('past', (req, opts) => getPastAnalysis(orgRef(req), opts)),
  getPresent: wrap('present', (req, opts) => getPresentAnalysis(orgRef(req), opts)),
  getFuture: wrap('future', (req, opts) => getFutureAnalysis(orgRef(req), opts)),
  getForecast: wrap('forecast', (req, opts) => getFutureAnalysis(orgRef(req), opts)),
  getAnomalies: wrap('anomalies', (req, opts) => getAnomalies(orgRef(req), opts)),
  getRecommendations: wrap('recommendations', (req, opts) => getRecommendations(orgRef(req), opts)),
  getSummary: wrap('summary', (req, opts) => getSummaryDashboard(orgRef(req), opts)),
  getComparison: wrap('comparison', async (req, opts) => {
    const dimension = String(req.query.dimension || 'qoq');
    return getComparison(orgRef(req), { dimension: dimension as ComparisonInput['dimension'] });
  }),
  getAnalysis: wrap('analysis', (req, opts) => generateAIAnalysis(orgRef(req), opts)),
};