import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  FileText,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';
import { businessIntelligenceApi } from '../../api/businessIntelligence';
import CompanyAnalysisPanel from '../../components/dashboard/CompanyAnalysisPanel';
import {
  CompanyAnalysisResult,
  CompanyIntelligence,
  CompanyProfileLite,
  CompanyResolution,
  Direction,
} from '../../types/businessIntelligence';

const safeText = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
};
const asRecord = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {});

function emptyProfile(displayName: string): CompanyProfileLite {
  return { displayName, aliases: [], founders: [], subsidiaries: [], brands: [], competitors: [], countries: [], products: [], services: [], technologies: [], leadership: [] };
}

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? value : []);
const asStringArray = (value: unknown): string[] => asArray<unknown>(value).filter((item): item is string => typeof item === 'string');

function normalizeCompany(raw: Partial<CompanyIntelligence> | null | undefined, query: string, side: 'long' | 'short'): CompanyIntelligence {
  const rawRecord = asRecord(raw);
  const resolutionSource = asRecord(rawRecord.resolution);
  const profileSource = asRecord(rawRecord.profile);
  const historicalSource = asRecord(rawRecord.historical);
  const presentSource = asRecord(rawRecord.present);
  const futureSource = asRecord(rawRecord.future);
  const segmentSource = asRecord(rawRecord.segments);
  const capabilitySource = asRecord(rawRecord.capabilities);
  const displayName = safeText(resolutionSource.displayName || profileSource.displayName || query, side === 'long' ? 'Long company' : 'Short company');
  const resolutionId = typeof resolutionSource.id === 'string' || typeof resolutionSource.id === 'number' ? String(resolutionSource.id) : null;
  const resolution: CompanyResolution = {
    id: resolutionId,
    query: safeText(resolutionSource.query || query, query),
    nameKey: safeText(resolutionSource.nameKey, '') || null,
    displayName,
    legalName: safeText(resolutionSource.legalName, '') || undefined,
    resolved: Boolean(resolutionSource.resolved),
    match: safeText(resolutionSource.match, 'none') as CompanyResolution['match'],
  };
  const profile = {
    ...emptyProfile(displayName),
    ...profileSource,
    displayName,
    aliases: asStringArray(profileSource.aliases),
    founders: asArray<CompanyProfileLite['founders'][number]>(profileSource.founders),
    subsidiaries: asStringArray(profileSource.subsidiaries),
    brands: asStringArray(profileSource.brands),
    competitors: asStringArray(profileSource.competitors),
    countries: asStringArray(profileSource.countries),
    products: asArray<CompanyProfileLite['products'][number]>(profileSource.products),
    services: asStringArray(profileSource.services),
    technologies: asStringArray(profileSource.technologies),
    leadership: asArray<CompanyProfileLite['leadership'][number]>(profileSource.leadership),
  };
  const yoyGrowthSource = asRecord(historicalSource.yoyGrowth) as Partial<CompanyIntelligence['historical']['yoyGrowth']>;
  const historical: CompanyIntelligence['historical'] = {
    available: Boolean(historicalSource.available),
    points: Array.isArray(historicalSource.points) ? (historicalSource.points as CompanyIntelligence['historical']['points']) : [],
    yoyGrowth: {
      current: typeof yoyGrowthSource.current === 'number' ? Number(yoyGrowthSource.current) : null,
      previous: typeof yoyGrowthSource.previous === 'number' ? Number(yoyGrowthSource.previous) : null,
      change: typeof yoyGrowthSource.change === 'number' ? Number(yoyGrowthSource.change) : null,
      growthPct: typeof yoyGrowthSource.growthPct === 'number' ? Number(yoyGrowthSource.growthPct) : null,
      direction: (safeText(yoyGrowthSource.direction, 'unavailable') as Direction) || 'unavailable',
      currentLabel: safeText(yoyGrowthSource.currentLabel, ''),
      previousLabel: safeText(yoyGrowthSource.previousLabel, ''),
    },
    keyFindings: Array.isArray(historicalSource.keyFindings) ? (historicalSource.keyFindings as string[]) : [],
    notes: Array.isArray(historicalSource.notes) ? (historicalSource.notes as string[]) : [],
  };
  const present = {
    period: safeText(presentSource.period, ''),
    dataSourceLabel: safeText(presentSource.dataSourceLabel, 'Connected company data'),
    latestRevenue: typeof presentSource.latestRevenue === 'number' ? presentSource.latestRevenue as number : null,
    previousRevenue: typeof presentSource.previousRevenue === 'number' ? presentSource.previousRevenue as number : null,
    growthPct: typeof presentSource.growthPct === 'number' ? presentSource.growthPct as number : null,
    direction: (safeText(presentSource.direction, 'unavailable') as Direction) || 'unavailable',
    profit: typeof presentSource.profit === 'number' ? presentSource.profit as number : null,
    profitMarginPct: typeof presentSource.profitMarginPct === 'number' ? presentSource.profitMarginPct as number : null,
    latestRevenueLabel: safeText(presentSource.latestRevenueLabel),
    currency: safeText(presentSource.currency, 'USD'),
    available: Boolean(presentSource.available),
    notes: Array.isArray(presentSource.notes) ? presentSource.notes as string[] : [],
  };
  const future: CompanyIntelligence['future'] = {
    available: Boolean(futureSource.available),
    reason: safeText(futureSource.reason),
    basis: Array.isArray(futureSource.basis) ? (futureSource.basis as string[]) : [],
    horizonYears: typeof futureSource.horizonYears === 'number' ? (futureSource.horizonYears as number) : 0,
    trendDirection: (safeText(futureSource.trendDirection, 'unavailable') as CompanyIntelligence['future']['trendDirection']) || 'unavailable',
    projectedGrowthPct: typeof futureSource.projectedGrowthPct === 'number' ? (futureSource.projectedGrowthPct as number) : null,
    points: Array.isArray(futureSource.points) ? (futureSource.points as CompanyIntelligence['future']['points']) : [],
  };
  const normalizedFallback: CompanyIntelligence['normalized'] = {
    company: { name: displayName, identifier: resolution.nameKey || resolution.query.toLowerCase(), resolved: resolution.resolved },
    financials: { currency: present.currency || 'USD', historical: [], latest: null, growth: [], revenueTrend: [] },
    segments: { regions: [], products: [], customerSegments: [] },
    operations: [],
    risks: [],
    anomalies: [],
    metadata: { sources: [], retrievedAt: '', availableMetrics: [], unavailableMetrics: [] },
  };

  return {
    resolution,
    profile,
    historical,
    present,
    future,
    momentum: (safeText(rawRecord.momentum || present.direction || 'unavailable', 'unavailable') as Direction) || 'unavailable',
    strengths: Array.isArray(rawRecord.strengths) ? (rawRecord.strengths as CompanyIntelligence['strengths']) : [],
    weaknesses: Array.isArray(rawRecord.weaknesses) ? (rawRecord.weaknesses as CompanyIntelligence['weaknesses']) : [],
    risks: Array.isArray(rawRecord.risks) ? (rawRecord.risks as CompanyIntelligence['risks']) : [],
    opportunities: Array.isArray(rawRecord.opportunities) ? (rawRecord.opportunities as CompanyIntelligence['opportunities']) : [],
    segments: { regions: asArray(segmentSource.regions), products: asArray(segmentSource.products), customerSegments: asArray(segmentSource.customerSegments) },
    anomalies: asArray(rawRecord.anomalies),
    capabilities: { revenue: false, historicalRevenue: false, growth: false, revenueTrend: false, regionalRevenue: false, productRevenue: false, customerSegments: false, anomalies: false, accountRisks: false, operations: false, forecast: false, ...(capabilitySource || {}) },
    normalized: ((rawRecord.normalized as CompanyIntelligence['normalized']) || normalizedFallback),
    notes: asArray(rawRecord.notes),
  };
}

