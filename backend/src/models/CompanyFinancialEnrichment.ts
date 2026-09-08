import mongoose, { Document, Schema } from 'mongoose';

// ===========================================================================
// CompanyFinancialEnrichment — cached per-company segment breakdowns
// (regional / product / customer segments) gathered by the research step for a
// single resolved company. Keyed by the same normalized `companyKey` used by
// CompanyFinancial, so segment data can never leak between companies.
//
// Every item is an AI-REFERENCED estimate (sourceType "ai_reference") unless
// the store records otherwise — it is never presented as verified reported
// data. Empty arrays mean the connected data source did not provide that
// dimension for this company.
// ===========================================================================

interface SegmentItem {
  name: string;
  revenue: number | null;
  sharePct: number | null;
  currency: string;
  source: string;
  confidence: number | null;
  note?: string;
}

export interface ICompanyFinancialEnrichment extends Document {
  companyKey: string;
  displayName: string;
  segments: {
    regions: SegmentItem[];
    products: SegmentItem[];
    customerSegments: SegmentItem[];
  };
  source: string;
  retrievedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const segmentItemSchema = new Schema<SegmentItem>(
  {
    name: { type: String, required: true, trim: true },
    revenue: { type: Number, default: null },
    sharePct: { type: Number, default: null },
    currency: { type: String, default: 'USD' },
    source: { type: String, default: '' },
    confidence: { type: Number, default: null },
    note: String,
  },
  { _id: false }
);

const companyFinancialEnrichmentSchema = new Schema<ICompanyFinancialEnrichment>(
  {
    companyKey: { type: String, required: true, index: true },
    displayName: { type: String, default: '' },
    segments: {
      regions: { type: [segmentItemSchema], default: [] },
      products: { type: [segmentItemSchema], default: [] },
      customerSegments: { type: [segmentItemSchema], default: [] },
    },
    source: { type: String, default: '' },
    retrievedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

companyFinancialEnrichmentSchema.index({ companyKey: 1 }, { unique: true });

export const CompanyFinancialEnrichment = mongoose.model<ICompanyFinancialEnrichment>(
  'CompanyFinancialEnrichment',
  companyFinancialEnrichmentSchema
);