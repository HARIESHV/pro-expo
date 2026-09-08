import mongoose, { Document, Schema } from 'mongoose';
import { AgentType, AgentStatus } from '../types';

export interface IAIAgent extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  type: AgentType;
  displayName: string;
  description: string;
  organizationId: mongoose.Types.ObjectId;
  capabilities: string[];
  systemPrompt: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  stats: {
    totalTasks: number;
    successRate: number;
    avgExecutionTimeMs: number;
    avgConfidence: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const aiAgentSchema = new Schema<IAIAgent>(
  {
    name: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['master', 'rag', 'data_intelligence', 'analytics', 'finance', 'sales',
             'customer_intelligence', 'document_intelligence', 'data_query', 'risk', 'executive'],
    },
    displayName: { type: String, required: true },
    description: { type: String, default: '' },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    capabilities: { type: [String], default: [] },
    systemPrompt: { type: String, default: '' },
    modelName: { type: String, default: 'gpt-4o' },
    temperature: { type: Number, default: 0.1, min: 0, max: 2 },
    maxTokens: { type: Number, default: 4096 },
    isActive: { type: Boolean, default: true },
    stats: {
      totalTasks: { type: Number, default: 0 },
      successRate: { type: Number, default: 0 },
      avgExecutionTimeMs: { type: Number, default: 0 },
      avgConfidence: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export const AIAgent = mongoose.model<IAIAgent>('AIAgent', aiAgentSchema);
