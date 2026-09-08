import api from './axios';
import { ApiResponse } from '../types';
import {
  AIAnalysis,
  AnomalyAnalysis,
  BIRecommendation,
  BISummary,
  CompanyAnalysisResult,
  ComparisonResult,
  CompanyProfile,
  CustomerAnalysis,
  DataValidation,
  FinanceAnalysis,
  FutureAnalysis,
  OperationsInsight,
  PastAnalysis,
  PresentAnalysis,
  RevenueAnalysis,
  SalesAnalysis,
  TimeGranularity,
} from '../types/businessIntelligence';

const params = (granularity?: TimeGranularity, extra: Record<string, unknown> = {}) => ({
  ...(granularity ? { granularity } : {}),
  ...extra,
});

export const businessIntelligenceApi = {
  getProfile: () => api.get<ApiResponse<CompanyProfile>>('/bi/profile'),

  getValidation: () => api.get<ApiResponse<DataValidation>>('/bi/validation'),

  getRevenue: (granularity?: TimeGranularity) =>
    api.get<ApiResponse<RevenueAnalysis>>('/bi/revenue', { params: params(granularity) }),

  getSales: (granularity?: TimeGranularity) =>
    api.get<ApiResponse<SalesAnalysis>>('/bi/sales', { params: params(granularity) }),

  getCustomers: (granularity?: TimeGranularity) =>
    api.get<ApiResponse<CustomerAnalysis>>('/bi/customers', { params: params(granularity) }),

  getFinance: (granularity?: TimeGranularity) =>
    api.get<ApiResponse<FinanceAnalysis>>('/bi/finance', { params: params(granularity) }),

  getOperations: () => api.get<ApiResponse<OperationsInsight>>('/bi/operations'),

  getPast: (granularity?: TimeGranularity) =>
    api.get<ApiResponse<PastAnalysis>>('/bi/past', { params: params(granularity) }),

  getPresent: (granularity?: TimeGranularity) =>
    api.get<ApiResponse<PresentAnalysis>>('/bi/present', { params: params(granularity) }),

  getFuture: (granularity?: TimeGranularity, horizon?: number) =>
    api.get<ApiResponse<FutureAnalysis>>('/bi/future', { params: params(granularity, horizon ? { horizon } : {}) }),

  getForecast: (granularity?: TimeGranularity, horizon?: number) =>
    api.get<ApiResponse<FutureAnalysis>>('/bi/forecast', { params: params(granularity, horizon ? { horizon } : {}) }),

  getAnomalies: (granularity?: TimeGranularity) =>
    api.get<ApiResponse<AnomalyAnalysis>>('/bi/anomalies', { params: params(granularity) }),

  getComparison: (dimension: string) =>
    api.get<ApiResponse<ComparisonResult>>('/bi/comparison', { params: { dimension } }),

  getAnalysis: (granularity?: TimeGranularity) =>
    api.get<ApiResponse<AIAnalysis>>('/bi/analysis', { params: params(granularity) }),

  getRecommendations: (granularity?: TimeGranularity) =>
    api.get<ApiResponse<BIRecommendation[]>>('/bi/recommendations', { params: params(granularity) }),

  getSummary: (granularity?: TimeGranularity) =>
    api.get<ApiResponse<BISummary>>('/bi/summary', { params: params(granularity) }),

  // Real-world company analysis (Long vs Short) — /api/business-intelligence
  analyze: (longCompany: string, shortCompany: string) =>
    api.post<ApiResponse<CompanyAnalysisResult>>('/business-intelligence/analyze', { longCompany, shortCompany }),

  refresh: (longCompany: string, shortCompany: string) =>
    api.post<ApiResponse<CompanyAnalysisResult>>('/business-intelligence/refresh', { longCompany, shortCompany }),

  getLatest: (longCompany: string, shortCompany: string) =>
    api.get<ApiResponse<CompanyAnalysisResult>>('/business-intelligence/latest', {
      params: { longCompany, shortCompany },
    }),
};