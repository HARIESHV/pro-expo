import { activeAIProvider } from '../aiProvider';
import { logger } from '../../config/logger';
import {
  AIInsights,
  CompanyIntelligence,
} from '../../types/businessIntelligence';
import { formatCurrency, safeJsonParse } from './financialDataService';

// ===========================================================================
// aiAnalysisService — AI Business Analysis.
//
// Workflow per selected company:
//   data retrieval → validation → historical → current → forecast →
//   AI interpretation → Business Intelligence result.
//
// HALLUCINATION GUARDRAIL (Critical):
// The AI receives ONLY the structured dataset assembled by the data layer.
// It is strictly instructed to analyze only those numbers/facts, to never
// invent revenue/profit/growth/market values/historical values, and to write
// "Not available from the connected data source." for absent fields.
// When the provider errors, a deterministic, fully-grounded fallback analysis
// is produced — no fabricated numbers ever reach the dashboard.
// ===========================================================================

export async function generateAIInsights(
  long: CompanyIntelligence,
  short: CompanyIntelligence,
  extraNote?: string
): Promise<AIInsights> {
  const dataset = buildDatasetPrompt(long, short, extraNote);
  const now = new Date().toISOString();

  try {
    const provider = activeAIProvider;
    if (!provider.isConfigured()) {
      logger.warn('[company-intelligence] AI provider not configured — using grounded fallback analysis.');
      return fallbackAnalysis(long, short, now);
    }

    const messages = [
      {
        role: 'system' as const,
        content:
          `You are the Business Intelligence Analyst for a real-world company intelligence system.\n\n` +
          `Your job is to interpret the STRUCTURED DATA supplied below. You must follow these rules absolutely:\n\n` +
          `1. USE ONLY THE DATA PROVIDED. Every number you cite (revenue, profit, growth, market values, statistics, historical values) ` +
          `must already exist in the DATA section. Do not add, extrapolate, or "recall" figures.\n` +
          `2. If a metric is not present in DATA, write "Not available from the connected data source." — never approximate it.\n` +
          `3. The DATA labels each figure as reported (real, connected data source) or estimated (AI-referenced). Clearly reflect that ` +
          `distinction in your analysis. Never present an estimated figure as verified real data.\n` +
          `4. Forecasts shown in DATA are model projections. When discussing them, explicitly label them "Forecast" and remind the ` +
          `reader they are predictions, not guaranteed results.\n` +
          `5. You MAY provide interpretation, qualitative insight and recommendations — but always grounded in the DATA facts.\n` +
          `6. Respond ONLY with valid JSON matching this EXACT schema:\n` +
          `{\n` +
          `  "executiveSummary": "2-4 sentence executive summary of both companies using only DATA.",\n` +
          `  "historicalInsights": ["insight 1", "insight 2"],\n` +
          `  "currentInsights": ["insight 1", "insight 2"],\n` +
          `  "futureOutlook": "forecast outlook paragraph marked as Forecast.",\n` +
          `  "revenueAnalysis": "revenue analysis using only DATA revenue figures.",\n` +
          `  "growthAnalysis": "growth analysis using only DATA growth figures.",\n` +
          `  "riskAnalysis": "risk analysis based only on DATA-derived risks and facts.",\n` +
          `  "opportunityAnalysis": "opportunity analysis based only on DATA-derived opportunities and facts.",\n` +
          `  "longVsShortComparison": "head-to-head comparison of the long and short companies using only DATA.",\n` +
          `  "finalBusinessIntelligenceSummary": "final BI summary and recommendation for both companies."\n` +
          `}`,
      },
      { role: 'user' as const, content: dataset },
    ];

    const raw = await provider.complete(messages, { json: true, temperature: 0.2, maxTokens: 2400 });
    const parsed = safeJsonParse(raw);
    if (!parsed) {
      logger.warn('[company-intelligence] AI analysis returned invalid JSON — using grounded fallback.');
      return fallbackAnalysis(long, short, now);
    }

    return {
      executiveSummary: nonEmpty(parsed.executiveSummary, fallbackExec(long, short)),
      historicalInsights: toStringArray(parsed.historicalInsights),
      currentInsights: toStringArray(parsed.currentInsights),
      futureOutlook: nonEmpty(parsed.futureOutlook, 'Forecast based on available historical data.'),
      revenueAnalysis: nonEmpty(parsed.revenueAnalysis, 'Revenue analysis not available from the connected data source.'),
      growthAnalysis: nonEmpty(parsed.growthAnalysis, 'Growth analysis not available from the connected data source.'),
      riskAnalysis: nonEmpty(parsed.riskAnalysis, 'Risk analysis not available from the connected data source.'),
      opportunityAnalysis: nonEmpty(parsed.opportunityAnalysis, 'Opportunity analysis not available from the connected data source.'),
      longVsShortComparison: nonEmpty(parsed.longVsShortComparison, 'Comparison not available from the connected data source.'),
      finalBusinessIntelligenceSummary: nonEmpty(
        parsed.finalBusinessIntelligenceSummary,
        'Final Business Intelligence summary not available from the connected data source.'
      ),
      generatedAt: now,
      provider: provider.id,
      basisNote:
        'AI analysis is provided strictly from the structured data supplied by the data layer; figures cited originate only from that data. ' +
        'Forecasts are labelled predictions.',
    };
  } catch (err: any) {
    logger.warn('[company-intelligence] AI analysis failed:', err?.message || err);
    return fallbackAnalysis(long, short, now);
  }
}

