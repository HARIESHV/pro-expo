import { BusinessIntelligenceAnalysis } from '../../models/BusinessIntelligenceAnalysis';
import { logger } from '../../config/logger';
import { resolveCompany } from './companyDataService';
import { getFinancialSeries } from './financialDataService';
import { analyzeHistorical } from './historicalDataService';
import { generateForecast } from './forecastService';
import { generateAIInsights } from './aiAnalysisService';
import { detectRevenueAnomalies } from './anomalyService';
import {
  AnalyzeRequest,
  AnomalyItem,
  BusinessAnalysisResult,
  CompanyCapabilities,
  CompanyIntelligence,
  CompanyProfileLite,
  CompanyResolution,
  CompanySegments,
  ComparisonResult,
  FinancialPoint,
  Foresight,
  GrowthInfo,
  HistoricalPoint,
  NormalizedCompanyData,
  OpportunityItem,
  PresentMetrics,
  RevenueTrendSeries,
  RiskItem,
  SourceItem,
} from '../../types/businessIntelligence';

// ===========================================================================
// businessIntelligenceService — orchestrates the full real-world company
// analysis workflow for the Business Intelligence dashboard:
//
//   User enters Long Company + Short Company
//   → Company Validation
//   → Real-world Data Retrieval
//   → Data Validation
//   → Historical Data
//   → Current Data
//   → Trend Calculation
//   → Revenue Analysis
//   → Growth Analysis
//   → AI Forecast
//   → Risk Analysis
//   → Opportunity Analysis
//   → Long vs Short Comparison
//   → AI Business Intelligence
//   → Sources + Data Timestamp
//   → React BI Dashboard
// ===========================================================================

export interface AnalyzeOptions extends AnalyzeRequest {
  mode?: 'analyze' | 'refresh';
}

export interface AnalysisContext {
  organizationId?: string;
  createdById?: string;
}

