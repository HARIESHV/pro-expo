import api from '../../api/axios';
import { ApiResponse } from '../../types';
import { DecisionListResponse, DecisionRecord } from './types';

export interface DecisionEvaluationPayload {
  decision: string;
  department: string;
  budget: string;
  riskTolerance: string;
}

export interface DecisionEvaluationResult {
  summary: string;
  opportunities: string[];
  risks: string[];
  expectedImpact: string;
  recommendation: string;
  confidence: number;
  rewardRatio: 'High' | 'Medium' | 'Low';
}

export interface DecisionTrendPoint {
  year: number;
  month: number;
  label: string;
  revenue: number;
  count: number;
}

export interface DecisionForecast {
  points: Array<{ label: string; value: number }>;
  direction: 'up' | 'down' | 'flat';
  note: string;
}

export interface DecisionInsights {
  metrics: { totalRevenue: number; salesCount: number };
  riskSummary: Record<string, number>;
  decisions: DecisionListResponse;
  documents: number;
  trend: DecisionTrendPoint[];
  forecast: DecisionForecast;
  decisionTrend: Array<{ label: string; count: number }>;
}

export interface DecisionInsightsFilters {
  from?: string;
  to?: string;
  department?: string;
}

export const decisionsApi = {
  list: (filters?: { status?: string; department?: string; page?: number; limit?: number }) =>
    api.get<ApiResponse<DecisionListResponse>>('/decisions', { params: filters }),

  insights: (filters?: DecisionInsightsFilters) =>
    api.get<ApiResponse<DecisionInsights>>('/decisions/insights', { params: filters }),

  get: (id: string) => api.get<ApiResponse<{ decision: DecisionRecord }>>(`/decisions/${id}`),

  create: (data: Partial<DecisionRecord>) =>
    api.post<ApiResponse<{ decision: DecisionRecord }>>('/decisions', data),

  evaluate: (data: DecisionEvaluationPayload) =>
    api.post<ApiResponse<DecisionEvaluationResult>>('/decisions/evaluate', data),

  recommendations: () =>
    api.post<ApiResponse<{ recommendations: string[] }>>('/decisions/recommendations'),

  update: (id: string, data: Partial<DecisionRecord>) =>
    api.put<ApiResponse<{ decision: DecisionRecord }>>(`/decisions/${id}`, data),

  remove: (id: string) => api.delete<ApiResponse>(`/decisions/${id}`),
};