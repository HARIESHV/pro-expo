import { Request, Response } from 'express';
import { AuditLog } from '../models/AuditLog';
import { ApiResponse } from '../types';

export const auditController = {
  async getLogs(req: Request, res: Response): Promise<void> {
    const { page = 1, limit = 50, userId, action, resource, startDate, endDate } = req.query;
    const filter: Record<string, unknown> = { organizationId: req.user!.organizationId };
    if (userId) filter.userId = userId;
    if (action) filter.action = action;
    if (resource) filter.resource = resource;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) (filter.createdAt as Record<string, unknown>).$gte = new Date(startDate as string);
      if (endDate) (filter.createdAt as Record<string, unknown>).$lte = new Date(endDate as string);
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('userId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip((+page - 1) * +limit)
        .limit(+limit),
      AuditLog.countDocuments(filter),
    ]);

    res.json({ success: true, data: { logs, total, page: +page, limit: +limit, totalPages: Math.ceil(total / +limit) } } as ApiResponse);
  },
};
