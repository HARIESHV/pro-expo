// ===========================================================================
// Business Intelligence — Real-World Company Analysis types.
//
// This module powers the BI dashboard's Long Company / Short Company
// workflow. Every value is explicitly typed with PROVENANCE so the frontend
// can always distinguish:
//    - reported data      (real, from the connected data source)
//    - estimated data     (AI-referenced / model-based figures)
//    - forecast data      (projections produced from available history)
//    - interpretation     (AI narrative built strictly from supplied data)
//
// The pipeline NEVER silently invents financial values. When data is missing
// the services return `available: false` + an honest reason string.
// ===========================================================================

/** Where a stored financial point came from. */
export type FinancialKind = 'reported' | 'estimated';

/** Is a number verified against the connected data source, or reference only? */
export type SourceType = 'connected_data' | 'company_knowledge_base' | 'ai_reference' | 'forecast';

export interface FinancialPoint {
  /** Period label, e.g. "2024" or "Q1 2025". */
  period: string;
  year: number;
  /** Revenue for the period (in `currency`). null when unavailable. */
  revenue: number | null;
  /** Net profit for the period when available; null otherwise. */
  profit: number | null;
  profitMarginPct: number | null;
  /** "reported" = real data-layer value; "estimated" = model/reference figure. */
  kind: FinancialKind;
  /** Provenance: which source produced this point. */
  sourceType: SourceType;
  /** Human readable source label (e.g. "Apple FY2024 10-K via company knowledge base"). */
  source: string;
  /** Confidence 0..1 for the point (estimated figures may be lower). */
  confidence: number | null;
  /// Currency code the amounts are expressed in.
  currency: string;
  note?: string;
  /** When the figure was retrieved/cached (ISO). */
  retrievedAt?: string;
}

export interface ForecastPoint {
  period: string;
  year: number;
  value: number;
  currency: string;
  kind: 'forecast';
  lowerBound: number | null;
  upperBound: number | null;
  confidence: number | null;
  basis: string;
}

export interface GrowthInfo {
  current: number | null;
  previous: number | null;
  change: number | null;
  growthPct: number | null;
  direction: 'up' | 'down' | 'flat' | 'insufficient' | 'unavailable';
  currentLabel: string;
  previousLabel: string;
}

export interface CompanyResolution {
  id: string | null;
  query: string;
  nameKey: string | null;
  displayName: string;
  legalName?: string;
  resolved: boolean;
  match: 'exact' | 'alias' | 'domain' | 'ticker' | 'text' | 'none';
}

/** Real-world profile facts extracted from the connected company knowledge base. */
export interface CompanyProfileLite {
  displayName: string;
  legalName?: string;
  aliases: string[];
  industry?: string;
  subIndustry?: string;
  description?: string;
  foundedYear?: number;
  founders: Array<{ name: string; role?: string }>;
  headquarters?: { city?: string; state?: string; country?: string; region?: string };
  countries: string[];
  region?: string;
  website?: string;
  parentCompanyName?: string;
  subsidiaries: string[];
  brands: string[];
  competitors: string[];
  employeeRange?: { min?: number; max?: number; approx?: string };
  stockTicker?: string;
  stockExchange?: string;
  products: Array<{ name: string; category?: string }>;
  services: string[];
  technologies: string[];
  leadership: Array<{ name: string; role?: string }>;
  dataConfidence?: number;
  status?: string;
  revenue?: { amount?: number; currency?: string; year?: number; note?: string };
  marketCap?: { amount?: number; currency?: string };
}

export interface PresentMetrics {
  /** Latest period with data. */
  period: string;
  dataSourceLabel: string;
  latestRevenue: number | null;
  previousRevenue: number | null;
  growthPct: number | null;
  direction: GrowthInfo['direction'];
  profit: number | null;
  profitMarginPct: number | null;
  latestRevenueLabel: string;
  currency: string;
  available: boolean;
  notes: string[];
}

export interface HistoricalPoint {
  periodLabel: string;
  year: number;
  revenue: number | null;
  revenueDisplay: string | null;
  growthPct: number | null;
  direction: 'up' | 'down' | 'flat' | 'unavailable';
  kind: FinancialKind;
}

export interface Foresight {
  available: boolean;
  reason: string;
  basis: string[];
  horizonYears: number;
  trendDirection: 'up' | 'down' | 'flat' | 'unavailable';
  projectedGrowthPct: number | null;
  points: ForecastPoint[];
}

export interface RiskItem {
  title: string;
  level: 'low' | 'medium' | 'high';
  description: string;
  evidence: string[];
}

export interface OpportunityItem {
  title: string;
  detail: string;
  evidence: string[];
}

/** Data-grounded strength or weakness (derived strictly from available data). */
export type StrengthWeaknessItem = OpportunityItem;

/** A revenue slice for a region/product/customer segment (clearly labelled). */
export interface SegmentRevenueItem {
  name: string;
  /** Revenue for the segment in `currency`. null when the source gave a share only. */
  revenue: number | null;
  /** Share of total revenue (0-100) when disclosed; null otherwise. */
  sharePct: number | null;
  currency: string;
  kind: FinancialKind;
  sourceType: SourceType;
  source: string;
  confidence: number | null;
  note?: string;
}

