import mongoose, { Document, Schema } from 'mongoose';
import { DocumentChunkMetadata } from '../types';

export interface IDocumentChunk extends Document {
  _id: mongoose.Types.ObjectId;
  documentId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  content: string;
  embedding: number[];
  chunkIndex: number;
  totalChunks: number;
  metadata: DocumentChunkMetadata;
  createdAt: Date;
  updatedAt: Date;
}

const documentChunkSchema = new Schema<IDocumentChunk>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    content: { type: String, required: true },
    embedding: {
      type: [Number],
      required: true,
      // MongoDB Atlas Vector Search field — index defined in Atlas console
    },
    chunkIndex: { type: Number, required: true },
    totalChunks: { type: Number, required: true },
    metadata: {
      documentId: { type: String, required: true },
      organizationId: { type: String, required: true },
      department: String,
      author: String,
      createdDate: Date,
      modifiedDate: Date,
      accessLevel: {
        type: String,
        enum: ['public', 'internal', 'confidential', 'restricted', 'top_secret'],
        default: 'internal',
      },
      documentType: String,
      source: String,
      confidence: { type: Number, default: 1.0 },
      chunkIndex: Number,
      totalChunks: Number,
    },
  },
  { timestamps: true }
);

documentChunkSchema.index({ documentId: 1, chunkIndex: 1 });

// Full-text search index
documentChunkSchema.index({ content: 'text' });

/*
  MongoDB Atlas Vector Search index (create in Atlas UI or via CLI):
  {
    "fields": [{
      "type": "vector",
      "path": "embedding",
      "numDimensions": 3072,
      "similarity": "cosine"
    }, {
      "type": "filter",
      "path": "organizationId"
    }, {
      "type": "filter",
      "path": "metadata.accessLevel"
    }, {
      "type": "filter",
      "path": "metadata.department"
    }]
  }
*/

export const DocumentChunk = mongoose.model<IDocumentChunk>('DocumentChunk', documentChunkSchema);