function normalizeAnalysis(raw: unknown, longQuery: string, shortQuery: string): CompanyAnalysisResult {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Partial<CompanyAnalysisResult>;
  const sourceRecord = asRecord(source);
  const sourceCompanies = asRecord(sourceRecord.companies);
  const sourceComparison = asRecord(sourceRecord.comparison);
  const sourceAiInsights = asRecord(sourceRecord.aiInsights);
  const sourceMeta = asRecord(sourceRecord.meta);
  const long = normalizeCompany(sourceCompanies.long as Partial<CompanyIntelligence> | null | undefined, longQuery, 'long');
  const short = normalizeCompany(sourceCompanies.short as Partial<CompanyIntelligence> | null | undefined, shortQuery, 'short');
  const longQueryText = safeText(sourceRecord.companyQuery && asRecord(sourceRecord.companyQuery).long, longQuery);
  const shortQueryText = safeText(sourceRecord.companyQuery && asRecord(sourceRecord.companyQuery).short, shortQuery);
  const longRevenue = asRecord(sourceRecord.revenueTrend && asRecord(sourceRecord.revenueTrend).long) || { company: long.resolution.displayName, currency: long.present.currency || 'USD', actual: [], forecast: [] };
  const shortRevenue = asRecord(sourceRecord.revenueTrend && asRecord(sourceRecord.revenueTrend).short) || { company: short.resolution.displayName, currency: short.present.currency || 'USD', actual: [], forecast: [] };
  const comparisonLong = asRecord(sourceComparison.long);
  const comparisonShort = asRecord(sourceComparison.short);
  return {
    analyzedAt: safeText(source.analyzedAt, new Date().toISOString()),
    lastUpdatedAt: safeText(source.lastUpdatedAt || source.analyzedAt, new Date().toISOString()),
    companyQuery: { long: longQueryText || longQuery, short: shortQueryText || shortQuery },
    companies: { long, short },
    revenueTrend: {
      long: { company: safeText(longRevenue.company, long.resolution.displayName), currency: safeText(longRevenue.currency, long.present.currency || 'USD'), actual: Array.isArray(longRevenue.actual) ? longRevenue.actual as CompanyAnalysisResult['revenueTrend']['long']['actual'] : [], forecast: Array.isArray(longRevenue.forecast) ? longRevenue.forecast as CompanyAnalysisResult['revenueTrend']['long']['forecast'] : [] },
      short: { company: safeText(shortRevenue.company, short.resolution.displayName), currency: safeText(shortRevenue.currency, short.present.currency || 'USD'), actual: Array.isArray(shortRevenue.actual) ? shortRevenue.actual as CompanyAnalysisResult['revenueTrend']['short']['actual'] : [], forecast: Array.isArray(shortRevenue.forecast) ? shortRevenue.forecast as CompanyAnalysisResult['revenueTrend']['short']['forecast'] : [] },
    },
    growthComparison: Array.isArray(source.growthComparison) ? source.growthComparison : [],
    comparison: {
      long: {
        displayName: safeText(comparisonLong.displayName, long.resolution.displayName),
        latestRevenue: typeof comparisonLong.latestRevenue === 'number' ? comparisonLong.latestRevenue as number : long.present.latestRevenue,
        growthPct: typeof comparisonLong.growthPct === 'number' ? comparisonLong.growthPct as number : long.present.growthPct,
        momentum: (safeText(comparisonLong.momentum, long.momentum) as Direction) || long.momentum,
      },
      short: {
        displayName: safeText(comparisonShort.displayName, short.resolution.displayName),
        latestRevenue: typeof comparisonShort.latestRevenue === 'number' ? comparisonShort.latestRevenue as number : short.present.latestRevenue,
        growthPct: typeof comparisonShort.growthPct === 'number' ? comparisonShort.growthPct as number : short.present.growthPct,
        momentum: (safeText(comparisonShort.momentum, short.momentum) as Direction) || short.momentum,
      },
      revenueDelta: typeof sourceComparison.revenueDelta === 'number' ? sourceComparison.revenueDelta as number : null,
      revenueRatio: typeof sourceComparison.revenueRatio === 'number' ? sourceComparison.revenueRatio as number : null,
      growthDeltaPct: typeof sourceComparison.growthDeltaPct === 'number' ? sourceComparison.growthDeltaPct as number : null,
      revenueLeader: safeText(sourceComparison.revenueLeader, 'unavailable') as CompanyAnalysisResult['comparison']['revenueLeader'],
      growthLeader: safeText(sourceComparison.growthLeader, 'unavailable') as CompanyAnalysisResult['comparison']['growthLeader'],
      normalization: {
        currency: safeText(sourceComparison.normalization && asRecord(sourceComparison.normalization).currency, 'USD'),
        basis: safeText(sourceComparison.normalization && asRecord(sourceComparison.normalization).basis, 'Comparison unavailable from the connected data source.'),
      },
      series: asArray(sourceComparison.series),
      growthSeries: asArray(sourceComparison.growthSeries),
    },
    aiInsights: {
      executiveSummary: safeText(sourceAiInsights.executiveSummary),
      historicalInsights: Array.isArray(sourceAiInsights.historicalInsights) ? sourceAiInsights.historicalInsights as string[] : [],
      currentInsights: Array.isArray(sourceAiInsights.currentInsights) ? sourceAiInsights.currentInsights as string[] : [],
      futureOutlook: safeText(sourceAiInsights.futureOutlook),
      revenueAnalysis: safeText(sourceAiInsights.revenueAnalysis),
      growthAnalysis: safeText(sourceAiInsights.growthAnalysis),
      riskAnalysis: safeText(sourceAiInsights.riskAnalysis),
      opportunityAnalysis: safeText(sourceAiInsights.opportunityAnalysis),
      longVsShortComparison: safeText(sourceAiInsights.longVsShortComparison),
      finalBusinessIntelligenceSummary: safeText(sourceAiInsights.finalBusinessIntelligenceSummary),
      generatedAt: safeText(sourceAiInsights.generatedAt, ''),
      provider: safeText(sourceAiInsights.provider, 'unavailable'),
      basisNote: safeText(sourceAiInsights.basisNote),
    },
    sources: Array.isArray(source.sources) ? source.sources as CompanyAnalysisResult['sources'] : [],
    meta: {
      dataAvailable: Boolean(sourceMeta.dataAvailable),
      forecastBasis: safeText(sourceMeta.forecastBasis),
      currencyNormalization: safeText(sourceMeta.currencyNormalization, 'USD'),
      notes: Array.isArray(sourceMeta.notes) ? sourceMeta.notes as string[] : [],
      analysisId: safeText(sourceMeta.analysisId, ''),
    },
  };
}

