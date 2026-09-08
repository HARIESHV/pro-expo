import { Request, Response } from 'express';
import { ApiResponse } from '../types';
import { SalesRecord } from '../models/SalesRecord';
import { Customer } from '../models/Customer';
import { Risk } from '../models/Risk';
import { Query } from '../models/Query';
import mongoose from 'mongoose';

const LEVELS = ['critical', 'high', 'medium', 'low'];

const isDev = process.env.NODE_ENV !== 'production';

export const analyticsController = {
  async getDashboardMetrics(req: Request, res: Response): Promise<void> {
    try {
      if (isDev) {
        console.debug(
          `[Analytics] getDashboardMetrics — user: ${req.user?.email}, orgId: ${req.user?.organizationId}`
        );
      }

      const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);
      const now = new Date();
      const thisYear = now.getFullYear();
      const thisQuarter = Math.ceil((now.getMonth() + 1) / 3);

      const [quarterTrend, customerStats, riskStats, totalQueries] = await Promise.all([
        SalesRecord.aggregate([
          { $match: { organizationId: orgId } },
          {
            $group: {
              _id: { year: '$period.year', quarter: '$period.quarter' },
              total: { $sum: '$amount' },
            },
          },
          { $sort: { '_id.year': 1, '_id.quarter': 1 } },
        ]),
        Customer.aggregate([
          { $match: { organizationId: orgId } },
          { $group: { _id: '$status', count: { $sum: 1 }, avgLTV: { $avg: '$lifetimeValue' } } },
        ]),
        Risk.aggregate([
          { $match: { organizationId: orgId, status: { $ne: 'resolved' } } },
          { $group: { _id: '$level', count: { $sum: 1 } } },
        ]),
        Query.countDocuments({ organizationId: orgId }),
      ]);

      // Determine "current" period: the latest quarter that actually has data is used
      // as the visible period when the current calendar quarter has no sales yet,
      // so the Revenue KPI never shows a misleading $0 on fresh/partial data.
      const currentQuarterTotal = quarterTrend.find((q) => q._id.year === thisYear && q._id.quarter === thisQuarter);
      const hasCurrent = currentQuarterTotal && currentQuarterTotal.total > 0;

      let current = 0;
      let previous = 0;
      if (hasCurrent) {
        current = currentQuarterTotal.total;
        const idx = quarterTrend.findIndex((q) => q._id.year === thisYear && q._id.quarter === thisQuarter);
        previous = idx > 0 ? quarterTrend[idx - 1].total : 0;
      } else {
        // Fall back to the most recent quarter with data, using the quarter before it as "previous"
        const nonEmpty = quarterTrend.filter((q) => q.total > 0);
        if (nonEmpty.length > 0) {
          const latest = nonEmpty[nonEmpty.length - 1];
          current = latest.total;
          const latestIdx = quarterTrend.findIndex(
            (q) => q._id.year === latest._id.year && q._id.quarter === latest._id.quarter
          );
          previous = latestIdx > 0 ? quarterTrend[latestIdx - 1].total : 0;
        }
      }
      const growth = previous > 0 ? Math.round(((current - previous) / previous) * 100) : 0;

      const customers = customerStats.map((c) => ({
        _id: c._id,
        count: c.count,
        avgLTV: Math.round(c.avgLTV || 0),
      }));

      const riskCountByLevel = new Map<string, number>();
      riskStats.forEach((r) => riskCountByLevel.set(String(r._id), r.count));
      const risks = LEVELS.map((level) => ({ _id: level, count: riskCountByLevel.get(level) || 0 }));

      res.json({
        success: true,
        data: {
          revenue: { current, previous, growth },
          customers,
          risks,
          totalQueries,
        },
      } as ApiResponse);
    } catch (err: any) {
      res.status(500).json({ success: false, message: `Failed to fetch analytics metrics: ${err.message}` } as ApiResponse);
    }
  },

  async getSalesTrend(req: Request, res: Response): Promise<void> {
    try {
      const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);

      const trend = await SalesRecord.aggregate([
        { $match: { organizationId: orgId } },
        {
          $group: {
            _id: { year: '$period.year', quarter: '$period.quarter' },
            revenue: { $sum: '$amount' },
            deals: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.quarter': 1 } },
      ]);

      res.json({ success: true, data: { trend } } as ApiResponse);
    } catch (err: any) {
      res.status(500).json({ success: false, message: `Failed to fetch sales trend: ${err.message}` } as ApiResponse);
    }
  },

  async getCustomerAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);

      const [byRegion, bySegment, atRisk] = await Promise.all([
        Customer.aggregate([
          { $match: { organizationId: orgId, status: { $ne: 'churned' } } },
          { $group: { _id: '$region', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Customer.aggregate([
          { $match: { organizationId: orgId } },
          { $group: { _id: '$segment', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Customer.find({ organizationId: orgId, status: 'at_risk' }).limit(50).lean(),
      ]);

      res.json({
        success: true,
        data: { byRegion, bySegment, atRisk },
      } as ApiResponse);
    } catch (err: any) {
      res.status(500).json({ success: false, message: `Failed to fetch customer analytics: ${err.message}` } as ApiResponse);
    }
  },
};
