import mongoose, { Document, Schema } from 'mongoose';
import { RelationshipType } from '../types';

export interface IKnowledgeRelationship extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  fromEntityId: mongoose.Types.ObjectId;
  toEntityId: mongoose.Types.ObjectId;
  relationshipType: RelationshipType;
  label: string;
  properties: Record<string, unknown>;
  confidence: number;
  weight: number;
  sourceDocumentIds: mongoose.Types.ObjectId[];
  validFrom?: Date;
  validUntil?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const knowledgeRelationshipSchema = new Schema<IKnowledgeRelationship>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    fromEntityId: { type: Schema.Types.ObjectId, ref: 'KnowledgeEntity', required: true },
    toEntityId: { type: Schema.Types.ObjectId, ref: 'KnowledgeEntity', required: true },
    relationshipType: {
      type: String,
      required: true,
      enum: ['purchased', 'contacted', 'belongs_to', 'works_for', 'works_on', 'reports_to', 'manages',
             'partners_with', 'competes_with', 'related_to', 'caused_by', 'causes', 'impacts',
             'owns', 'depends_on', 'mentions', 'references', 'created_from', 'supports',
             'contradicts', 'derived_from', 'associated_with', 'part_of', 'located_in', 'involves'],
    },
    label: { type: String, required: true },
    properties: { type: Schema.Types.Mixed, default: {} },
    confidence: { type: Number, default: 1.0, min: 0, max: 1 },
    weight: { type: Number, default: 1.0 },
    sourceDocumentIds: [{ type: Schema.Types.ObjectId, ref: 'Document' }],
    validFrom: Date,
    validUntil: Date,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

knowledgeRelationshipSchema.index({ organizationId: 1, fromEntityId: 1 });
knowledgeRelationshipSchema.index({ organizationId: 1, toEntityId: 1 });
knowledgeRelationshipSchema.index({ organizationId: 1, relationshipType: 1 });

export const KnowledgeRelationship = mongoose.model<IKnowledgeRelationship>('KnowledgeRelationship', knowledgeRelationshipSchema);
