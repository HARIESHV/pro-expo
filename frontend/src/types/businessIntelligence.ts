// ============================================================
// Business Intelligence — Frontend types for the real-data BI
// engine. Mirrors backend/src/services/bi/types.ts.
// ============================================================

export type TimeGranularity = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
export type AnalysisMode = 'past' | 'present' | 'future';
export type CompanyScale = 'short_term' | 'long_term';
export type GrowthDirection = 'up' | 'down' | 'flat' | 'insufficient';

export interface BiDataPoint {
  key: string;
  label: string;
  value: number;
  count: number;
  sources?: string[];
}

export interface BiForecastPoint {
  key: string;
  label: string;
  value: number;
  lowerBound?: number;
  upperBound?: number;
  kind: 'forecast';
}

export interface GrowthInfo {
  change: number;
  growthPct: number | null;
  direction: GrowthDirection;
  current: number;
  previous: number | null;
  currentLabel: string;
  previousLabel: string;
}

export interface CompanyProfile {
  organizationId: string;
  scale: CompanyScale;
  preferredGranularity: TimeGranularity;
  availableGranularities: TimeGranularity[];
  revenueScale: number;
  customerCount: number;
  transactionCount: number;
  supportTicketCount: number;
  activeRiskCount: number;
  dataSpan: { start: string | null; end: string | null; label: string };
  basisDescription: string;
}

export interface DataValidation {
  valid: boolean;
  rawSalesRecords: number;
  duplicatesDetected: number;
  missingValuesDetected: number;
  missingLabels: string[];
  normalizationApplied: string[];
  currencyUsed: string;
  notes: string[];
}

export interface RevenueAnalysis {
  profile: CompanyProfile;
  validation: DataValidation;
  granularity: TimeGranularity;
  scale: CompanyScale;
  series: BiDataPoint[];
  current: number;
  previous: number | null;
  change: number;
  growthPct: number | null;
  direction: GrowthDirection;
  currentLabel: string;
  previousLabel: string;
}

export interface SalesBreakdown {
  byRegion: Array<{ key: string; revenue: number; count: number }>;
  byProduct: Array<{ key: string; revenue: number; count: number }>;
  byChannel: Array<{ key: string; revenue: number; count: number }>;
  byDept: Array<{ key: string; revenue: number; count: number }>;
  byWeek: BiDataPoint[];
}

export interface SalesAnalysis {
  profile: {
    scale: CompanyScale;
    preferredGranularity: TimeGranularity;
    availableGranularities: TimeGranularity[];
    revenueScale: number;
    customerCount: number;
    transactionCount: number;
    basisDescription: string;
  };
  totalRevenue: number;
  totalDeals: number;
  closedWonDeals: number;
  closedLostDeals: number;
  averageDealSize: number | null;
  conversionRate: number | null;
  growth: GrowthInfo;
  breakdown: SalesBreakdown;
  bestProducts: Array<{ key: string; revenue: number; count: number }>;
  weakProducts: Array<{ key: string; revenue: number; count: number }>;
  closedWonSeries: BiDataPoint[];
  revenue: number;
}

export interface CustomerAnalysis {
  profile: { scale: CompanyScale };
  total: number;
  active: number;
  inactive: number;
  atRisk: number;
  churned: number;
  newCustomers: number;
  returningCustomers: number;
  growth: GrowthInfo;
  averageLtv: number | null;
  bySegment: Array<{ key: string; count: number; avgLtv: number }>;
  byRegion: Array<{ key: string; count: number }>;
  acquisitionTrend: BiDataPoint[];
  churnTrend: BiDataPoint[];
  topAtRisk: Array<{ name: string; company?: string; region: string; riskScore: number; ltv: number }>;
}

export interface FinanceAnalysis {
  profile: { scale: CompanyScale; preferredGranularity: TimeGranularity };
  granularity: TimeGranularity;
  revenue: number;
  profit: number | null;
  profitMarginPct: number | null;
  expenses: { byBudget: number; byProjectCost: number; byPayroll: number; estimatedLabel: string; available: boolean };
  costTrend: BiDataPoint[];
  notes: string[];
}

