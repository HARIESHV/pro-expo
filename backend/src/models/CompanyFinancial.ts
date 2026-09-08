import mongoose, { Document, Schema } from 'mongoose';

// ===========================================================================
// CompanyFinancial — cached periodic financial figures for a real-world
// company. Every record carries explicit provenance so consumers always know
// whether a figure is a real connected-data value ("reported") or a model /
// reference figure ("estimated"), with its source, confidence and timestamp.
//
// Records are keyed by company nameKey + period (e.g. "apple" + "2024"), so
// repeat analyses reuse prior retrievals instead of hitting the AI provider
// on every request. Historical records are never silently overwritten; a new
// retrieval updates the latest record's `retrievedAt` while preserving the
// point history.
// ===========================================================================

export type FinancialKind = 'reported' | 'estimated';

export interface ICompanyFinancialPoint extends Document {
  companyKey: string; // normalized company nameKey
  period: string; // "2024", "Q1 2025", ...
  year: number;
  revenue: number | null;
  profit: number | null;
  profitMarginPct: number | null;
  currency: string;
  kind: FinancialKind;
  source: string;
  sourceType: 'connected_data' | 'company_knowledge_base' | 'ai_reference';
  confidence: number | null;
  note?: string;
  retrievedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const companyFinancialSchema = new Schema<ICompanyFinancialPoint>(
  {
    companyKey: { type: String, required: true, lowercase: true, index: true },
    period: { type: String, required: true },
    year: { type: Number, required: true, index: true },
    revenue: { type: Number, default: null },
    profit: { type: Number, default: null },
    profitMarginPct: { type: Number, default: null },
    currency: { type: String, default: 'USD' },
    kind: { type: String, enum: ['reported', 'estimated'], required: true },
    source: { type: String, default: '' },
    sourceType: {
      type: String,
      enum: ['connected_data', 'company_knowledge_base', 'ai_reference'],
      required: true,
    },
    confidence: { type: Number, default: null, min: 0, max: 1 },
    note: String,
    retrievedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

companyFinancialSchema.index({ companyKey: 1, year: 1 });
companyFinancialSchema.index({ companyKey: 1, period: 1 }, { unique: true });

export const CompanyFinancial = mongoose.model<ICompanyFinancialPoint>('CompanyFinancial', companyFinancialSchema);