export async function analyzeCompanies(input: AnalyzeOptions, context: AnalysisContext = {}): Promise<BusinessAnalysisResult> {
  const longQuery = (input.longCompany || '').trim();
  const shortQuery = (input.shortCompany || '').trim();
  const mode = input.mode || (input.refresh ? 'refresh' : 'analyze');

  if (!longQuery || !shortQuery) {
    throw new Error('Both Long Company and Short Company are required.');
  }
  if (longQuery.length > 200 || shortQuery.length > 200) {
    throw new Error('Company names must be 200 characters or fewer.');
  }

  const analyzedAt = new Date();
  const refresh = mode === 'refresh';

  // 1. Resolve both companies in parallel.
  const [longResolved, shortResolved] = await Promise.all([
    resolveCompany(longQuery),
    resolveCompany(shortQuery),
  ]);

  // 2. Retrieve financial data (reported + AI-referenced estimates, cached).
  //    Analyze retrieves when no data exists yet; Refresh always re-retrieves.
  const [longFin, shortFin] = await Promise.all([
    getFinancialSeries({
      nameKey: longResolved.resolution.nameKey || longResolved.resolution.query.toLowerCase(),
      displayName: longResolved.resolution.displayName,
      profile: longResolved.profile,
      refresh,
      retrieveIfEmpty: !refresh,
    }),
    getFinancialSeries({
      nameKey: shortResolved.resolution.nameKey || shortResolved.resolution.query.toLowerCase(),
      displayName: shortResolved.resolution.displayName,
      profile: shortResolved.profile,
      refresh,
      retrieveIfEmpty: !refresh,
    }),
  ]);

  // Anomaly detection on each company's own retrieved time series (real data only).
  const longAnomalies = detectRevenueAnomalies(longResolved.resolution.displayName, longFin.points);
  const shortAnomalies = detectRevenueAnomalies(shortResolved.resolution.displayName, shortFin.points);

  logger.info(
    `[company-intelligence] BI retrieval (mode=${mode}): long="${longResolved.resolution.displayName}" ` +
      `[${longResolved.resolution.resolved ? 'resolved' : 'unresolved'}, ${longFin.points.length} financial period(s), ` +
      `latest=${seriesHint(longFin)}, regions=${longFin.segments.regions.length}, products=${longFin.segments.products.length}, ` +
      `anomalies=${longAnomalies.available ? longAnomalies.items.length : 'n/a'}]; ` +
      `short="${shortResolved.resolution.displayName}" ` +
      `[${shortResolved.resolution.resolved ? 'resolved' : 'unresolved'}, ${shortFin.points.length} financial period(s), ` +
      `latest=${seriesHint(shortFin)}, regions=${shortFin.segments.regions.length}, products=${shortFin.segments.products.length}, ` +
      `anomalies=${shortAnomalies.available ? shortAnomalies.items.length : 'n/a'}].`
  );

  // 3. Historical + present + forecast per company.
  const longHistorical = analyzeHistorical(longResolved.resolution.displayName, longFin.points);
  const shortHistorical = analyzeHistorical(shortResolved.resolution.displayName, shortFin.points);

  const longPresent = buildPresentMetrics(longResolved.resolution.displayName, longFin.points, longHistorical.yoyGrowth);
  const shortPresent = buildPresentMetrics(shortResolved.resolution.displayName, shortFin.points, shortHistorical.yoyGrowth);

  const longForecast = generateForecast(longFin.points, 3, longFin.currency);
  const shortForecast = generateForecast(shortFin.points, 3, shortFin.currency);

  // Capability map + normalized model per company, built strictly from each
  // company's own retrieved data.
  const longCapabilities = buildCapabilities({
    present: longPresent,
    historicalPoints: longHistorical.points,
    segments: longFin.segments,
    anomaliesAvailable: longAnomalies.available,
    future: longForecast,
  });
  const shortCapabilities = buildCapabilities({
    present: shortPresent,
    historicalPoints: shortHistorical.points,
    segments: shortFin.segments,
    anomaliesAvailable: shortAnomalies.available,
    future: shortForecast,
  });

  // 4. Deterministic risks & opportunities derived from available data.
  const longRisks = deriveRisks(longResolved.resolution.displayName, longResolved.resolution.resolved, longPresent, longForecast);
  const shortRisks = deriveRisks(shortResolved.resolution.displayName, shortResolved.resolution.resolved, shortPresent, shortForecast);
  const longOpps = deriveOpportunities(longResolved.resolution.displayName, longPresent, longForecast);
  const shortOpps = deriveOpportunities(shortResolved.resolution.displayName, shortPresent, shortForecast);
  const longStrengths = deriveStrengths(longResolved.resolution.displayName, longResolved.resolution.resolved, longResolved.profile, longPresent, longForecast);
  const shortStrengths = deriveStrengths(shortResolved.resolution.displayName, shortResolved.resolution.resolved, shortResolved.profile, shortPresent, shortForecast);
  const longWeaknesses = deriveWeaknesses(longResolved.resolution.displayName, longResolved.resolution.resolved, longPresent, longForecast);
  const shortWeaknesses = deriveWeaknesses(shortResolved.resolution.displayName, shortResolved.resolution.resolved, shortPresent, shortForecast);

  const longName = longResolved.resolution.displayName;
  const shortName = shortResolved.resolution.displayName;

  const long: CompanyIntelligence = {
    resolution: longResolved.resolution,
    profile: longResolved.profile,
    historical: { available: longHistorical.available, points: longHistorical.points, yoyGrowth: longHistorical.yoyGrowth, keyFindings: longHistorical.keyFindings, notes: longHistorical.notes },
    present: longPresent,
    future: longForecast,
    momentum: longPresent.direction,
    strengths: longStrengths,
    weaknesses: longWeaknesses,
    risks: longRisks,
    opportunities: longOpps,
    segments: longFin.segments,
    anomalies: longAnomalies.items,
    capabilities: longCapabilities,
    normalized: buildNormalized({
      resolution: longResolved.resolution,
      profile: longResolved.profile,
      points: longFin.points,
      present: longPresent,
      historical: longHistorical,
      future: longForecast,
      segments: longFin.segments,
      risks: longRisks,
      anomalies: longAnomalies.items,
      capabilities: longCapabilities,
      sourceTitles: longFin.sources.map((s) => s.title),
      retrievedAt: analyzedAt.toISOString(),
    }),
    notes: [...longFin.notes, ...longHistorical.notes],
  };
  const short: CompanyIntelligence = {
    resolution: shortResolved.resolution,
    profile: shortResolved.profile,
    historical: { available: shortHistorical.available, points: shortHistorical.points, yoyGrowth: shortHistorical.yoyGrowth, keyFindings: shortHistorical.keyFindings, notes: shortHistorical.notes },
    present: shortPresent,
    future: shortForecast,
    momentum: shortPresent.direction,
    strengths: shortStrengths,
    weaknesses: shortWeaknesses,
    risks: shortRisks,
    opportunities: shortOpps,
    segments: shortFin.segments,
    anomalies: shortAnomalies.items,
    capabilities: shortCapabilities,
    normalized: buildNormalized({
      resolution: shortResolved.resolution,
      profile: shortResolved.profile,
      points: shortFin.points,
      present: shortPresent,
      historical: shortHistorical,
      future: shortForecast,
      segments: shortFin.segments,
      risks: shortRisks,
      anomalies: shortAnomalies.items,
      capabilities: shortCapabilities,
      sourceTitles: shortFin.sources.map((s) => s.title),
      retrievedAt: analyzedAt.toISOString(),
    }),
    notes: [...shortFin.notes, ...shortHistorical.notes],
  };

  // 5. Revenue trend series + comparison (deterministic).
  const revenueTrend = {
    long: buildTrendSeries(longResolved.resolution.displayName, longFin.points, longForecast.points, longFin.currency),
    short: buildTrendSeries(shortResolved.resolution.displayName, shortFin.points, shortForecast.points, shortFin.currency),
  };
  const growthComparison = buildGrowthComparison(longHistorical.points, shortHistorical.points);
  const comparison = buildComparison(long, short, longFin.currency, shortFin.currency);

  // 6. AI Business Intelligence (interprets only the supplied structured data).
  const aiInsights = await generateAIInsights(long, short);

  // 7. Sources + timestamps.
  const sources: SourceItem[] = [];
  for (const s of longFin.sources) {
    sources.push({ company: longResolved.resolution.displayName, type: s.type, title: s.title, detail: s.detail, retrievedAt: s.retrievedAt, confidence: s.confidence });
  }
  for (const s of shortFin.sources) {
    sources.push({ company: shortResolved.resolution.displayName, type: s.type, title: s.title, detail: s.detail, retrievedAt: s.retrievedAt, confidence: s.confidence });
  }
  if (longResolved.resolution.resolved) {
    sources.push({
      company: longResolved.resolution.displayName,
      type: 'company_knowledge_base',
      title: 'Company knowledge base profile',
      detail: `Real profile data (industry, products, competitors, size) with confidence ${longResolved.profile.dataConfidence ?? 'n/a'}.`,
    });
  }
  if (shortResolved.resolution.resolved) {
    sources.push({
      company: shortResolved.resolution.displayName,
      type: 'company_knowledge_base',
      title: 'Company knowledge base profile',
      detail: `Real profile data (industry, products, competitors, size) with confidence ${shortResolved.profile.dataConfidence ?? 'n/a'}.`,
    });
  }

  // 8. Persist to MongoDB (new document per run — history is preserved).
  const hasData = longFin.available || shortFin.available;
  let docId: string | null = null;
  if (context.organizationId) {
    const created = await BusinessIntelligenceAnalysis.create({
      organizationId: context.organizationId,
      createdById: context.createdById,
      mode,
      pairKey: `${longResolved.resolution.nameKey || longResolved.resolution.query}|${shortResolved.resolution.nameKey || shortResolved.resolution.query}`,
      longCompany: longResolved.resolution,
      shortCompany: shortResolved.resolution,
      result: {
        companies: { long, short },
        revenueTrend,
        growthComparison,
        comparison,
        aiInsights,
        sources,
      },
      sourcesSummary: sources.map((s) => ({ company: s.company, type: s.type, source: s.title, retrievedAt: s.retrievedAt })),
      forecastTimestamp: longForecast.available || shortForecast.available ? analyzedAt : null,
      confidence: averageConfidence([...longForecast.points, ...shortForecast.points]),
      status: 'completed',
    });
    docId = String(created._id);
  }

  const sourcesSummaryWithMeta = sources;

  const result: BusinessAnalysisResult = {
    analyzedAt: analyzedAt.toISOString(),
    lastUpdatedAt: analyzedAt.toISOString(),
    companyQuery: { long: longQuery, short: shortQuery },
    companies: { long, short },
    revenueTrend,
    growthComparison,
    comparison,
    aiInsights,
    sources: sourcesSummaryWithMeta,
    meta: {
      dataAvailable: hasData,
      forecastBasis:
        longForecast.available || shortForecast.available
          ? `Forecast based on available historical data (${longForecast.basis.length} periods for ${longResolved.resolution.displayName}; ${shortForecast.basis.length} for ${shortResolved.resolution.displayName}).`
          : 'Forecasting unavailable — insufficient historical data.',
      currencyNormalization: comparison.normalization.basis,
      notes: [
        ...(hasData ? [] : ['No reliable financial data available for the selected companies.']),
        ...(longQuery.toLowerCase() === shortQuery.toLowerCase() ? ['Long and Short company are the same entity — comparison shows ties where data matches.'] : []),
      ],
      analysisId: docId || '',
    },
  };

  logger.info(`[company-intelligence] BI analysis completed (mode=${mode}): ${longResolved.resolution.displayName} vs ${shortResolved.resolution.displayName}`);
  return result;
}

