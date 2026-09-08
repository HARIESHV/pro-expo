import { Request, Response } from 'express';
import { SalesRecord } from '../models/SalesRecord';
import { Customer } from '../models/Customer';
import { ApiResponse } from '../types';
import mongoose from 'mongoose';

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
};