class BIErrorBoundary extends React.Component<{ onRetry: () => void; children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    console.error('[BI] Render failed:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="glass rounded-2xl p-8 card-glow text-center">
        <p className="text-sm text-foreground/80">This BI response could not be rendered safely.</p>
        <p className="text-xs text-muted-foreground mt-1">The current company selection was preserved.</p>
        <button onClick={() => { this.setState({ hasError: false }); this.props.onRetry(); }} className="mt-4 inline-flex items-center gap-2 rounded-lg gradient-brand px-4 py-2 text-xs font-medium text-white">
          <RefreshCw className="w-3.5 h-3.5" /> Try again
        </button>
      </div>
    );
  }
}

// ---------------------------------------------------------------------------
// Business Intelligence — Long Company vs Short Company
// ---------------------------------------------------------------------------
export default function BusinessIntelligencePage() {
  const navigate = useNavigate();

  // Single source of truth for the whole dashboard: the two user-entered
  // companies and the single analysis result (biData) they produced.
  const [longCompany, setLongCompany] = useState('');
  const [shortCompany, setShortCompany] = useState('');
  const [biData, setBiData] = useState<CompanyAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stale-response protection: only the newest request may write biData.
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Abort any in-flight analysis when the page unmounts.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const runAnalysis = (refresh: boolean) => {
    const long = longCompany.trim();
    const short = shortCompany.trim();
    if (long.length < 2 || short.length < 2) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;

    // Clear stale state before kicking off a new run — the view must never
    // show a previous analysis for the newly selected companies.
    setBiData(null);
    setError(null);
    setIsLoading(true);

    const call = refresh
      ? businessIntelligenceApi.refresh(long, short, controller.signal)
      : businessIntelligenceApi.analyze(long, short, controller.signal);

    call
      .then((resp) => {
        if (requestId !== requestIdRef.current || controller.signal.aborted) return;
        const result = resp?.data?.data;
        if (result && typeof result === 'object') {
          if (import.meta.env.DEV) console.debug('[BI] Response normalized for', long, 'vs', short);
          setBiData(normalizeAnalysis(result, long, short));
        } else {
          setError('No analysis data returned. Please try again.');
        }
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current || controller.signal.aborted) return;
        const axiosError = err as { code?: string; response?: { status?: number; data?: { message?: string } } };
        const status = axiosError.response?.status;
        const message = status === 429
          ? 'The company data provider is rate-limited. Please try again shortly.'
          : axiosError.code === 'ECONNABORTED'
            ? 'The BI analysis timed out. Please try again.'
            : axiosError.response?.data?.message || (err instanceof Error ? err.message : '') || 'Unable to analyze these companies. Please try again.';
        console.error('[BI] Analysis failed:', err);
        setError(message);
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setIsLoading(false);
      });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-[calc(100vh-4rem)] animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-foreground">Business Intelligence</h1>
          <p className="text-xs text-muted-foreground">Real-world company analysis — Long Company vs Short Company, driven by gathered data</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/reports', { state: { dashboardType: 'Business Intelligence', filters: {}, metrics: {} } })}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <FileText className="w-3.5 h-3.5" /> Generate BI Report
          </button>
          <button
            onClick={() => navigate('/chat')}
            className="flex items-center gap-2 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-orange-600"
          >
            <MessageSquare className="w-3.5 h-3.5" /> Ask AI Agent
          </button>
        </div>
      </div>

      {/* Analysis workflow (input + full company-grounded result) */}
      <BIErrorBoundary onRetry={() => runAnalysis(false)}>
        <CompanyAnalysisPanel
          longCompany={longCompany}
          shortCompany={shortCompany}
          onLongCompanyChange={setLongCompany}
          onShortCompanyChange={setShortCompany}
          biData={biData}
          isLoading={isLoading}
          error={error}
          onAnalyze={runAnalysis}
        />

      </BIErrorBoundary>
    </div>
  );
}