export async function getLatestAnalysis(orgId: string, longQuery: string, shortQuery: string) {
  const { resolveCompany } = await import('./companyDataService');
  const [l, s] = await Promise.all([resolveCompany(longQuery), resolveCompany(shortQuery)]);
  const pairKey = `${l.resolution.nameKey || longQuery}|${s.resolution.nameKey || shortQuery}`;
  const doc = await BusinessIntelligenceAnalysis.findOne({ organizationId: orgId, pairKey }).sort({ createdAt: -1 }).lean();
  if (!doc) return null;

  // Reconstruct the public BusinessAnalysisResult shape from the stored run.
  const stored = (doc.result ?? {}) as Record<string, unknown>;
  const companies = stored.companies as BusinessAnalysisResult['companies'];
  const hasData =
    stored.hasData === true ||
    !!companies?.long?.present?.available ||
    !!companies?.short?.present?.available;
  return {
    analyzedAt: (doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString()),
    lastUpdatedAt: (doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString()),
    companyQuery: { long: doc.longCompany.query, short: doc.shortCompany.query },
    companies,
    revenueTrend: stored.revenueTrend as BusinessAnalysisResult['revenueTrend'],
    growthComparison: stored.growthComparison as BusinessAnalysisResult['growthComparison'],
    comparison: stored.comparison as BusinessAnalysisResult['comparison'],
    aiInsights: stored.aiInsights as BusinessAnalysisResult['aiInsights'],
    sources: (stored.sources ?? []) as BusinessAnalysisResult['sources'],
    meta: {
      dataAvailable: hasData,
      forecastBasis: doc.forecastTimestamp
        ? 'Forecast based on available historical data (stored run).'
        : 'Forecasting unavailable — insufficient historical data.',
      currencyNormalization: (stored.comparison as { normalization?: { basis?: string } } | undefined)?.normalization?.basis ?? 'USD',
      notes: stored.notes as string[] ?? [],
      analysisId: String(doc._id),
    },
  } as BusinessAnalysisResult;
}

