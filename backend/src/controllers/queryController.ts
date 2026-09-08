import { Request, Response } from 'express';
import { Query } from '../models/Query';
import { AppError } from '../middleware/errorHandler';
import { ApiResponse } from '../types';
import mongoose from 'mongoose';

export const queryController = {
  async getQueries(req: Request, res: Response): Promise<void> {
    const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);
    const { agent, type } = req.query;

    const queryFilter: Record<string, unknown> = { organizationId: orgId };
    if (agent) queryFilter.agentsUsed = String(agent).toLowerCase();

    const queries = await Query.find(queryFilter)
      .populate('userId', 'firstName lastName email displayName')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: { queries } } as ApiResponse);
  },

  async getQuery(req: Request, res: Response): Promise<void> {
    const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);
    const query = await Query.findOne({ _id: req.params.id, organizationId: orgId })
      .populate('userId', 'firstName lastName email displayName');

    if (!query) {
      throw new AppError('Query not found', 404);
    }

    res.json({ success: true, data: { query } } as ApiResponse);
  },

  async deleteQuery(req: Request, res: Response): Promise<void> {
    const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);
    const result = await Query.deleteOne({ _id: req.params.id, organizationId: orgId });

    if (result.deletedCount === 0) {
      throw new AppError('Query not found', 404);
    }

    res.json({ success: true, message: 'Query deleted successfully' } as ApiResponse);
  },
};
