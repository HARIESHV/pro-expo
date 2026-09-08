import { activeAIProvider } from '../aiProvider';
import { AIAnalysis, AIFinding, AnalysisOptions, GrowthInfo, OrgRef, PresentAnalysis, PastAnalysis, FutureAnalysis, AnomalyAnalysis } from './types';
import {
  getRevenueAnalysis,
  getSalesAnalysis,
  getCustomerAnalysis,
  getOperationsAnalysis,
  getFinanceAnalysis,
} from './businessIntelligenceService';
import { getPastAnalysis, getPresentAnalysis, getFutureAnalysis, getAnomalies } from './businessIntelligenceService';
import { logger } from '../../config/logger';

// ===========================================================================
// AI Analysis service.
//
// Every numeric statement sent to the model is drawn from the real metrics the
// BI engine computed from MongoDB records (no invented figures). The model is
// asked for a strictly structured JSON response matching AIAnalysis, and any
// parse/validation failure degrades to a deterministic analysis built from the
// same real figures so the UI is never empty and never wrong.
// ===========================================================================

interface ContextBundle {
  basisPeriod: string;
  profile: string;
  revenue: string;
  sales: string;
  customers: string;
  finance: string;
  operations: string;
  anomalies: string;
  forecast: string;
  pastEvents: string;
  comparisons: string;
}

function currency(n: number): string {
  return n.toLocaleString();
}

function growthText(value: number | null): string {
  if (value == null) return 'n/a';
  return `${value.toFixed(1)}%`;
}

export async function buildContextBundle(orgRef: OrgRef, opts: AnalysisOptions = {}): Promise<ContextBundle> {
  const [present, past, future, anomalies, revenue, sales, customers, finance, operations] = await Promise.all([
    getPresentAnalysis(orgRef, opts),
    getPastAnalysis(orgRef, opts),
    getFutureAnalysis(orgRef, opts),
    getAnomalies(orgRef, opts),
    getRevenueAnalysis(orgRef, opts),
    getSalesAnalysis(orgRef, opts),
    getCustomerAnalysis(orgRef, opts),
    getFinanceAnalysis(orgRef, opts),
    getOperationsAnalysis(orgRef),
  ]);

  const topProducts = sales.bestProducts.slice(0, 3).map((p) => `${p.key} (${currency(p.revenue)} USD, ${p.count} deals)`).join('; ') || 'none';
  const topRegions = sales.breakdown.byRegion.slice(0, 3).map((r) => `${r.key} (${currency(r.revenue)} USD)`).join('; ') || 'none';

  return {
    basisPeriod: present.periodLabel,
    profile: `Span ${present.periodLabel || 'no data'}; accrued revenue ${currency(revenue.profile.revenueScale)} USD; ${revenue.profile.customerCount} customers; ${revenue.profile.transactionCount} transactions; preferred granularity ${revenue.profile.preferredGranularity}.`,
    revenue: `Current period total ${currency(present.revenue.current)} USD; previous ${present.revenue.previous != null ? currency(present.revenue.previous) + ' USD' : 'none'}; change ${currency(present.revenue.change)} USD; growth ${growthText(present.revenue.growthPct)}; direction ${present.revenue.direction}; open pipeline ${currency(present.revenue.pipeline)} USD; closed-won deals ${present.revenue.closedWonDeals}; closed-lost amount ${currency(present.revenue.closedLostAmount)} USD.`,
    sales: `Total recorded deal value ${currency(sales.totalRevenue)} USD across ${sales.totalDeals} records; closed-won ${sales.closedWonDeals}; closed-lost ${sales.closedLostDeals}; average closed deal size ${sales.averageDealSize != null ? currency(sales.averageDealSize) + ' USD' : 'n/a'}; conversion ${sales.conversionRate}%; top products: ${topProducts}; top regions: ${topRegions}.`,
    customers: `Total ${customers.total}; active ${customers.active}; inactive ${customers.inactive}; at risk ${customers.atRisk}; churned ${customers.churned}; new (last 90 days) ${customers.newCustomers}; returning ${customers.returningCustomers}; average lifetime value ${customers.averageLtv != null ? currency(customers.averageLtv) + ' USD' : 'n/a'}.`,
    finance: `Revenue ${currency(finance.revenue)} USD; expenses recorded ${finance.expenses.byBudget > 0 || finance.expenses.byProjectCost > 0 || finance.expenses.byPayroll > 0 ? 'yes (partial sources)' : 'none'}; profit ${finance.profit != null ? currency(finance.profit) + ' USD' : 'n/a'}; margin ${finance.profitMarginPct != null ? finance.profitMarginPct.toFixed(1) + '%' : 'n/a'}.`,
    operations: `Orders ${operations.orders}; open tickets ${operations.openTickets}; resolved ${operations.resolvedTickets}; avg resolution ${operations.avgResolutionHours ?? 'n/a'}; satisfaction ${operations.satisfactionAvg ?? 'n/a'}.`,
    anomalies: anomalies.available && anomalies.items.length
      ? anomalies.items.map((a) => `${a.metric} ${a.bucketLabel} ${a.deviationPct}% (${a.severity})`).join('; ')
      : 'none detected',
    forecast: future.revenueForecast.available
      ? `Revenue forecast ${future.revenueForecast.direction} over next periods; confidence ${future.revenueForecast.confidence}; methodology ${future.revenueForecast.methodology}.`
      : 'Revenue forecasting unavailable (insufficient historical periods).',
    pastEvents: past.events.slice(0, 8).map((e) => `${e.periodLabel}: ${e.title}`).join(' | ') || 'none',
    comparisons: ['qoq', 'yoy']
      .map((d) => past.comparisons[d as 'qoq'])
      .filter((c): c is GrowthInfo => c != null)
      .map((c) => `${c.currentLabel} vs ${c.previousLabel}: ${c.direction} ${c.growthPct != null ? c.growthPct.toFixed(1) + '%' : 'n/a'}`)
      .join('; ') || 'none',
  };
}

