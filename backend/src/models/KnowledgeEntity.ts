import mongoose, { Document, Schema } from 'mongoose';
import { EntityType } from '../types';

export interface IKnowledgeEntity extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  name: string;
  type: EntityType;
  description?: string;
  properties: Record<string, unknown>;
  aliases: string[];
  embedding?: number[];
  confidence: number;
  sourceDocumentIds: mongoose.Types.ObjectId[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const knowledgeEntitySchema = new Schema<IKnowledgeEntity>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['customer', 'employee', 'product', 'project', 'department', 'organization', 'region', 'concept', 'event', 'metric', 'document', 'decision', 'risk', 'insight', 'query', 'conversation', 'topic'],
    },
    description: String,
    properties: { type: Schema.Types.Mixed, default: {} },
    aliases: { type: [String], default: [] },
    embedding: [Number],
    confidence: { type: Number, default: 1.0, min: 0, max: 1 },
    sourceDocumentIds: [{ type: Schema.Types.ObjectId, ref: 'Document' }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

knowledgeEntitySchema.index({ organizationId: 1, type: 1 });
knowledgeEntitySchema.index({ name: 'text', description: 'text', aliases: 'text' });

export const KnowledgeEntity = mongoose.model<IKnowledgeEntity>('KnowledgeEntity', knowledgeEntitySchema);
