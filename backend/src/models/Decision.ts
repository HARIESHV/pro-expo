import mongoose from 'mongoose';

export interface IDecisionScenario {
  name: string;
  outcome: string;
}

export interface IDecisionMetric {
  label: string;
  value: string | number;
}

export interface IDecisionRelatedEntity {
  name: string;
  type: string;
  entityId?: string;
}

export interface IDecisionSupportingDocument {
  documentId?: string;
  title: string;
  source?: string;
}

export type DecisionStatus = 'draft' | 'evaluating' | 'evaluated' | 'approved' | 'rejected' | 'implemented';
export type DecisionPriority = 'low' | 'medium' | 'high';
export type DecisionRewardRatio = 'High' | 'Medium' | 'Low';

export interface IDecision {
  organizationId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
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
  scenarios: IDecisionScenario[];
  supportingMetrics: IDecisionMetric[];
  supportingDocuments: IDecisionSupportingDocument[];
  relatedEntities: IDecisionRelatedEntity[];
  expectedOutcome?: string;
  actualOutcome?: string;
  tags: string[];
  evaluatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const decisionSchema = new mongoose.Schema<IDecision>(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    decision: { type: String, required: true, trim: true },
    category: { type: String, default: 'strategy', trim: true },
    department: { type: String },
    budget: { type: String },
    riskTolerance: { type: String, enum: ['Low', 'Medium', 'High'] },
    status: { type: String, enum: ['draft', 'evaluating', 'evaluated', 'approved', 'rejected', 'implemented'], default: 'draft', index: true },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    impact: { type: String },
    owner: { type: String },
    summary: { type: String },
    opportunities: { type: [String], default: [] },
    risks: { type: [String], default: [] },
    expectedImpact: { type: String },
    recommendation: { type: String },
    confidence: { type: Number, default: 0, min: 0, max: 1 },
    rewardRatio: { type: String, enum: ['High', 'Medium', 'Low'] },
    scenarios: [
      {
        name: { type: String },
        outcome: { type: String },
        _id: false,
      },
    ],
    supportingMetrics: [
      {
        label: { type: String },
        value: { type: mongoose.Schema.Types.Mixed },
        _id: false,
      },
    ],
    supportingDocuments: [
      {
        documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
        title: { type: String },
        source: { type: String },
        _id: false,
      },
    ],
    relatedEntities: [
      {
        name: { type: String },
        type: { type: String },
        entityId: { type: mongoose.Schema.Types.ObjectId },
        _id: false,
      },
    ],
    expectedOutcome: { type: String },
    actualOutcome: { type: String },
    tags: { type: [String], default: [] },
    evaluatedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

decisionSchema.index({ organizationId: 1, status: 1 });
decisionSchema.index({ organizationId: 1, createdAt: -1 });

export const Decision = mongoose.model<IDecision>('Decision', decisionSchema);