// ---------------------------------------------------------------------------
// Present metrics
// ---------------------------------------------------------------------------
function buildPresentMetrics(displayName: string, series: FinancialPoint[], yoy: GrowthInfo): PresentMetrics {
  const withRevenue = series.filter((p) => p.revenue != null).sort((a, b) => a.year - b.year);
  if (withRevenue.length === 0) {
    return {
      period: 'Data unavailable',
      dataSourceLabel: '',
      latestRevenue: null,
      previousRevenue: null,
      growthPct: null,
      direction: 'unavailable',
      profit: null,
      profitMarginPct: null,
      latestRevenueLabel: 'Data unavailable',
      currency: 'USD',
      available: false,
      notes: [`No reliable financial data available for ${displayName} from the connected data sources.`],
    };
  }
  const latest = withRevenue[withRevenue.length - 1];
  const previous = withRevenue.length > 1 ? withRevenue[withRevenue.length - 2] : null;
  const growthPct = previous && previous.revenue ? ((latest.revenue! - previous.revenue) / previous.revenue) * 100 : null;
  const direction: PresentMetrics['direction'] =
    growthPct == null ? 'insufficient' : Math.abs(growthPct) < 1e-9 ? 'flat' : growthPct > 0 ? 'up' : 'down';
  return {
    period: latest.period,
    dataSourceLabel: latest.kind === 'reported' ? 'Reported (connected data source)' : 'AI-referenced estimate',
    latestRevenue: latest.revenue,
    previousRevenue: previous?.revenue ?? null,
    growthPct: growthPct != null ? Math.round(growthPct * 10) / 10 : null,
    direction,
    profit: latest.profit ?? null,
    profitMarginPct: latest.profitMarginPct ?? null,
    latestRevenueLabel: latest.period,
    currency: latest.currency || 'USD',
    available: true,
    notes: [
      `Latest available data period: ${latest.period} (${latest.kind === 'reported' ? 'reported' : 'estimated'} figure).`,
      ...(yoy.direction === 'unavailable' ? ['YoY growth not computable from available data.'] : []),
    ],
  };
}

