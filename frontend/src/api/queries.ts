import api from './axios';
import { ApiResponse } from '../types';

export interface QueryHistoryDetails {
  _id: string;
  conversationId: string;
  userId: {
    _id: string;
    firstName: string;
    lastName: string;
    displayName?: string;
  };
  organizationId: string;
  originalQuery: string;
  intent?: string;
  agentsUsed: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: {
    answer?: string;
    summary?: string;
    confidence?: number;
    recommendations?: string[];
  };
  executionTimeMs?: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export const queriesApi = {
  getQueries: (filters?: { agent?: string }) =>
    api.get<ApiResponse<{ queries: QueryHistoryDetails[] }>>('/queries', { params: filters }),

  getQuery: (id: string) =>
    api.get<ApiResponse<{ query: QueryHistoryDetails }>>(`/queries/${id}`),

  deleteQuery: (id: string) =>
    api.delete<ApiResponse>(`/queries/${id}`),
};
