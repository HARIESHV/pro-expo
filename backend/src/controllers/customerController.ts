import { Request, Response } from 'express';
import { Customer } from '../models/Customer';
import { ApiResponse } from '../types';

/**
 * Customer endpoints — org-scoped access to customer records.
 * Mirrors the conventions used by /api/documents (paginated + filtered).
 */
export const customerController = {
  async list(req: Request, res: Response): Promise<void> {
    const { page = 1, limit = 20, segment, status, region, search } = req.query;

    const filter: Record<string, unknown> = {
      organizationId: req.user!.organizationId,
    };
    if (segment) filter.segment = segment;
    if (status) filter.status = status;
    if (region) filter.region = region;
    if (search) filter.$text = { $search: search as string };

    const pageNum = Math.max(parseInt(page as string, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit as string, 10) || 20, 1), 100);

    const [customers, total] = await Promise.all([
      Customer.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Customer.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: { customers, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    } as ApiResponse);
  },

  /** GET /api/customers/summary — customer counts by status. */
  async summary(req: Request, res: Response): Promise<void> {
    const orgId = req.user!.organizationId;
    const [total, active, atRisk, churned] = await Promise.all([
      Customer.countDocuments({ organizationId: orgId }),
      Customer.countDocuments({ organizationId: orgId, status: 'active' }),
      Customer.countDocuments({ organizationId: orgId, status: 'at_risk' }),
      Customer.countDocuments({ organizationId: orgId, status: 'churned' }),
    ]);

    res.json({ success: true, data: { total, active, atRisk, churned } } as ApiResponse);
  },
};