// ---------------------------------------------------------------------------
// Data-grounded risks & opportunities (never derived from invented values)
// ---------------------------------------------------------------------------
type ForesightLite = Foresight;

function deriveRisks(
  displayName: string,
  resolved: boolean,
  present: PresentMetrics,
  forecast: ForesightLite
): RiskItem[] {
  const risks: RiskItem[] = [];
  if (present.growthPct != null && present.growthPct < 0) {
    risks.push({
      title: `Revenue declining ${Math.abs(present.growthPct)}% (${present.period})`,
      level: present.growthPct <= -10 ? 'high' : 'medium',
      description: `Latest available revenue decreased ${Math.abs(present.growthPct)}% versus the previous period (data source: ${present.dataSourceLabel || 'connected data sources'}).`,
      evidence: [`Latest revenue: ${present.latestRevenue?.toLocaleString() ?? 'n/a'}`, `Previous: ${present.previousRevenue?.toLocaleString() ?? 'n/a'}`],
    });
  }
  if (present.profit != null && present.profit < 0) {
    risks.push({
      title: 'Negative latest available profit',
      level: 'high',
      description: `Latest available net profit is negative (${present.currency}).`,
      evidence: ['Profit figure from data layer (estimated/reported as labelled).'],
    });
  }
  if (forecast.available && forecast.trendDirection === 'down') {
    risks.push({
      title: 'Model forecast projects declining revenue',
      level: 'medium',
      description: `${displayName} revenue trend projects downward over the forecast horizon. This is a forecast (prediction), not a guaranteed result.`,
      evidence: ['Forecast generated from available historical values.'],
    });
  }
  if (!resolved) {
    risks.push({
      title: 'Company not found in the connected knowledge base',
      level: 'low',
      description: `${displayName} could not be resolved to a profile in the connected company knowledge base, so business-context facts (products, competitors, size) are unavailable.`,
      evidence: [],
    });
  }
  if (present.latestRevenue == null) {
    risks.push({
      title: 'Financial data gap',
      level: 'low',
      description: 'No reliable financial figures are connected for this company; revenue, growth, profit and forecast metrics are therefore limited.',
      evidence: [],
    });
  }
  return risks;
}

function deriveOpportunities(displayName: string, present: PresentMetrics, forecast: ForesightLite): OpportunityItem[] {
  const opps: OpportunityItem[] = [];
  if (present.growthPct != null && present.growthPct > 0) {
    opps.push({
      title: 'Revenue growing',
      detail: `${displayName}'s latest available revenue grew ${present.growthPct}% (${present.period}) versus the previous period.`,
      evidence: [`Latest revenue: ${present.latestRevenue?.toLocaleString() ?? 'n/a'}`],
    });
  }
  if (present.profit != null && present.profit > 0 && present.profitMarginPct != null) {
    opps.push({
      title: 'Positive latest profitability',
      detail: `Latest available profit margin is ${present.profitMarginPct}%.`,
      evidence: [`Profit: ${present.profit.toLocaleString()} ${present.currency}`],
    });
  }
  if (forecast.available && forecast.trendDirection === 'up') {
    opps.push({
      title: 'Model forecast projects revenue growth',
      detail: `Revenue trend projects upward over the forecast horizon. Forecast (prediction), not a guaranteed result.`,
      evidence: ['Forecast generated from available historical values.'],
    });
  }
  return opps;
}

