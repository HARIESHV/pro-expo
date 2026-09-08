import api from './axios';
import { ApiResponse, UniversalSearchResponse } from '../types';

export const searchApi = {
  universalSearch: (q: string, opts: { page?: number; limit?: number; category?: string } = {}, signal?: AbortSignal) =>
    api.get<ApiResponse<UniversalSearchResponse>>('/search', {
      params: {
        q,
        page: opts.page ?? 0,
        limit: opts.limit ?? 25,
        ...(opts.category ? { category: opts.category } : {}),
      },
      signal,
    }),
};
