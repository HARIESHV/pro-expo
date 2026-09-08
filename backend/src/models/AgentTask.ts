import mongoose, { Document, Schema } from 'mongoose';
import { AgentType, TaskStatus, AgentResult } from '../types';

export interface IAgentTask extends Document {
  _id: mongoose.Types.ObjectId;
  queryId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  agentType: AgentType;
  description: string;
  status: TaskStatus;
  priority: number;
  dependencies: mongoose.Types.ObjectId[];
  input: Record<string, unknown>;
  result?: AgentResult;
  startedAt?: Date;
  completedAt?: Date;
  executionTimeMs?: number;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const agentTaskSchema = new Schema<IAgentTask>(
  {
    queryId: { type: Schema.Types.ObjectId, ref: 'Query', required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    agentType: {
      type: String,
      required: true,
      enum: ['master', 'rag', 'data_intelligence', 'analytics', 'finance', 'sales',
             'customer_intelligence', 'document_intelligence', 'data_query', 'risk', 'executive'],
    },
    description: { type: String, required: true },
    status: { type: String, enum: ['pending', 'in_progress', 'completed', 'failed'], default: 'pending' },
    priority: { type: Number, default: 5, min: 1, max: 10 },
    dependencies: [{ type: Schema.Types.ObjectId, ref: 'AgentTask' }],
    input: { type: Schema.Types.Mixed, default: {} },
    result: { type: Schema.Types.Mixed },
    startedAt: Date,
    completedAt: Date,
    executionTimeMs: Number,
    errorMessage: String,
  },
  { timestamps: true }
);

export const AgentTask = mongoose.model<IAgentTask>('AgentTask', agentTaskSchema);
