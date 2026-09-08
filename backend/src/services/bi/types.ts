import mongoose from 'mongoose';

// ===========================================================================
// Business Intelligence — shared types for the real-data BI engine.
//
// Every metric in this module is derived from records stored in MongoDB
// (SalesRecord, Customer, SupportTicket, Risk, Project, Employee, Department,
// Document) or a clearly-labelled forecast. No metric is invented on the
// client, and no metric is hardcoded here.
// ===========================================================================

export type TimeGranularity = 'auto' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';

export type AnalysisMode = 'past' | 'present' | 'future';

export type CompanyScale = 'short_term' | 'long_term';

export interface DataPoint {
  /** Machine-readable bucket key, e.g. "2026-Q2", "2026-03", "2026-W23", "2026-03-15". */
  key: string;
  /** Human readable bucket label used on charts. */
  label: string;
  /** Actual value (never forecast). */
  value: number;
  /** Number of underlying transactions aggregated into this point. */
  count: number;
  /** True when this bucket has zero actual records within the observed span. */
  missing?: boolean;
  /** Optional record id(s) backing the point (evidence). */
  sources?: string[];
}

export interface ForecastPoint {
  key: string;
  label: string;
  value: number;
  lowerBound?: number;
  upperBound?: number;
  /** Always "forecast" — never confused with actual data. */
  kind: 'forecast';
}

export interface PeriodBoundary {
  start: Date | null;
  end: Date | null;
  label: string;
}

