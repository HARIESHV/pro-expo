import mongoose, { Document, Schema } from 'mongoose';

// ===========================================================================
// BusinessIntelligenceAnalysis — persisted results of a Long/Short company
// analysis run. Each run creates a NEW document (history is never
// overwritten); the latest run per company-pair is found by createdAt.
//
// Stored fields: company names, analysis date, historical data, latest data,
// forecast data, revenue + growth metrics, AI analysis, data sources, source
// timestamps, forecast timestamp and confidence/quality indicators.
// ===========================================================================

export interface IBusinessIntelligenceAnalysis extends Document {
  organizationId: mongoose.Types.ObjectId;
  createdById: mongoose.Types.ObjectId;
  mode: 'analyze' | 'refresh';
  pairKey: string; // `longNameKey|shortNameKey` for latest-run lookups
  longCompany: { query: string; nameKey: string; displayName: string };
  shortCompany: { query: string; nameKey: string; displayName: string };
  result: Record<string, unknown>;
  sourcesSummary: Array<{ company: string; type: string; source: string; retrievedAt?: string }>;
  forecastTimestamp: Date | null;
  confidence: number | null;
  status: 'completed' | 'failed';
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const businessIntelligenceSchema = new Schema<IBusinessIntelligenceAnalysis>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    mode: { type: String, enum: ['analyze', 'refresh'], default: 'analyze' },
    pairKey: { type: String, required: true, index: true },
    longCompany: {
      query: { type: String, required: true },
      nameKey: { type: String, default: '' },
      displayName: { type: String, default: '' },
    },
    shortCompany: {
      query: { type: String, required: true },
      nameKey: { type: String, default: '' },
      displayName: { type: String, default: '' },
    },
    result: { type: Schema.Types.Mixed, default: {} },
    sourcesSummary: { type: Schema.Types.Mixed, default: [] },
    forecastTimestamp: { type: Date, default: null },
    confidence: { type: Number, default: null },
    status: { type: String, enum: ['completed', 'failed'], default: 'completed' },
    errorMessage: String,
  },
  { timestamps: true }
);

businessIntelligenceSchema.index({ organizationId: 1, pairKey: 1, createdAt: -1 });

export const BusinessIntelligenceAnalysis = mongoose.model<IBusinessIntelligenceAnalysis>(
  'BusinessIntelligenceAnalysis',
  businessIntelligenceSchema
);