/** Per-company segment breakdowns collected from the connected data source. */
export interface CompanySegments {
  regions: SegmentRevenueItem[];
  products: SegmentRevenueItem[];
  customerSegments: SegmentRevenueItem[];
}

/** A deviation detected on the selected company's real time-series data. */
export interface AnomalyItem {
  period: string;
  metric: 'Revenue' | 'Revenue growth' | 'Net profit';
  value: number | null;
  expected: number | null;
  deviationPct: number | null;
  level: 'low' | 'medium' | 'high';
  description: string;
  evidence: string[];
}

/**
 * Capability map — which BI metrics can legitimately be shown for this company
 * given the data the connected source actually provides. Never "all true".
 */
export interface CompanyCapabilities {
  revenue: boolean;
  historicalRevenue: boolean;
  growth: boolean;
  revenueTrend: boolean;
  regionalRevenue: boolean;
  productRevenue: boolean;
  customerSegments: boolean;
  anomalies: boolean;
  accountRisks: boolean;
  operations: boolean;
  forecast: boolean;
}

/**
 * One consistent normalized data model per company — the shape handed to the
 * AI layer and mirrored to the frontend so every BI widget has a single,
 * company-tagged source of truth.
 */
export interface NormalizedCompanyData {
  company: {
    name: string;
    legalName?: string;
    ticker?: string;
    identifier: string;
    resolved: boolean;
  };
  financials: {
    currency: string;
    historical: FinancialPoint[];
    latest: {
      period: string;
      revenue: number | null;
      growthPct: number | null;
      profit: number | null;
      currency: string;
      kind: FinancialKind | 'none';
    } | null;
    growth: Array<{ period: string; growthPct: number | null }>;
    revenueTrend: Array<{ period: string; value: number | null; kind: 'reported' | 'estimated' | 'forecast' }>;
  };
  segments: CompanySegments;
  operations: Array<Record<string, unknown>>;
  risks: RiskItem[];
  anomalies: AnomalyItem[];
  metadata: {
    sources: string[];
    retrievedAt: string;
    availableMetrics: string[];
    unavailableMetrics: string[];
  };
}

/** Per-company intelligence assembled by the analysis workflow. */
export interface CompanyIntelligence {
  resolution: CompanyResolution;
  profile: CompanyProfileLite;
  historical: {
    available: boolean;
    points: HistoricalPoint[];
    yoyGrowth: GrowthInfo;
    keyFindings: string[];
    notes: string[];
  };
  present: PresentMetrics;
  future: Foresight;
  momentum: GrowthInfo['direction'];
  strengths: StrengthWeaknessItem[];
  weaknesses: StrengthWeaknessItem[];
  risks: RiskItem[];
  opportunities: OpportunityItem[];
  segments: CompanySegments;
  anomalies: AnomalyItem[];
  capabilities: CompanyCapabilities;
  normalized: NormalizedCompanyData;
  notes: string[];
}

export interface RevenueTrendSeries {
  company: string;
  currency: string;
  /** Reported/estimated points (chart as "actual/estimated"). */
  actual: Array<{ period: string; value: number | null; kind: FinancialKind }>;
  /** Forecast points. */
  forecast: ForecastPoint[];
}

export interface GrowthComparisonPoint {
  period: string;
  longGrowthPct: number | null;
  shortGrowthPct: number | null;
}

export interface ComparisonResult {
  long: { displayName: string; latestRevenue: number | null; growthPct: number | null; momentum: GrowthInfo['direction'] };
  short: { displayName: string; latestRevenue: number | null; growthPct: number | null; momentum: GrowthInfo['direction'] };
  revenueDelta: number | null;
  revenueRatio: number | null;
  growthDeltaPct: number | null;
  revenueLeader: 'long' | 'short' | 'tie' | 'unavailable';
  growthLeader: 'long' | 'short' | 'tie' | 'unavailable';
  normalization: { currency: string; basis: string };
  series: Array<{ period: string; longRevenue: number | null; shortRevenue: number | null }>;
  growthSeries: GrowthComparisonPoint[];
}

export interface AIInsights {
  executiveSummary: string;
  historicalInsights: string[];
  currentInsights: string[];
  futureOutlook: string;
  revenueAnalysis: string;
  growthAnalysis: string;
  riskAnalysis: string;
  opportunityAnalysis: string;
  longVsShortComparison: string;
  finalBusinessIntelligenceSummary: string;
  generatedAt: string;
  provider: string;
  basisNote: string;
}

export interface SourceItem {
  company: string;
  type: SourceType;
  title: string;
  detail: string;
  url?: string;
  retrievedAt?: string;
  confidence?: number | null;
}

export interface BusinessAnalysisResult {
  analyzedAt: string;
  lastUpdatedAt: string;
  companyQuery: { long: string; short: string };
  companies: { long: CompanyIntelligence; short: CompanyIntelligence };
  revenueTrend: { long: RevenueTrendSeries; short: RevenueTrendSeries };
  growthComparison: GrowthComparisonPoint[];
  comparison: ComparisonResult;
  aiInsights: AIInsights;
  sources: SourceItem[];
  meta: {
    dataAvailable: boolean;
    forecastBasis: string;
    currencyNormalization: string;
    notes: string[];
    analysisId: string;
  };
}

export interface AnalyzeRequest {
  longCompany: string;
  shortCompany: string;
  refresh?: boolean;
}