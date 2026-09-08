import api from './axios';
import { ApiResponse } from '../types';

export type RiskIntelligenceSource =
  | 'document'
  | 'ai_analysis'
  | 'universal_search'
  | 'chat'
  | 'analytics'
  | 'business_intelligence'
  | 'knowledge_graph'
  | 'graph_evaluation'
  | 'decision_intelligence';

export interface RiskEvidence {
  label: string;
  detail: string;
  sourceId?: string;
  sourceType?: RiskIntelligenceSource;
}

export interface RiskDetails {
  _id: string;
  organizationId: string;
  title: string;
  description: string;
  category: string;
  level: 'low' | 'medium' | 'high' | 'critical';
  probability: number;
  impact: number;
  riskScore: number;
  confidence: number;
  status: 'open' | 'monitoring' | 'mitigated' | 'identified' | 'assessing' | 'mitigating' | 'resolved' | 'accepted';
  ownerId?: {
    _id: string;
    firstName: string;
    lastName: string;
    displayName?: string;
    email: string;
  };
  departmentId?: string;
  mitigationStrategies: string[];
  mitigation?: string;
  recommendations: string[];
  evidence: RiskEvidence[];
  sources: RiskIntelligenceSource[];
  fingerprint?: string;
  detectedAt: string;
  resolvedAt?: string;
  aiDetected: boolean;
  aiConfidence?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RiskAnalysisMeta {
  sourceAvailability: Record<RiskIntelligenceSource, boolean>;
  unavailableSources: RiskIntelligenceSource[];
  analyzedAt: string;
  totalSignals: number;
}

export const risksApi = {
  getRisks: (filters?: { level?: string; status?: string }) =>
    api.get<ApiResponse<{ risks: RiskDetails[] } & Partial<RiskAnalysisMeta>>>('/risks', { params: filters }),

  getRiskSummary: () =>
    api.get<ApiResponse<{
      summary: Record<string, number>;
      total: number;
      sources: Record<string, number>;
    }>>('/risks/summary'),

  recalculate: () =>
    api.post<ApiResponse<{ riskCount: number; totalSignals: number; unavailableSources: string[]; analyzedAt: string }>>('/risks/recalculate'),

  getRiskReport: () =>
    api.get<ApiResponse<{ report: unknown }>>('/risks/report'),

  updateRisk: (id: string, data: Partial<Pick<RiskDetails, 'status' | 'mitigation' | 'recommendations' | 'ownerId'>>) =>
    api.put<ApiResponse<{ risk: RiskDetails }>>(`/risks/${id}`, data),

  deleteRisk: (id: string) =>
    api.delete<ApiResponse>(`/risks/${id}`),
};