export interface OperationsInsight {
  orders: number;
  openTickets: number;
  openTicketsByPriority: Array<{ key: string; count: number }>;
  resolvedTickets: number;
  avgResolutionHours: number | null;
  satisfactionAvg: number | null;
  projectsOverBudget: Array<{ name: string; budget: number; actualCost: number }>;
  anomalies: Array<{ scope: string; metric: string; detail: string; severity: 'low' | 'medium' | 'high' }>;
}

export interface RevenueInsight {
  current: number;
  previous: number | null;
  change: number;
  growthPct: number | null;
  direction: GrowthDirection;
  currentLabel: string;
  previousLabel: string;
  pipeline: number;
  closedWonDeals: number;
  closedLostAmount: number;
  period: string;
}

export interface PresentAnalysis {
  analysisMode: 'present';
  periodLabel: string;
  lastUpdatedAt: string;
  dataSourceLastUpdated: string | null;
  revenue: RevenueInsight;
  customers: CustomerAnalysis;
  operations: OperationsInsight;
  risks: Array<{ title: string; level: string; riskScore: number; category: string }>;
  anomaliesEnabled: boolean;
}

export interface BusinessEvent {
  type: string;
  title: string;
  detail: string;
  periodLabel: string;
  date: string;
  magnitude?: number;
  evidenceIds?: string[];
}

export interface PastAnalysis {
  analysisMode: 'past';
  period: { start: string | null; end: string | null; label: string };
  revenueSeries: BiDataPoint[];
  salesSeries: BiDataPoint[];
  customerSeries: BiDataPoint[];
  churnSeries: BiDataPoint[];
  events: BusinessEvent[];
  comparisons: { yoy: GrowthInfo | null; qoq: GrowthInfo | null; mom: GrowthInfo | null };
  keyFindings: Array<{ finding: string; evidence: string[]; direction: 'growth' | 'decline' | 'flat' }>;
}

export interface ForecastResult {
  available: boolean;
  reason?: string;
  requiredMinPoints: number;
  actualPoints: number;
  period: { startLabel: string; endLabel: string; horizon: string };
  direction: 'up' | 'down' | 'flat' | 'unknown';
  points: BiForecastPoint[];
  confidence: number | null;
  historicalBasis: string[];
  assumptions: string[];
  methodology: 'linear-regression' | 'none';
}

export interface FutureAnalysis {
  analysisMode: 'future';
  revenueForecast: ForecastResult;
  salesForecast: ForecastResult;
  customerForecast: ForecastResult;
  riskForecast: Array<{ title: string; level: string; riskScore: number; likelihood: number; impact: number }>;
  opportunities: Array<{ title: string; detail: string; evidence: string[] }>;
  recommendations: string[];
}

export interface AnomalyAnalysis {
  available: boolean;
  items: Array<{ metric: string; bucketLabel: string; value: number; expected: number | null; deviationPct: number | null; severity: 'low' | 'medium' | 'high'; detail: string }>;
  thresholdPct: number;
  scannedBuckets: number;
}

export interface ComparisonResult {
  dimension: string;
  from: { label: string; value: number; count: number };
  to: { label: string; value: number; count: number };
  difference: number;
  growthPct: number | null;
  direction: GrowthDirection;
  evidence: Array<{ label: string; detail: string }>;
}

export interface BIRecommendation {
  priority: 'high' | 'medium' | 'low';
  action: string;
  rationale: string;
  evidence: string[];
  expectedOutcome: string;
}

export interface AIAnalysis {
  generatedAt: string;
  provider: string;
  basisPeriod: string;
  summary: string;
  findings: Array<{ metric: string; finding: string; evidence: string[]; likelyCause: string; businessImpact: string; recommendedAction: string }>;
  risks: Array<{ title: string; description: string; probability: number; impact: number }>;
  opportunities: Array<{ title: string; detail: string }>;
  recommendations: string[];
  usedLiveData: boolean;
}

export interface BISummary {
  companyProfile: CompanyProfile;
  validation: DataValidation;
  present: PresentAnalysis;
  past: PastAnalysis;
  future: FutureAnalysis;
  anomalies: AnomalyAnalysis;
  comparisons: ComparisonResult[];
  lastUpdatedAt: string;
}

// ============================================================
// Real-world Company Analysis (Long vs Short) — mirrors
// backend/src/types/businessIntelligence.ts.
// Every value carries provenance: reported | estimated | forecast.
// ============================================================