export interface CompanyProfile {
  organizationId: string;
  scale: CompanyScale;
  /** Granularity auto-selected from the company's data. */
  preferredGranularity: Exclude<TimeGranularity, 'auto'>;
  /** Ordered granularities appropriate for the scale (user-switchable). */
  availableGranularities: Exclude<TimeGranularity, 'auto'>[];
  revenueScale: number;
  customerCount: number;
  transactionCount: number;
  supportTicketCount: number;
  activeRiskCount: number;
  dataSpan: PeriodBoundary;
  /** Reason string sent to the frontend so users can understand the auto choice. */
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

export interface GrowthInfo {
  /** Absolute change between per-newest (current) and previous period. */
  change: number;
  /** Percentage change; 0 when the previous period is 0. */
  growthPct: number | null;
  /**
   * Growth direction. When the previous value is null/zero we return
   * 'insufficient' instead of manufacturing a percentage.
   */
  direction: 'up' | 'down' | 'flat' | 'insufficient';
  current: number;
  previous: number | null;
  currentLabel: string;
  previousLabel: string;
}

export interface ForecastResult {
  available: boolean;
  reason?: string;
  requiredMinPoints: number;
  actualPoints: number;
  period: { startLabel: string; endLabel: string; horizon: string };
  direction: 'up' | 'down' | 'flat' | 'unknown';
  points: ForecastPoint[];
  /** Confidence 0..1 when computable (based on fit + data volume). */
  confidence: number | null;
  /** Historical basis (labels of the actual buckets used). */
  historicalBasis: string[];
  assumptions: string[];
  methodology: 'linear-regression' | 'none';
}

export interface RevenueInsight {
  current: number;
  previous: number | null;
  change: number;
  growthPct: number | null;
  direction: 'up' | 'down' | 'flat' | 'insufficient';
  currentLabel: string;
  previousLabel: string;
  pipeline: number;
  closedWonDeals: number;
  closedLostAmount: number;
  period: string;
}

export interface SalesBreakdown {
  byRegion: Array<{ key: string; revenue: number; count: number }>;
  byProduct: Array<{ key: string; revenue: number; count: number }>;
  byChannel: Array<{ key: string; revenue: number; count: number }>;
  byDept: Array<{ key: string; revenue: number; count: number }>;
  byWeek: Array<DataPoint>;
}

export interface SalesInsight {
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
}

export interface CustomerInsight {
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
  acquisitionTrend: DataPoint[];
  churnTrend: DataPoint[];
  topAtRisk: Array<{ name: string; company?: string; region: string; riskScore: number; ltv: number }>;
}

export interface FinanceInsight {
  revenue: number;
  expenses: ExpenseBreakdown;
  profit: number | null;
  profitMarginPct: number | null;
  costTrend: DataPoint[];
  notes: string[];
}

export interface ExpenseBreakdown {
  byBudget: number;
  byProjectCost: number;
  byPayroll: number;
  estimatedLabel: string;
  available: boolean;
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

export interface BusinessEvent {
  type:
    | 'revenue_decline'
    | 'revenue_growth'
    | 'customer_gained'
    | 'customer_churned'
    | 'customer_at_risk'
    | 'risk_detected'
    | 'document_added'
    | 'project_on_hold';
  title: string;
  detail: string;
  periodLabel: string;
  date: string;
  magnitude?: number;
  evidenceIds?: string[];
}

export interface PastAnalysis {
  analysisMode: 'past';
  period: PeriodBoundary;
  revenueSeries: DataPoint[];
  salesSeries: DataPoint[];
  customerSeries: DataPoint[];
  churnSeries: DataPoint[];
  events: BusinessEvent[];
  comparisons: {
    yoy: GrowthInfo | null;
    qoq: GrowthInfo | null;
    mom: GrowthInfo | null;
  };
  keyFindings: Array<{ finding: string; evidence: string[]; direction: 'growth' | 'decline' | 'flat' }>;
}

export interface PresentAnalysis {
  analysisMode: 'present';
  periodLabel: string;
  lastUpdatedAt: string;
  dataSourceLastUpdated: string | null;
  revenue: RevenueInsight;
  customers: CustomerInsight;
  operations: OperationsInsight;
  risks: Array<{ title: string; level: string; riskScore: number; category: string }>;
  anomaliesEnabled: boolean;
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

export interface AnomalyItem {
  metric: string;
  bucketLabel: string;
  value: number;
  expected: number | null;
  deviationPct: number | null;
  severity: 'low' | 'medium' | 'high';
  detail: string;
}

export interface AnomalyAnalysis {
  available: boolean;
  items: AnomalyItem[];
  thresholdPct: number;
  scannedBuckets: number;
}

export interface ComparisonInput {
  dimension: 'qoq' | 'yoy' | 'mom' | 'region' | 'product' | 'segment' | 'dept' | 'actual_vs_forecast';
  from?: string;
  to?: string;
}

export interface ComparisonResult {
  dimension: string;
  from: { label: string; value: number; count: number };
  to: { label: string; value: number; count: number };
  difference: number;
  growthPct: number | null;
  direction: 'up' | 'down' | 'flat' | 'insufficient';
  aiExplanation?: string;
  evidence: Array<{ label: string; detail: string }>;
}

export interface AIFinding {
  metric: string;
  finding: string;
  evidence: string[];
  likelyCause: string;
  businessImpact: string;
  recommendedAction: string;
}

export interface AIAnalysis {
  generatedAt: string;
  provider: string;
  basisPeriod: string;
  summary: string;
  findings: AIFinding[];
  risks: Array<{ title: string; description: string; probability: number; impact: number }>;
  opportunities: Array<{ title: string; detail: string }>;
  recommendations: string[];
  usedLiveData: boolean;
}

export interface BIRecommendation {
  priority: 'high' | 'medium' | 'low';
  action: string;
  rationale: string;
  evidence: string[];
  expectedOutcome: string;
}

export interface BISummary {
  companyProfile: CompanyProfile;
  validation: DataValidation;
  present: PresentAnalysis;
  past: PastAnalysis;
  future: FutureAnalysis;
  anomalies: AnomalyAnalysis;
  comparisons: Array<ComparisonResult>;
  lastUpdatedAt: string;
}

export interface AnalysisOptions {
  granularity?: TimeGranularity;
  start?: string;
  end?: string;
  limit?: number;
  horizon?: number;
}

export type OrgRef = mongoose.Types.ObjectId | string;