const SYSTEM_PROMPT =
  'You are a meticulous business intelligence analyst. Use ONLY the exact numbers and periods provided in the context JSON. Never invent metrics, dates, or figures that are not present. Produce a strictly valid JSON object (no markdown, no commentary) matching this exact schema: {"summary":string,"findings":[{"metric":string,"finding":string,"evidence":[string],"likelyCause":string,"businessImpact":string,"recommendedAction":string}],"risks":[{"title":string,"description":string,"probability":number,"impact":number}],"opportunities":[{"title":string,"detail":string}],"recommendations":[string]}.';

function buildUserPrompt(ctx: ContextBundle): string {
  return `Analysis period: ${ctx.basisPeriod}

CONTEXT (all figures are real, computed from source records):
- Profile: ${ctx.profile}
- Revenue: ${ctx.revenue}
- Sales: ${ctx.sales}
- Customers: ${ctx.customers}
- Finance: ${ctx.finance}
- Operations: ${ctx.operations}
- Anomalies: ${ctx.anomalies}
- Forecast: ${ctx.forecast}
- Past events: ${ctx.pastEvents}
- Comparisons: ${ctx.comparisons}

Produce the analysis JSON now.`;
}

// ---------------------------------------------------------------------------
// Deterministic fallback — built from the same real figures, no model needed.
// ---------------------------------------------------------------------------
function buildDeterministicAnalysis(ctx: ContextBundle, present: PresentAnalysis, past: PastAnalysis, future: FutureAnalysis, anomalies: AnomalyAnalysis): AIAnalysis {
  const findings: AIFinding[] = [];

  if (present.revenue.direction !== 'insufficient') {
    findings.push({
      metric: 'revenue',
      finding:
        present.revenue.growthPct != null && present.revenue.direction !== 'flat'
          ? `${present.revenue.currentLabel} revenue is ${present.revenue.direction === 'up' ? 'up' : 'down'} ${Math.abs(present.revenue.growthPct).toFixed(1)}% vs ${present.revenue.previousLabel}.`
          : `${present.revenue.currentLabel} revenue is ${currency(present.revenue.current)} USD.`,
      evidence: [
        `${present.revenue.currentLabel}: ${currency(present.revenue.current)} USD`,
        present.revenue.previousLabel ? `${present.revenue.previousLabel}: ${currency(present.revenue.previous || 0)} USD` : ctx.revenue,
      ],
      likelyCause:
        present.revenue.direction === 'down' ? 'Decline is consistent with the recorded deal trajectory in the current window.' : 'Movement reflects the recorded closed-won pipeline for the period.',
      businessImpact:
        present.revenue.growthPct != null
          ? `A ${Math.abs(present.revenue.growthPct).toFixed(1)}% ${present.revenue.direction === 'up' ? 'increase' : 'decrease'} equals ${currency(Math.abs(present.revenue.change))} USD in the current period.`
          : `${currency(present.revenue.current)} USD recognized in ${present.revenue.currentLabel}.`,
      recommendedAction:
        present.revenue.direction === 'down'
          ? 'Re-validate the open pipeline and review top products/regions that pulled the period down.'
          : 'Maintain momentum; review product/region contributors that drove the uptick.',
    });
  }

  for (const a of anomalies.items) {
    findings.push({
      metric: a.metric,
      finding: `Anomaly detected in ${a.bucketLabel}: ${a.deviationPct}% deviation (${a.severity}).`,
      evidence: [`Expected ${currency(a.expected || 0)} USD, actual ${currency(a.value)} USD`],
      likelyCause: 'A material shift occurred between adjacent recorded periods.',
      businessImpact: `A ${a.deviationPct != null ? Math.abs(a.deviationPct) : 0}% swing in the ${a.metric} metric.`,
      recommendedAction: 'Drill into contributing deals/regions before the next close cycle.',
    });
  }

  if (present.customers.atRisk > 0) {
    findings.push({
      metric: 'customers',
      finding: `${present.customers.atRisk} customer(s) are flagged at risk with ${present.customers.churned} already churned.`,
      evidence: [`${present.customers.active} active, ${present.customers.atRisk} at risk, ${present.customers.churned} churned`],
      likelyCause: 'Declining engagement or unresolved support issues on flagged accounts.',
      businessImpact: `At-risk accounts represent ${Math.round((present.customers.averageLtv || 0) * present.customers.atRisk).toLocaleString()} USD of total lifetime value at stake.`,
      recommendedAction: 'Trigger account retention outreach for the highest risk-score accounts.',
    });
  }

  if (present.operations.openTickets > 0) {
    findings.push({
      metric: 'operations',
      finding: `${present.operations.openTickets} support ticket(s) currently open.`,
      evidence: [`avg resolution ${present.operations.avgResolutionHours} hours; satisfaction ${present.operations.satisfactionAvg}`],
      likelyCause: 'Current workload from recorded support volume.',
      businessImpact: `Open tickets carry a ${present.operations.openTickets} count companion to ${present.operations.orders} orders.`,
      recommendedAction: 'Prioritize tickets flagged critical to protect retention.',
    });
  }

  const risks = present.risks.map((r) => {
    const source = future.riskForecast.find((rf) => rf.title === r.title);
    return {
      title: r.title,
      description: `${r.level.toUpperCase()} risk (${r.category}) with score ${r.riskScore}.`,
      probability: source?.likelihood ?? 0.5,
      impact: source?.impact ?? r.riskScore / 100,
    };
  });

  const opportunities = future.opportunities;

  const recommendations = future.recommendations.length ? future.recommendations : ['Collect more historical periods to enable reliable forecasting.'];

  return {
    generatedAt: new Date().toISOString(),
    provider: 'deterministic-fallback',
    basisPeriod: ctx.basisPeriod,
    summary: `${present.periodLabel || 'Current period'} analysis: ${present.revenue.direction === 'down' ? 'revenue declined' : present.revenue.direction === 'up' ? 'revenue grew' : 'no material revenue movement'} relative to the previous recorded period, with ${anomalies.items.length} anomaly/anomalies and ${present.customers.atRisk} at-risk customer(s).`,
    findings,
    risks,
    opportunities,
    recommendations,
    usedLiveData: true,
  };
}