// ---------------------------------------------------------------------------
// Data-grounded strengths & weaknesses (also never derived from invented values)
// ---------------------------------------------------------------------------
function deriveStrengths(
  displayName: string,
  resolved: boolean,
  profile: { revenue?: { amount?: number; currency?: string; year?: number; note?: string }; marketCap?: { amount?: number; currency?: string } },
  present: PresentMetrics,
  forecast: ForesightLite
): OpportunityItem[] {
  const strengths: OpportunityItem[] = [];
  if (resolved) {
    strengths.push({
      title: 'Identified in the connected knowledge base',
      detail: `${displayName} was resolved to a real company profile in the connected company knowledge base (real business-context facts available).`,
      evidence: ['Resolution: company knowledge base match'],
    });
  }
  if (profile.marketCap?.amount != null) {
    strengths.push({
      title: 'Market capitalization recorded',
      detail: `A market capitalization figure is recorded in the connected data source.`,
      evidence: [`Market cap: ${profile.marketCap.amount.toLocaleString()} ${(profile.marketCap.currency || 'USD').toUpperCase()}`],
    });
  }
  if (present.latestRevenue != null) {
    strengths.push({
      title: 'Latest revenue available',
      detail: `${displayName} has a latest available revenue figure (${present.latestRevenueLabel}).`,
      evidence: [`Latest revenue: ${present.latestRevenue.toLocaleString()} ${present.currency}`],
    });
  }
  if (present.growthPct != null && present.growthPct > 0) {
    strengths.push({
      title: 'Latest revenue growing',
      detail: `Latest available revenue grew ${present.growthPct}% versus the previous recorded period (${present.period}).`,
      evidence: [`Growth: +${present.growthPct}%`],
    });
  }
  if (present.profit != null && present.profit > 0) {
    strengths.push({
      title: 'Latest available profitability positive',
      detail: `Latest recorded net profit is positive${present.profitMarginPct != null ? ` (margin ${present.profitMarginPct}%)` : ''}.`,
      evidence: [`Profit: ${present.profit.toLocaleString()} ${present.currency}`],
    });
  }
  if (forecast.available && forecast.trendDirection === 'up') {
    strengths.push({
      title: 'Model forecast points upward',
      detail: 'The deterministic forecast projects rising revenue over the horizon. Forecast (prediction), not guaranteed.',
      evidence: ['Forecast from available historical values'],
    });
  }
  return strengths;
}

function deriveWeaknesses(
  displayName: string,
  resolved: boolean,
  present: PresentMetrics,
  forecast: ForesightLite
): OpportunityItem[] {
  const weaknesses: OpportunityItem[] = [];
  if (!resolved) {
    weaknesses.push({
      title: 'Not identified in the connected knowledge base',
      detail: `${displayName} could not be resolved to a company profile, so business-context facts (products, competitors, size) are unavailable.`,
      evidence: [],
    });
  }
  if (present.latestRevenue == null) {
    weaknesses.push({
      title: 'Financial data gap',
      detail: 'No reliable financial figures are connected for this company; revenue, growth, profit and forecast metrics are limited.',
      evidence: [],
    });
  }
  if (present.growthPct != null && present.growthPct < 0) {
    weaknesses.push({
      title: 'Latest revenue declining',
      detail: `Latest available revenue declined ${Math.abs(present.growthPct)}% versus the previous recorded period (${present.period}).`,
      evidence: [`Growth: ${present.growthPct}%`],
    });
  }
  if (present.profit != null && present.profit < 0) {
    weaknesses.push({
      title: 'Latest available profit negative',
      detail: `Latest recorded net profit is negative.`,
      evidence: [`Profit: ${present.profit.toLocaleString()} ${present.currency}`],
    });
  }
  if (forecast.available && forecast.trendDirection === 'down') {
    weaknesses.push({
      title: 'Model forecast projects decline',
      detail: 'The deterministic forecast projects falling revenue over the horizon. Forecast (prediction), not guaranteed.',
      evidence: ['Forecast from available historical values'],
    });
  }
  return weaknesses;
}