// ---------------------------------------------------------------------------
// Grounded fallback — built only from supplied data. Never invents numbers.
// ---------------------------------------------------------------------------
export function fallbackAnalysis(long: CompanyIntelligence, short: CompanyIntelligence, now: string): AIInsights {
  const l = summarizeCompany(long);
  const s = summarizeCompany(short);
  return {
    executiveSummary:
      `${l.name} and ${s.name} were analyzed against the connected data sources. ` +
      `${l.line} ${s.line} ` +
      `${l.forecast} ${s.forecast}`.trim(),
    historicalInsights: [
      ...(l.historical ? [`${l.name}: ${l.historical}`] : []),
      ...(s.historical ? [`${s.name}: ${s.historical}`] : []),
    ],
    currentInsights: [
      `${l.name}: ${l.currentPresent}`,
      `${s.name}: ${s.currentPresent}`,
    ],
    futureOutlook:
      `${l.forecast} ${s.forecast} All projections are Forecast (predictions), not guaranteed results.`.trim(),
    revenueAnalysis:
      `${l.name} latest available revenue: ${l.revenueText}. ${s.name} latest available revenue: ${s.revenueText}. ` +
      `Where figures are AI-referenced estimates they are labelled as such and are not verified against the connected data source.`,
    growthAnalysis:
      `${l.name} growth: ${l.growthText}. ${s.name} growth: ${s.growthText}.`,
    riskAnalysis: buildRiskText(long, short),
    opportunityAnalysis: buildOpportunityText(long, short),
    longVsShortComparison:
      `Long company ${l.name}: ${l.currentPresent} Short company ${s.name}: ${s.currentPresent} ` +
      `Head-to-head comparison requires both companies to have available revenue + growth data; unavailable fields are marked "Not available from the connected data source."`,
    finalBusinessIntelligenceSummary:
      `Both companies were processed through the real-world BI workflow (data retrieval → validation → historical → current → forecast → analysis). ` +
      `Review the per-company sections for the data-grounded details.`,
    generatedAt: now,
    provider: 'grounded-fallback',
    basisNote:
      'AI provider unavailable; this analysis was generated deterministically from the supplied data layer output. No figures were invented.',
  };
}

