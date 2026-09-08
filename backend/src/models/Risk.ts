import mongoose, { Document, Schema } from 'mongoose';
import { RiskLevel } from '../types';

export type RiskIntelligenceSourceType =
  | 'document'
  | 'ai_analysis'
  | 'universal_search'
  | 'chat'
  | 'analytics'
  | 'business_intelligence'
  | 'knowledge_graph'
  | 'graph_evaluation'
  | 'decision_intelligence';

export interface IRiskEvidence {
  label: string;
  detail: string;
  sourceId?: string;
  sourceType?: RiskIntelligenceSourceType;
}

export interface IRisk extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  category: string;
  level: RiskLevel;
  probability: number;
  impact: number;
  riskScore: number;
  status: 'identified' | 'assessing' | 'mitigating' | 'resolved' | 'accepted' | 'open' | 'monitoring';
  ownerId?: mongoose.Types.ObjectId;
  departmentId?: mongoose.Types.ObjectId;
  relatedEntities: Array<{ entityType: string; entityId: string }>;
  mitigationStrategies: string[];
  mitigation?: string;
  recommendations: string[];
  evidence: IRiskEvidence[];
  sources: RiskIntelligenceSourceType[];
  confidence: number;
  fingerprint?: string;
  detectedAt: Date;
  resolvedAt?: Date;
  aiDetected: boolean;
  aiConfidence?: number;
  createdAt: Date;
  updatedAt: Date;
}

const riskSchema = new Schema<IRisk>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    level: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
    probability: { type: Number, required: true, min: 0, max: 100 },
    impact: { type: Number, required: true, min: 0, max: 100 },
    riskScore: { type: Number, required: true, min: 0, max: 100 },
    status: {
      type: String,
      enum: ['identified', 'assessing', 'mitigating', 'resolved', 'accepted', 'open', 'monitoring'],
      default: 'open',
    },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User' },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    relatedEntities: [{ entityType: String, entityId: String }],
    mitigationStrategies: { type: [String], default: [] },
    mitigation: String,
    recommendations: { type: [String], default: [] },
    evidence: {
      type: [
        {
          label: String,
          detail: String,
          sourceId: String,
          sourceType: String,
        },
      ],
      default: [],
    },
    sources: { type: [String], default: [] },
    confidence: { type: Number, default: 0, min: 0, max: 1 },
    fingerprint: { type: String, index: true },
    detectedAt: { type: Date, default: Date.now },
    resolvedAt: Date,
    aiDetected: { type: Boolean, default: false },
    aiConfidence: Number,
  },
  { timestamps: true }
);

riskSchema.index({ organizationId: 1, level: 1 });
riskSchema.index({ organizationId: 1, status: 1 });

export const Risk = mongoose.model<IRisk>('Risk', riskSchema);
