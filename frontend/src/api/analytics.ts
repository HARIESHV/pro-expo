import api from './axios';
import { ApiResponse, DashboardMetrics } from '../types';

export const analyticsApi = {
  getDashboardMetrics: () =>
    api.get<ApiResponse<DashboardMetrics>>('/analytics/dashboard'),

  getSalesTrend: () =>
    api.get<ApiResponse<{ trend: unknown[] }>>('/analytics/sales-trend'),

  getCustomerAnalytics: () =>
    api.get<ApiResponse<{ byRegion: unknown[]; bySegment: unknown[]; atRisk: unknown[] }>>('/analytics/customers'),
};
