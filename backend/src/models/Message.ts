import mongoose, { Document, Schema } from 'mongoose';
import { Evidence, Source, Citation, QueryUnderstanding, SubTask, AgentType } from '../types';

export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  role: 'user' | 'assistant' | 'system';
  content: string;
  queryId?: mongoose.Types.ObjectId;
  // AI response fields
  answer?: string;
  summary?: string;
  keyFindings?: string[];
  evidence?: Evidence[];
  sources?: Source[];
  citations?: Citation[];
  confidence?: number;
  hasAnswer?: boolean;
  recommendations?: string[];
  expectedImpact?: string;
  risks?: string[];
  agentsUsed?: AgentType[];
  executionTimeMs?: number;
  queryUnderstanding?: QueryUnderstanding;
  subTasks?: SubTask[];
  tokenCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    queryId: { type: Schema.Types.ObjectId, ref: 'Query' },
    answer: String,
    summary: String,
    keyFindings: [String],
    evidence: [{ type: Schema.Types.Mixed }],
    sources: [{ type: Schema.Types.Mixed }],
    citations: [{ type: Schema.Types.Mixed }],
    confidence: Number,
    hasAnswer: Boolean,
    recommendations: [String],
    expectedImpact: String,
    risks: [String],
    agentsUsed: [String],
    executionTimeMs: Number,
    queryUnderstanding: { type: Schema.Types.Mixed },
    subTasks: [{ type: Schema.Types.Mixed }],
    tokenCount: Number,
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

export const Message = mongoose.model<IMessage>('Message', messageSchema);