// ---------------------------------------------------------------------------
// Trend series + comparisons
// ---------------------------------------------------------------------------
function buildTrendSeries(
  displayName: string,
  points: FinancialPoint[],
  forecast: Extract<ReturnType<typeof generateForecast>, { points: Array<{ period: string; value: number }> }>['points'],
  currency: string
): RevenueTrendSeries {
  return {
    company: displayName,
    currency,
    actual: points
      .filter((p) => p.revenue != null)
      .map((p) => ({ period: p.period, value: p.revenue, kind: p.kind })),
    forecast: forecast.map((f) => ({ ...f })),
  };
}

function buildGrowthComparison(longPts: CompanyIntelligence['historical']['points'], shortPts: CompanyIntelligence['historical']['points']) {
  const longByYear = new Map<number, number | null>();
  for (const p of longPts) longByYear.set(p.year, p.growthPct);
  const shortByYear = new Map<number, number | null>();
  for (const p of shortPts) shortByYear.set(p.year, p.growthPct);
  const years = new Set<number>([...longByYear.keys(), ...shortByYear.keys()]);
  return [...years]
    .sort((a, b) => a - b)
    .map((year) => ({
      period: String(year),
      longGrowthPct: longByYear.get(year) ?? null,
      shortGrowthPct: shortByYear.get(year) ?? null,
    }));
}

function buildComparison(
  long: CompanyIntelligence,
  short: CompanyIntelligence,
  longCurrency: string,
  shortCurrency: string
): ComparisonResult {
  const lRev = long.present.latestRevenue;
  const sRev = short.present.latestRevenue;
  const lGrowth = long.present.growthPct;
  const sGrowth = short.present.growthPct;

  const revenueDelta = lRev != null && sRev != null ? lRev - sRev : null;
  const revenueRatio = lRev != null && sRev != null && sRev > 0 ? lRev / sRev : null;
  const growthDeltaPct = lGrowth != null && sGrowth != null ? Math.round((lGrowth - sGrowth) * 10) / 10 : null;

  const revenueLeader: ComparisonResult['revenueLeader'] =
    lRev == null || sRev == null ? 'unavailable' : Math.abs(lRev - sRev) < 1e-6 ? 'tie' : lRev > sRev ? 'long' : 'short';
  const growthLeader: ComparisonResult['growthLeader'] =
    lGrowth == null || sGrowth == null ? 'unavailable' : Math.abs(lGrowth - sGrowth) < 1e-9 ? 'tie' : lGrowth > sGrowth ? 'long' : 'short';

  const longMap = new Map<number, number | null>();
  for (const p of long.historical.points) longMap.set(p.year, p.revenue);
  const shortMap = new Map<number, number | null>();
  for (const p of short.historical.points) shortMap.set(p.year, p.revenue);
  const years = new Set<number>([...longMap.keys(), ...shortMap.keys()]);
  const series = [...years]
    .sort((a, b) => a - b)
    .map((year) => ({
      period: String(year),
      longRevenue: longMap.get(year) ?? null,
      shortRevenue: shortMap.get(year) ?? null,
    }));

  const sameCurrency = longCurrency === shortCurrency;
  const normalization = {
    currency: 'USD' as const,
    basis: sameCurrency
      ? `All comparative figures are expressed in ${longCurrency}.`
      : `Figures normalized to USD for comparison. ${long.resolution.displayName} figures in ${longCurrency}; ${short.resolution.displayName} in ${shortCurrency}. Non-USD AI-referenced estimates were converted to USD by the research step (basis: average annual FX). Label: ai_reference.`,
  };

  return {
    long: { displayName: long.resolution.displayName, latestRevenue: lRev, growthPct: lGrowth, momentum: long.momentum },
    short: { displayName: short.resolution.displayName, latestRevenue: sRev, growthPct: sGrowth, momentum: short.momentum },
    revenueDelta,
    revenueRatio: revenueRatio != null ? Math.round(revenueRatio * 100) / 100 : null,
    growthDeltaPct,
    revenueLeader,
    growthLeader,
    normalization,
    series,
    growthSeries: buildGrowthComparison(long.historical.points, short.historical.points),
  };
}

