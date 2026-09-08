import mongoose, { Document, Schema } from 'mongoose';
import { DocumentType, AccessLevel } from '../types';

export interface IDocument extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  documentType: DocumentType;
  filePath: string;
  organizationId: mongoose.Types.ObjectId;
  uploadedBy: mongoose.Types.ObjectId;
  departmentId?: mongoose.Types.ObjectId;
  accessLevel: AccessLevel;
  allowedRoles: string[];
  allowedUsers: mongoose.Types.ObjectId[];
  tags: string[];
  metadata: {
    author?: string;
    createdDate?: Date;
    modifiedDate?: Date;
    source?: string;
    language?: string;
    pageCount?: number;
    wordCount?: number;
    customFields?: Record<string, unknown>;
  };
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processingError?: string;
  chunksCount: number;
  isDeleted: boolean;
  collections: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<IDocument>(
  {
    title: { type: String, required: true, trim: true },
    description: String,
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, required: true },
    documentType: {
      type: String,
      required: true,
      enum: ['pdf', 'docx', 'doc', 'xlsx', 'csv', 'txt', 'email', 'transcript', 'api_data'],
    },
    filePath: { type: String, required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    accessLevel: {
      type: String,
      enum: ['public', 'internal', 'confidential', 'restricted', 'top_secret'],
      default: 'internal',
    },
    allowedRoles: { type: [String], default: [] },
    allowedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    tags: { type: [String], default: [] },
    metadata: {
      author: String,
      createdDate: Date,
      modifiedDate: Date,
      source: String,
      language: String,
      pageCount: Number,
      wordCount: Number,
      customFields: { type: Schema.Types.Mixed },
    },
    processingStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    processingError: String,
    chunksCount: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
    collections: [{ type: Schema.Types.ObjectId, ref: 'Collection' }],
  },
  { timestamps: true }
);

documentSchema.index({ organizationId: 1, isDeleted: 1 });
documentSchema.index({ title: 'text', description: 'text', tags: 'text' });
documentSchema.index({ processingStatus: 1 });

export const DocumentModel = mongoose.model<IDocument>('Document', documentSchema);
