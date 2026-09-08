import api from './axios';
import { ApiResponse, CompanySearchResponse, CompanyProfile } from '../types';

export const companyApi = {
  search: (q: string, opts: { limit?: number } = {}, signal?: AbortSignal) =>
    api.get<ApiResponse<CompanySearchResponse>>('/companies/search', {
      params: { q, limit: opts.limit ?? 10 },
      signal,
    }),

  resolve: (q: string, signal?: AbortSignal) =>
    api.get<ApiResponse<{ resolved: CompanyProfile | null }>>('/companies/resolve', {
      params: { q },
      signal,
    }),

  getById: (id: string, signal?: AbortSignal) =>
    api.get<ApiResponse<{ company: CompanyProfile }>>(`/companies/${id}`, { signal }),
};