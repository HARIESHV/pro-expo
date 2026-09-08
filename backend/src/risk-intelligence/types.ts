export type RiskSourceType =
  | 'document'
  | 'ai_analysis'
  | 'universal_search'
  | 'chat'
  | 'analytics'
  | 'business_intelligence'
  | 'knowledge_graph'
  | 'graph_evaluation'
  | 'decision_intelligence';

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export type RiskLifecycleStatus = 'open' | 'monitoring' | 'mitigated' | 'resolved';

/**
 * A raw, un-normalized risk signal discovered by one analyzer.
 * Every signal must identify its source so it can be traced and de-duplicated.
 */
export interface RiskSignal {
  sourceType: RiskSourceType;
  sourceId: string;
  signalType: string;
  title: string;
  description: string;
  category: string;
  evidence: Array<{ label: string; detail: string; sourceId?: string; sourceType?: RiskSourceType }>;
  confidence: number; // 0-1
  impact?: number; // 0-100 (optional; analyzers provide deterministic estimate)
  probability?: number; // 0-100 (optional)
  detectedAt?: string;
  recommendation?: string;
  mitigation?: string;
}

/**
 * Normalized, validated, de-duplicated risk ready for persistence.
 */
export interface NormalizedRisk {
  title: string;
  description: string;
  category: string;
  severity: RiskSeverity;
  probability: number;
  impact: number;
  riskScore: number;
  confidence: number;
  status: RiskLifecycleStatus;
  sources: RiskSourceType[];
  evidence: Array<{ label: string; detail: string; sourceId?: string; sourceType?: RiskSourceType }>;
  mitigation: string;
  recommendations: string[];
  fingerprint: string;
  detectedAt: string;
}

export interface RiskAnalysisResult {
  risks: NormalizedRisk[];
  sourceAvailability: Record<RiskSourceType, boolean>;
  unavailableSources: RiskSourceType[];
  analyzedAt: string;
  totalSignals: number;
}
