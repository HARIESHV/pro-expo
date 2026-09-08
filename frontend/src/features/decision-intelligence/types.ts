export type DecisionStatus = 'draft' | 'evaluating' | 'evaluated' | 'approved' | 'rejected' | 'implemented';
export type DecisionPriority = 'low' | 'medium' | 'high';
export type DecisionRewardRatio = 'High' | 'Medium' | 'Low';

export interface DecisionScenario {
  name: string;
  outcome: string;
}

export interface DecisionMetric {
  label: string;
  value: string | number;
}

export interface DecisionRelatedEntity {
  name: string;
  type: string;
  entityId?: string;
}

export interface DecisionSupportingDocument {
  documentId?: string;
  title: string;
  source?: string;
}

export interface DecisionRecord {
  _id: string;
  organizationId: string;
  title: string;
  decision: string;
  category: string;
  department?: string;
  budget?: string;
  riskTolerance?: 'Low' | 'Medium' | 'High';
  status: DecisionStatus;
  priority: DecisionPriority;
  impact?: string;
  owner?: string;
  summary?: string;
  opportunities: string[];
  risks: string[];
  expectedImpact?: string;
  recommendation?: string;
  confidence: number;
  rewardRatio?: DecisionRewardRatio;
  scenarios: DecisionScenario[];
  supportingMetrics: DecisionMetric[];
  supportingDocuments: DecisionSupportingDocument[];
  relatedEntities: DecisionRelatedEntity[];
  expectedOutcome?: string;
  actualOutcome?: string;
  tags: string[];
  evaluatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionListResponse {
  decisions: DecisionRecord[];
  total: number;
  page: number;
  limit: number;
}