function averageConfidence(points: Array<{ confidence?: number | null }>): number | null {
  const vals = points.map((p) => p.confidence).filter((c): c is number => typeof c === 'number' && Number.isFinite(c));
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
}

function seriesHint(fin: { points: FinancialPoint[] }): string {
  if (!fin.points.length) return 'none';
  const latest = [...fin.points].sort((a, b) => b.year - a.year)[0];
  return latest.revenue != null ? `${latest.year} (~$${Math.round(latest.revenue / 1e6)}M)` : `${latest.year}`;
}

// ---------------------------------------------------------------------------
// Capability map + normalized per-company data model
// ---------------------------------------------------------------------------
function buildCapabilities(deps: {
  present: PresentMetrics;
  historicalPoints: HistoricalPoint[];
  segments: CompanySegments;
  anomaliesAvailable: boolean;
  future: Foresight;
}): CompanyCapabilities {
  const withRevenue = deps.historicalPoints.filter((p) => p.revenue != null);
  return {
    revenue: deps.present.latestRevenue != null,
    historicalRevenue: withRevenue.length >= 1,
    growth: deps.present.growthPct != null || deps.historicalPoints.some((p) => p.growthPct != null),
    revenueTrend: withRevenue.length >= 2,
    regionalRevenue: deps.segments.regions.some((item) => item.sourceType === 'connected_data' || item.sourceType === 'company_knowledge_base'),
    productRevenue: deps.segments.products.some((item) => item.sourceType === 'connected_data' || item.sourceType === 'company_knowledge_base'),
    customerSegments: deps.segments.customerSegments.some((item) => item.sourceType === 'connected_data' || item.sourceType === 'company_knowledge_base'),
    anomalies: deps.anomaliesAvailable,
    accountRisks: false, // no account-level customer dataset is connected for public-company analysis
    operations: false, // no operational dataset is connected for public-company analysis
    forecast: deps.future.available,
  };
}

function buildNormalized(args: {
  resolution: CompanyResolution;
  profile: CompanyProfileLite;
  points: FinancialPoint[];
  present: PresentMetrics;
  historical: { points: HistoricalPoint[]; yoyGrowth: GrowthInfo };
  future: Foresight;
  segments: CompanySegments;
  risks: RiskItem[];
  anomalies: AnomalyItem[];
  capabilities: CompanyCapabilities;
  sourceTitles: string[];
  retrievedAt: string;
}): NormalizedCompanyData {
  const { resolution, profile, points, present, historical, future, segments, risks, anomalies, capabilities, sourceTitles, retrievedAt } = args;
  const usable = points.filter((p) => p.revenue != null).sort((a, b) => a.year - b.year);
  const latest = usable.length ? usable[usable.length - 1] : null;
  const trend: NormalizedCompanyData['financials']['revenueTrend'] = [
    ...historical.points
      .filter((p) => p.revenue != null)
      .map((p) => ({ period: p.periodLabel, value: p.revenue, kind: p.kind as 'reported' | 'estimated' })),
    ...future.points.map((f) => ({ period: f.period, value: f.value, kind: 'forecast' as const })),
  ];
  const availableMetrics = (Object.keys(capabilities) as Array<keyof CompanyCapabilities>).filter((k) => capabilities[k]);
  const unavailableMetrics = (Object.keys(capabilities) as Array<keyof CompanyCapabilities>).filter((k) => !capabilities[k]);

  return {
    company: {
      name: resolution.displayName,
      legalName: profile.legalName,
      ticker: profile.stockTicker,
      identifier: resolution.nameKey || resolution.query.toLowerCase(),
      resolved: resolution.resolved,
    },
    financials: {
      currency: present.currency || 'USD',
      historical: points,
      latest: latest
        ? {
            period: latest.period,
            revenue: latest.revenue,
            growthPct: present.growthPct,
            profit: present.profit,
            currency: latest.currency || 'USD',
            kind: latest.kind,
          }
        : null,
      growth: historical.points
        .filter((p) => p.growthPct != null)
        .map((p) => ({ period: p.periodLabel, growthPct: p.growthPct })),
      revenueTrend: trend,
    },
    segments,
    operations: [],
    risks,
    anomalies,
    metadata: {
      sources: sourceTitles,
      retrievedAt,
      availableMetrics,
      unavailableMetrics,
    },
  };
}