function summarizeCompany(c: CompanyIntelligence) {
  const name = c.resolution.displayName;
  const rev = c.present.latestRevenue;
  const g = c.present.growthPct;
  const cur = c.present.period || 'latest period';
  const revenueText =
    rev != null
      ? `${formatCurrency(rev, c.present.currency)}${c.present.dataSourceLabel ? ` (${c.present.dataSourceLabel})` : ''}`
      : 'Not available from the connected data source.';
  const currentPresent =
    rev != null
      ? `Latest available revenue (${cur}) is ${formatCurrency(rev, c.present.currency)}` +
        (g != null ? ` with ${g > 0 ? '+' : ''}${g}% growth` : ' (growth not available)') +
        '.'
      : 'No reliable financial data available from the connected data sources.';
  const historical = c.historical.available
    ? `${c.historical.points.filter((p) => p.revenue != null).length} historical periods analyzed; latest YoY ${c.historical.yoyGrowth.growthPct != null ? `${c.historical.yoyGrowth.growthPct > 0 ? '+' : ''}${c.historical.yoyGrowth.growthPct}%` : 'growth not available'}.`
    : 'No available historical data.';
  const forecast = c.future.available
    ? `${name} forecast (for next ${c.future.horizonYears} years) is ${c.future.trendDirection} ` +
      (c.future.projectedGrowthPct != null ? `(~${c.future.projectedGrowthPct}% per year, Forecast).` : '(Forecast).')
    : `${name}: forecast unavailable (${c.future.reason ? c.future.reason.toLowerCase() : 'no projection available'})`;
  const growthText = g != null ? `${g > 0 ? '+' : ''}${g}% (${c.present.period})` : 'Not available from the connected data source.';
  const line = currentPresent;
  return { name, line, revenueText, growthText, historical, forecast, currentPresent };
}

function buildRiskText(long: CompanyIntelligence, short: CompanyIntelligence): string {
  const parts: string[] = [];
  for (const c of [long, short]) {
    if (c.risks.length) {
      parts.push(`${c.resolution.displayName}: ${c.risks.map((r) => r.title).join('; ')}.`);
    } else {
      parts.push(`${c.resolution.displayName}: No data-grounded risks derivable from the connected data source.`);
    }
  }
  return parts.join(' ');
}

function buildOpportunityText(long: CompanyIntelligence, short: CompanyIntelligence): string {
  const parts: string[] = [];
  for (const c of [long, short]) {
    if (c.opportunities.length) {
      parts.push(`${c.resolution.displayName}: ${c.opportunities.map((o) => o.title).join('; ')}.`);
    } else {
      parts.push(`${c.resolution.displayName}: No data-grounded opportunities derivable from the connected data source.`);
    }
  }
  return parts.join(' ');
}

function fallbackExec(long: CompanyIntelligence, short: CompanyIntelligence): string {
  return `${long.resolution.displayName} and ${short.resolution.displayName} analyzed using the connected data sources. Review per-company sections for data-grounded details.`;
}

// ---------------------------------------------------------------------------
// Dataset construction
// ---------------------------------------------------------------------------
function buildDatasetPrompt(long: CompanyIntelligence, short: CompanyIntelligence, extraNote?: string): string {
  return [
    'STRUCTURED DATA (the only facts you may use):',
    '',
    companyBlock('LONG COMPANY', long),
    '',
    companyBlock('SHORT COMPANY', short),
    ...(extraNote ? ['', `CONTEXT NOTE FROM THE SYSTEM: ${extraNote}`] : []),
    '',
    'Now produce the JSON analysis strictly following the schema in your instructions.',
  ].join('\n');
}

