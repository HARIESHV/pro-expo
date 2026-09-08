import mongoose, { Document, Schema } from 'mongoose';

// ---------------------------------------------------------------------------
// Universal Company Knowledge — normalized company data model.
//
// A single shared, organization-independent store describing companies of all
// sizes (local businesses, startups, SMEs, mid-size, large, enterprises, MNCs,
// public/private/government/non-profit) plus their aliases, domains, stock
// tickers, parent/subsidiary/brand relationships, people, products and sources.
//
// Every field is optional — not every company will have every field — and the
// model is deliberately schema-flexible so newer/obscure companies can be
// represented without forcing data.
// ---------------------------------------------------------------------------

export type CompanyCategory =
  | 'micro'
  | 'small_business'
  | 'startup'
  | 'scaleup'
  | 'sme'
  | 'mid_size'
  | 'large'
  | 'enterprise'
  | 'mnc'
  | 'public'
  | 'private'
  | 'government'
  | 'nonprofit'
  | 'unknown';

export type OwnershipType = 'public' | 'private' | 'government' | 'nonprofit' | 'unknown';

export interface ICompanyLocation {
  city?: string;
  state?: string;
  country?: string;
  region?: string;
}

export interface ICompanyPerson {
  name: string;
  role?: string;
  sourceUrl?: string;
}

export interface ICompanyProduct {
  name: string;
  category?: string;
}

export interface ICompanySource {
  kind: 'official' | 'regulation' | 'registry' | 'financial' | 'news' | 'reference' | 'user';
  title: string;
  url?: string;
  retrievedAt?: Date;
  note?: string;
}

export interface ICompany extends Document {
  _id: mongoose.Types.ObjectId;
  // Identity
  legalName?: string;
  displayName: string;
  aliases: string[];
  nameKey: string; // normalized search key for dedup/entity resolution
  acronym?: string;
  companyType?: string;

  // Classification
  category?: CompanyCategory;
  ownership?: OwnershipType;
  industry?: string;
  subIndustry?: string;
  industries: string[];

  // Description
  description?: string;
  about?: string;

  // Origin
  foundedYear?: number;
  founders: ICompanyPerson[];

  // Location
  headquarters?: ICompanyLocation;
  countries: string[];
  regions: string[];

  // Web / identity
  website?: string;
  officialDomains: string[];

  // Relationships (kept distinct — never merge parent/subsidiary/brand)
  parentCompanyName?: string;
  parentCompanyId?: mongoose.Types.ObjectId;
  subsidiaries: Array<{ name: string; companyId?: mongoose.Types.ObjectId }>;
  brands: string[];
  acquisitions: string[];
  investments: string[];
  partners: string[];
  competitors: string[];

  // Size & finance
  employeeRange?: { min?: number; max?: number; approx?: string };
  revenue?: { amount?: number; currency?: string; year?: number; note?: string };
  marketCap?: { amount?: number; currency?: string; asOf?: Date };
  stockTicker?: string;
  stockExchange?: string;

  // Products/services/tech
  products: ICompanyProduct[];
  services: string[];
  technologies: string[];

  // People & careers
  leadership: ICompanyPerson[];
  careersUrl?: string;

  // Contact & social
  contactInformation?: Record<string, unknown>;
  contactEmail?: string;
  contactPhone?: string;
  socialLinks: Record<string, string>;

  // Evidence / provenance
  officialSources: ICompanySource[];
  dataSources: ICompanySource[];
  sourceUrls: string[];
  sourceDates: Date[];
  lastVerifiedAt?: Date;
  dataVersion?: string;
  sourceDate?: Date;
  dataConfidence: number; // 0..1 aggregate confidence

  // Status
  status?: 'active' | 'inactive' | 'acquired' | 'merged' | 'defunct';
  statusNote?: string;

  createdAt: Date;
  updatedAt: Date;
}

const locationSchema = new Schema<ICompanyLocation>(
  { city: String, state: String, country: String, region: String },
  { _id: false }
);

const personSchema = new Schema<ICompanyPerson>(
  { name: { type: String, required: true }, role: String, sourceUrl: String },
  { _id: false }
);

const productSchema = new Schema<ICompanyProduct>(
  { name: { type: String, required: true }, category: String },
  { _id: false }
);

