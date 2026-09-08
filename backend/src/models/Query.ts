import mongoose, { Document, Schema } from 'mongoose';
import { QueryUnderstanding, IntentType, AgentType, IntelligenceResponse } from '../types';

export interface IQuery extends Document {
  _id: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  originalQuery: string;
  queryUnderstanding?: QueryUnderstanding;
  intent?: IntentType;
  agentsUsed: AgentType[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: IntelligenceResponse;
  executionTimeMs?: number;
  tokenCount?: number;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const querySchema = new Schema<IQuery>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    originalQuery: { type: String, required: true },
    queryUnderstanding: { type: Schema.Types.Mixed },
    intent: { type: String },
    agentsUsed: { type: [String], default: [] },
    status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
    result: { type: Schema.Types.Mixed },
    executionTimeMs: Number,
    tokenCount: Number,
    errorMessage: String,
  },
  { timestamps: true }
);

querySchema.index({ userId: 1, createdAt: -1 });
querySchema.index({ organizationId: 1, createdAt: -1 });

export const Query = mongoose.model<IQuery>('Query', querySchema);