export type FinancialKind = 'reported' | 'estimated';
export type SourceType = 'connected_data' | 'company_knowledge_base' | 'ai_reference' | 'forecast';
export type Direction = 'up' | 'down' | 'flat' | 'insufficient' | 'unavailable';

export interface CompanyFinancialPoint {
  period: string;
  year: number;
  revenue: number | null;
  profit: number | null;
  profitMarginPct: number | null;
  kind: FinancialKind;
  sourceType: SourceType;
  source: string;
  confidence: number | null;
  currency: string;
  note?: string;
}

export interface CompanyForecastPoint {
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

export interface CompanyGrowthInfo {
  current: number | null;
  previous: number | null;
  change: number | null;
  growthPct: number | null;
  direction: Direction;
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

export interface CompanyPresentMetrics {
  period: string;
  dataSourceLabel: string;
  latestRevenue: number | null;
  previousRevenue: number | null;
  growthPct: number | null;
  direction: Direction;
  profit: number | null;
  profitMarginPct: number | null;
  latestRevenueLabel: string;
  currency: string;
  available: boolean;
  notes: string[];
}

export interface CompanyHistoricalPoint {
  periodLabel: string;
  year: number;
  revenue: number | null;
  revenueDisplay: string | null;
  growthPct: number | null;
  direction: 'up' | 'down' | 'flat' | 'unavailable';
  kind: FinancialKind;
}

export interface CompanyForesight {
  available: boolean;
  reason: string;
  basis: string[];
  horizonYears: number;
  trendDirection: 'up' | 'down' | 'flat' | 'unavailable';
  projectedGrowthPct: number | null;
  points: CompanyForecastPoint[];
}

export interface CompanyRiskItem {
  title: string;
  level: 'low' | 'medium' | 'high';
  description: string;
  evidence: string[];
}

export interface CompanyOpportunityItem {
  title: string;
  detail: string;
  evidence: string[];
}

export interface CompanyIntelligence {
  resolution: CompanyResolution;
  profile: CompanyProfileLite;
  historical: {
    available: boolean;
    points: CompanyHistoricalPoint[];
    yoyGrowth: CompanyGrowthInfo;
    keyFindings: string[];
    notes: string[];
  };
  present: CompanyPresentMetrics;
  future: CompanyForesight;
  momentum: Direction;
  risks: CompanyRiskItem[];
  opportunities: CompanyOpportunityItem[];
  notes: string[];
}

export interface CompanyRevenueTrend {
  company: string;
  currency: string;
  actual: Array<{ period: string; value: number | null; kind: FinancialKind }>;
  forecast: CompanyForecastPoint[];
}

export interface CompanyComparisonPoint {
  period: string;
  longGrowthPct: number | null;
  shortGrowthPct: number | null;
}

export interface CompanyComparison {
  long: { displayName: string; latestRevenue: number | null; growthPct: number | null; momentum: Direction };
  short: { displayName: string; latestRevenue: number | null; growthPct: number | null; momentum: Direction };
  revenueDelta: number | null;
  revenueRatio: number | null;
  growthDeltaPct: number | null;
  revenueLeader: 'long' | 'short' | 'tie' | 'unavailable';
  growthLeader: 'long' | 'short' | 'tie' | 'unavailable';
  normalization: { currency: string; basis: string };
  series: Array<{ period: string; longRevenue: number | null; shortRevenue: number | null }>;
  growthSeries: CompanyComparisonPoint[];
}

export interface CompanyAIInsights {
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

export interface CompanySourceItem {
  company: string;
  type: SourceType;
  title: string;
  detail: string;
  url?: string;
  retrievedAt?: string;
  confidence?: number | null;
}

export interface CompanyAnalysisResult {
  analyzedAt: string;
  lastUpdatedAt: string;
  companyQuery: { long: string; short: string };
  companies: { long: CompanyIntelligence; short: CompanyIntelligence };
  revenueTrend: { long: CompanyRevenueTrend; short: CompanyRevenueTrend };
  growthComparison: CompanyComparisonPoint[];
  comparison: CompanyComparison;
  aiInsights: CompanyAIInsights;
  sources: CompanySourceItem[];
  meta: {
    dataAvailable: boolean;
    forecastBasis: string;
    currencyNormalization: string;
    notes: string[];
    analysisId: string;
  };
}