const sourceSchema = new Schema<ICompanySource>(
  {
    kind: {
      type: String,
      enum: ['official', 'regulation', 'registry', 'financial', 'news', 'reference', 'user'],
      default: 'reference',
    },
    title: { type: String, required: true },
    url: String,
    retrievedAt: Date,
    note: String,
  },
  { _id: false }
);

const companySchema = new Schema<ICompany>(
  {
    legalName: String,
    displayName: { type: String, required: true, trim: true },
    aliases: { type: [String], default: [] },
    nameKey: { type: String, required: true, lowercase: true },
    acronym: String,
    companyType: String,

    category: String,
    ownership: String,
    industry: String,
    subIndustry: String,
    industries: { type: [String], default: [] },

    description: String,
    about: String,

    foundedYear: Number,
    founders: { type: [personSchema], default: [] },

    headquarters: locationSchema,
    countries: { type: [String], default: [] },
    regions: { type: [String], default: [] },

    website: String,
    officialDomains: { type: [String], default: [] },

    parentCompanyName: String,
    parentCompanyId: { type: Schema.Types.ObjectId, ref: 'Company' },
    subsidiaries: {
      type: [{ name: String, companyId: { type: Schema.Types.ObjectId, ref: 'Company' } }],
      default: [],
    },
    brands: { type: [String], default: [] },
    acquisitions: { type: [String], default: [] },
    investments: { type: [String], default: [] },
    partners: { type: [String], default: [] },
    competitors: { type: [String], default: [] },

    employeeRange: { min: Number, max: Number, approx: String },
    revenue: { amount: Number, currency: String, year: Number, note: String },
    marketCap: { amount: Number, currency: String, asOf: Date },
    stockTicker: String,
    stockExchange: String,

    products: { type: [productSchema], default: [] },
    services: { type: [String], default: [] },
    technologies: { type: [String], default: [] },

    leadership: { type: [personSchema], default: [] },
    careersUrl: String,

    contactInformation: Schema.Types.Mixed,
    contactEmail: String,
    contactPhone: String,
    socialLinks: { type: Schema.Types.Mixed, default: {} },

    officialSources: { type: [sourceSchema], default: [] },
    dataSources: { type: [sourceSchema], default: [] },
    sourceUrls: { type: [String], default: [] },
    sourceDates: { type: [Date], default: [] },
    lastVerifiedAt: Date,
    dataVersion: String,
    sourceDate: Date,
    dataConfidence: { type: Number, default: 0, min: 0, max: 1 },

    status: String,
    statusNote: String,
  },
  {
    timestamps: true,
    // Index builds for this collection are managed explicitly by
    // syncCompanyIndexes() (services/companyDataService.ts). A legacy, stale
    // schema left conflicting indexes (e.g. unique "companyId_1" on a removed
    // field, non-unique "nameKey_1") in the live collection; letting mongoose
    // auto-build in the background races with the reconciliation and re-creates
    // the conflicts (E11000 / IndexKeySpecsConflict). Disabling autoIndex here
    // keeps Company index management deterministic.
    autoIndex: false,
  }
);

// ---- Indexes for fast, non-full-scan lookups + dedup ----
companySchema.index({ nameKey: 1 }, { unique: true });
companySchema.index({ stockTicker: 1 });
companySchema.index({ stockExchange: 1 });
companySchema.index({ industry: 1 });
companySchema.index({ countries: 1 });
companySchema.index({ 'headquarters.country': 1 });
companySchema.index({ 'headquarters.city': 1 });
companySchema.index({ category: 1 });
companySchema.index({ ownership: 1 });
companySchema.index({ 'officialDomains': 1 });
// Full-text index over identity/searchable fields (kept lean, not the whole doc)
companySchema.index({
  displayName: 'text',
  legalName: 'text',
  aliases: 'text',
  industry: 'text',
  subIndustry: 'text',
  description: 'text',
  'products.name': 'text',
  technologies: 'text',
  competitors: 'text',
});

/** Normalize a name into its dedup/search key (lowercased, collapsed). */
export function toNameKey(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(inc|llc|ltd|corp|corporation|limited|company|co|pvt|private|limited|gmbh|sa|plc|s\\.p\\.a|technologies|technology|systems|group|holdings|industries|india)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const Company = mongoose.model<ICompany>('Company', companySchema);
