import { Request, Response } from 'express';
import { searchService } from '../services/searchService';
import { ApiResponse } from '../types';

export const searchController = {
  async universalSearch(req: Request, res: Response): Promise<void> {
    const q = (req.query.q as string) || '';
    const trimmed = q.trim();

    // Empty query -> 200 with empty results (safe, no error)
    if (!trimmed) {
      res.json({
        success: true,
        data: { query: q, results: [], total: 0 },
      } as ApiResponse);
      return;
    }

    // Special characters and long queries are handled safely by the service
    // (regex escaping + capped result counts). Basic sanity guard on length.
    if (trimmed.length > 200) {
      res.status(400).json({
        success: false,
        message: 'Search query is too long (max 200 characters).',
      } as ApiResponse);
      return;
    }

    const data = await searchService.search(req.user!, trimmed, {
      page: req.query.page ? Math.max(0, parseInt(String(req.query.page), 10) || 0) : 0,
      limit: req.query.limit ? Math.min(Math.max(parseInt(String(req.query.limit), 10) || 25, 5), 50) : 25,
      category: req.query.category ? String(req.query.category) : undefined,
    });
    res.json({ success: true, data } as ApiResponse);
  },
};