function coerceToAIAnalysis(raw: unknown, ctx: ContextBundle, present: PresentAnalysis, past: PastAnalysis, future: FutureAnalysis, anomalies: AnomalyAnalysis, provider: string): AIAnalysis {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const asStr = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : fallback);
  const num = (v: unknown, fallback = 0.5): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

  const findings: AIFinding[] = (Array.isArray(obj.findings) ? obj.findings : []).map((f: any) => ({
    metric: asStr(f.metric, 'analysis'),
    finding: asStr(f.finding),
    evidence: Array.isArray(f.evidence) ? f.evidence.map((e: any) => String(e)).filter(Boolean).slice(0, 5) : [],
    likelyCause: asStr(f.likelyCause),
    businessImpact: asStr(f.businessImpact),
    recommendedAction: asStr(f.recommendedAction),
  }));

  if (!asStr(obj.summary).trim() || !findings.length) {
    return buildDeterministicAnalysis(ctx, present, past, future, anomalies);
  }

  return {
    generatedAt: new Date().toISOString(),
    provider,
    basisPeriod: ctx.basisPeriod,
    summary: asStr(obj.summary),
    findings,
    risks: (Array.isArray(obj.risks) ? obj.risks : []).map((r: any) => ({
      title: asStr(r.title),
      description: asStr(r.description),
      probability: num(r.probability),
      impact: num(r.impact),
    })),
    opportunities: (Array.isArray(obj.opportunities) ? obj.opportunities : []).map((o: any) => ({
      title: asStr(o.title),
      detail: asStr(o.detail),
    })),
    recommendations: (Array.isArray(obj.recommendations) ? obj.recommendations : []).map((r: any) => String(r)).filter(Boolean),
    usedLiveData: true,
  };
}

export async function generateAIAnalysis(orgRef: OrgRef, opts: AnalysisOptions = {}): Promise<AIAnalysis> {
  const ctx = await buildContextBundle(orgRef, opts);
  const [present, past, future, anomalies] = await Promise.all([
    getPresentAnalysis(orgRef, opts),
    getPastAnalysis(orgRef, opts),
    getFutureAnalysis(orgRef, opts),
    getAnomalies(orgRef, opts),
  ]);

  try {
    const provider = activeAIProvider;
    const content = await provider.complete(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(ctx) },
      ],
      { json: true, temperature: 0.3, maxTokens: 2500 }
    );
    const parsed = JSON.parse(String(content || '{}'));
    return coerceToAIAnalysis(parsed, ctx, present, past, future, anomalies, provider.id);
  } catch (err) {
    logger.warn('[BIAnalysis] Falling back to deterministic analysis:', (err as Error).message);
    return buildDeterministicAnalysis(ctx, present, past, future, anomalies);
  }
}