function companyBlock(label: string, c: CompanyIntelligence): string {
  const p = c.profile;
  const lines: string[] = [];
  lines.push(`${label}: ${c.resolution.displayName}${p.legalName ? ` (${p.legalName})` : ''}`);
  lines.push(`Resolution: ${c.resolution.resolved ? `matched via ${c.resolution.match}` : 'not found in the company knowledge base'}`);
  if (p.industry) lines.push(`Industry: ${p.industry}${p.subIndustry ? ` / ${p.subIndustry}` : ''}`);
  if (p.foundedYear) lines.push(`Founded: ${p.foundedYear}`);
  if (p.description) lines.push(`Business description: ${truncate(p.description, 400)}`);
  if (p.products?.length) lines.push(`Products: ${p.products.slice(0, 8).map((x) => x.name).join(', ')}`);
  if (p.competitors?.length) lines.push(`Competitors: ${p.competitors.slice(0, 6).join(', ')}`);
  if (p.employeeRange?.approx) lines.push(`Employees (approx): ${p.employeeRange.approx}`);
  lines.push(`Profile data confidence: ${p.dataConfidence != null ? p.dataConfidence : 'n/a'}`);

  lines.push('');
  const basis = c.historical.points.some((x) => x.kind === 'reported')
    ? 'values include reported (real) figures'
    : 'values are AI-referenced ESTIMATES (not verified against the connected data source)';
  lines.push(`Historical annual revenue (USD, ${basis}):`);
  for (const pt of c.historical.points) {
    const g = pt.growthPct != null ? `  growth ${pt.growthPct > 0 ? '+' : ''}${pt.growthPct}%` : '';
    lines.push(`  - ${pt.periodLabel}: ${pt.revenue != null ? formatCurrency(pt.revenue, c.present.currency) : 'Data unavailable'}${g}`);
  }

  lines.push('');
  lines.push(`Latest period: ${c.present.period || 'Data unavailable'}`);
  lines.push(`Latest available revenue: ${c.present.latestRevenue != null ? formatCurrency(c.present.latestRevenue, c.present.currency) : 'Not available from the connected data source.'}`);
  if (c.present.previousRevenue != null) {
    lines.push(`Previous available revenue: ${formatCurrency(c.present.previousRevenue, c.present.currency)}`);
  }
  if (c.present.growthPct != null) {
    lines.push(`Latest growth (YoY): ${c.present.growthPct > 0 ? '+' : ''}${c.present.growthPct}% (${c.present.period})`);
  } else {
    lines.push(`Latest growth (YoY): Not available from the connected data source.`);
  }
  if (c.present.profit != null) {
    lines.push(`Latest profit: ${formatCurrency(c.present.profit, c.present.currency)}${c.present.profitMarginPct != null ? ` (${c.present.profitMarginPct}% margin)` : ''}`);
  } else {
    lines.push(`Latest profit: Not available from the connected data source.`);
  }

  lines.push('');
  if (c.future.available) {
    lines.push(`Model forecast (NEXT ${c.future.horizonYears} YEARS, marked as Forecast/prediction):`);
    for (const f of c.future.points) {
      lines.push(`  - Forecast ${f.period}: ${formatCurrency(f.value, f.currency)} (range ${formatCurrency(f.lowerBound ?? 0, f.currency)} - ${formatCurrency(f.upperBound ?? 0, f.currency)}, confidence ${Math.round((f.confidence ?? 0) * 100)}%)`);
    }
    lines.push(`Forecast trend: ${c.future.trendDirection}${c.future.projectedGrowthPct != null ? ` (~${c.future.projectedGrowthPct}% per year)` : ''}`);
    lines.push(`Forecast basis periods: ${c.future.basis.join(', ')}`);
  } else {
    lines.push(`Model forecast: ${c.future.reason}`);
  }

  if (c.risks.length) {
    lines.push('');
    lines.push('Data-grounded risks:');
    for (const r of c.risks) lines.push(`  - [${r.level}] ${r.title}: ${truncate(r.description, 220)}`);
  }
  if (c.opportunities.length) {
    lines.push('');
    lines.push('Data-grounded opportunities:');
    for (const o of c.opportunities) lines.push(`  - ${o.title}: ${truncate(o.detail, 220)}`);
  }
  if (c.notes.length) {
    lines.push('');
    lines.push(`Data notes: ${c.notes.join(' ')}`);
  }

  return lines.join('\n');
}

function truncate(s: string, max: number): string {
  const t = (s || '').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function nonEmpty(v: unknown, fallback: string): string {
  const s = typeof v === 'string' && v.trim() ? v.trim() : '';
  return s || fallback;
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()).slice(0, 8);
}