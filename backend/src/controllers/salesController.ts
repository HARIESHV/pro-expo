import { Request, Response } from 'express';
import { SalesRecord } from '../models/SalesRecord';
import { Department } from '../models/Department';
import { ApiResponse } from '../types';
import mongoose from 'mongoose';

/**
 * Sales endpoints — org-scoped access to enterprise sales records.
 * Mirrors the conventions used by /api/documents (paginated + filtered).
 */
export const salesController = {
  async list(req: Request, res: Response): Promise<void> {
    const { page = 1, limit = 20, year, quarter, region, stage, department } = req.query;

    const filter: Record<string, unknown> = {
      organizationId: req.user!.organizationId,
    };
    if (year) filter['period.year'] = parseInt(year as string, 10);
    if (quarter) filter['period.quarter'] = parseInt(quarter as string, 10);
    if (region) filter.region = region;
    if (stage) filter.stage = stage;
    if (department) {
      const deptParam = String(department).trim();
      if (/^[0-9a-fA-F]{24}$/.test(deptParam)) {
        filter.departmentId = new mongoose.Types.ObjectId(deptParam);
      } else {
        const dept = await Department.findOne({ organizationId: req.user!.organizationId, name: deptParam }).lean();
        if (dept) filter.departmentId = dept._id;
        else filter.departmentId = null; // no matching department → empty result
      }
    }

    const pageNum = Math.max(parseInt(page as string, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit as string, 10) || 20, 1), 100);

    const [sales, total] = await Promise.all([
      SalesRecord.find(filter)
        .sort({ 'period.year': -1, 'period.quarter': -1, createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      SalesRecord.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: { sales, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    } as ApiResponse);
  },

  /** GET /api/sales/summary — revenue + deal counts (current year-to-date). */
  async summary(req: Request, res: Response): Promise<void> {
    const orgId = new mongoose.Types.ObjectId(req.user!.organizationId.toString());
    const thisYear = new Date().getFullYear();
    const thisQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

    const [revenue, count, closedWon] = await Promise.all([
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
        { $group: { _id: null, total: { $sum: '$amount' } } },
        { $project: { _id: 0, total: 1 } },
      ]),
      SalesRecord.countDocuments({ organizationId: orgId }),
      SalesRecord.countDocuments({ organizationId: orgId, stage: 'closed_won' }),
    ]);

    res.json({
      success: true,
      data: {
        totalRevenue: revenue[0]?.total || 0,
        totalDeals: count,
        closedWonDeals: closedWon,
        period: { year: thisYear, quarter: thisQuarter },
      },
    } as ApiResponse);
  },
};