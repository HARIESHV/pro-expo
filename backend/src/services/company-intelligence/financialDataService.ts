import { CompanyFinancial } from '../../models/CompanyFinancial';
import { activeAIProvider } from '../aiProvider';
import { logger } from '../../config/logger';
import { CompanyProfileLite, FinancialPoint } from '../../types/businessIntelligence';

// ===========================================================================
// financialDataService — builds the periodic financial series for a selected
// real-world company.
//
// Two kinds of points flow through here:
//   1. reported   — real values from the connected data source
//                   (company knowledge base records / explicit stored figures).
//   2. estimated  — figures referenced by the AI model with explicit
//                   provenance (sourceType "ai_reference"), cached in the
//                   CompanyFinancial collection. These are ESTIMATES, never
//                   presented as verified real data.
//
// If no reliable values can be produced the series is empty and the caller
// sees `available: false` — no numbers are invented.
// ===========================================================================

/** Re-run AI research for figures this old (in ms). */
const CACHE_FRESHNESS_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_YEARS_BACK = 8;

export interface FinancialSeriesResult {
  points: FinancialPoint[];
  available: boolean;
  currency: string;
  notes: string[];
  sources: Array<{ type: FinancialPoint['sourceType']; title: string; source: string; detail: string }>;
}

/**
 * Load an annual financial series for a company, using cached real/estimated
 * data first and (optionally) refreshing model-referenced estimates with a new
 * AI retrieval.
 */
export async function getFinancialSeries(opts: {
  nameKey: string;
  displayName: string;
  profile: CompanyProfileLite;
  refresh?: boolean;
}): Promise<FinancialSeriesResult> {
  const { nameKey, displayName, profile, refresh } = opts;
  const notes: string[] = [];
  const sources: FinancialSeriesResult['sources'] = [];

  if (refresh) {
    const refreshed = await researchAndCache(nameKey, displayName);
    if (refreshed) notes.push(refreshed);
  }

  const stored = await CompanyFinancial.find({ companyKey: nameKey }).sort({ year: 1 }).lean();

  // Merge real knowledge-base revenue figures as "reported" points.
  const kbRevenue = profile.revenue;
  const reportedKb = kbRevenue?.amount && kbRevenue.year
    ? [{
        period: String(kbRevenue.year),
        year: kbRevenue.year,
        revenue: kbRevenue.amount,
        profit: null,
        profitMarginPct: null,
        kind: 'reported' as const,
        sourceType: 'company_knowledge_base' as const,
        source: `${displayName} company knowledge base record`,
        confidence: profile.dataConfidence ?? 0.8,
        currency: (kbRevenue.currency || 'USD').toUpperCase(),
        note: kbRevenue.note,
      } as FinancialPoint]
    : [];

  const pointsByYear = new Map<number, FinancialPoint>();
  for (const p of reportedKb) pointsByYear.set(p.year, p);
  for (const s of stored) {
    pointsByYear.set(s.year, {
      period: s.period,
      year: s.year,
      revenue: s.revenue,
      profit: s.profit,
      profitMarginPct: s.profitMarginPct,
      kind: s.kind,
      sourceType: s.sourceType,
      source: s.source,
      confidence: s.confidence,
      currency: (s.currency || 'USD').toUpperCase(),
      note: s.note,
    });
  }

  const points = [...pointsByYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, p]) => p);

  const estimatedCount = points.filter((p) => p.kind === 'estimated').length;
  const reportedCount = points.filter((p) => p.kind === 'reported').length;

  if (points.length === 0) {
    notes.push(`No reliable financial data available for ${displayName} from the connected data sources.`);
    sources.push({
      type: 'connected_data',
      title: 'No financial data',
      source: 'Connected data sources',
      detail: `No reported or estimated financial figures could be retrieved for ${displayName}.`,
    });
    return { points, available: false, currency: 'USD', notes, sources };
  }

  const currency = mostCommonCurrency(points);
  if (estimatedCount > 0) {
    notes.push(
      `${estimatedCount} estimated financial figure(s) are AI-referenced estimates (sourceType "ai_reference") — not verified against the connected data source.`
    );
  }
  if (reportedCount > 0) {
    notes.push(`${reportedCount} reported financial figure(s) sourced from the connected data sources.`);
  }
  const nonUsd = points.filter((p) => p.currency && p.currency !== 'USD');
  if (nonUsd.length) {
    notes.push(
      `Figures reported in ${[...new Set(nonUsd.map((p) => p.currency))].join(', ')}. Where non-USD figures are converted for comparison, the conversion basis is stated explicitly.`
    );
  }

  sources.push(...points.slice(0, 12).map((p) => ({
    type: p.sourceType,
    title: `${displayName} · ${p.period} ${p.kind === 'reported' ? 'reported' : 'estimated'} revenue${p.revenue != null ? ` (${formatCurrency(p.revenue, p.currency)})` : ''}`,
    source: p.source,
    detail: p.note || p.source,
  })));

  return { points, available: true, currency, notes, sources };
}

/** Run the AI model to produce clearly-labelled estimated annual figures, then cache them. */
async function researchAndCache(nameKey: string, displayName: string): Promise<string | null> {
  try {
    const provider = activeAIProvider;
    if (!provider.isConfigured()) return 'AI provider unavailable — estimated figures were not refreshed.';

    const currentYear = new Date().getFullYear();
    const schema = {
      note: 'short basis for these figures',
      currency: 'USD',
      fiscalNote: 'fiscal-year convention if known',
      years: [
        {
          year: 2024,
          revenueUSD: 0,
          profitUSD: 0,
          confidence: 0.0,
          note: 'brief basis for this year',
        },
      ],
    };

    const messages = [
      {
        role: 'system' as const,
        content:
          `You are an automated financial research agent for the Business Intelligence module.\n` +
          `TASK: Return well-known, publicly disclosed annual financial figures (revenue and net profit, in full USD amounts) ` +
          `for the company described below, for its most recent ${MAX_YEARS_BACK} complete fiscal years.\n\n` +
          `STRICT RULES — ABSOLUTELY NO FABRICATION:\n` +
          `- Only include a year when you are HIGHLY confident the figure is a correct, publicly known annual disclosure ` +
          `(from official annual reports / 10-K filings / regulator filings).\n` +
          `- If you are not highly confident about a specific year's figure, OMIT that year. Do not approximate from trends.\n` +
          `- For companies reporting in a non-USD currency (e.g. Samsung in KRW), convert the disclosed figure to USD using the ` +
          `average annual FX rate and note the conversion in that year's "note".\n` +
          `- revenueUSD and profitUSD must be full amounts (e.g. 391000000000 for 391 billion). profitUSD may be negative for a loss year.\n` +
          `- confidence must be 0..1 reflecting how certain you are the disclosed figure is accurate.\n` +
          `- "note" should state the basis (e.g. "FY2024 net sales per 10-K ~$391.0B; net income ~$93.7B").\n` +
          `- If you cannot provide reliable figures for ANY year, return { "years": [], "note": "No reliable public figures were confidently known." }.\n` +
          `- Return ONLY valid JSON matching this schema:\n${JSON.stringify(schema)}`,
      },
      {
        role: 'user' as const,
        content: `Company: ${displayName}\nIndustry: ${profileSummary(displayName)}\nReturn the JSON figures now.`,
      },
    ];

    const raw = await provider.complete(messages, { json: true, temperature: 0.2, maxTokens: 1600 });
    const parsed = safeJsonParse(raw);
    if (!parsed || !Array.isArray(parsed.years)) {
      logger.warn(`[company-intelligence] AI research for ${displayName} returned unparsable JSON.`);
      return null;
    }

    const yearSet = new Set<number>();
    let inserted = 0;
    const now = new Date();
    for (const y of parsed.years as Array<{ year?: number; revenueUSD?: number; profitUSD?: number; confidence?: number; note?: string }>) {
      const year = Number(y.year);
      const revenue = Number(y.revenueUSD);
      if (!Number.isFinite(year) || year < 1990 || year > currentYear || !Number.isFinite(revenue) || revenue < 0) continue;
      if (yearSet.has(year)) continue;
      yearSet.add(year);
      const confidence = clamp(Number(y.confidence) || 0.5, 0, 1);
      await CompanyFinancial.findOneAndUpdate(
        { companyKey: nameKey, period: String(year) },
        {
          $set: {
            year,
            revenue,
            profit: Number.isFinite(Number(y.profitUSD)) ? Number(y.profitUSD) : null,
            currency: 'USD',
            kind: 'estimated',
            source: `AI-referenced public disclosure estimate (${displayName} FY${year})`,
            sourceType: 'ai_reference',
            confidence,
            note: y.note,
            retrievedAt: now,
          },
        },
        { upsert: true }
      );
      inserted++;
    }
    return inserted > 0
      ? `Refreshed ${inserted} AI-referenced estimated figure(s) for ${displayName}.`
      : `No new estimated figures could be reliably produced for ${displayName}.`;
  } catch (err: any) {
    logger.warn(`[company-intelligence] Estimated-financials research failed for ${displayName}:`, err?.message || err);
    return `Estimated-financials research for ${displayName} is currently unavailable.`;
  }
}

function profileSummary(displayName: string): string {
  return `${displayName} — global public company research target`;
}

function mostCommonCurrency(points: FinancialPoint[]): string {
  const counts = new Map<string, number>();
  for (const p of points) {
    const c = (p.currency || 'USD').toUpperCase();
    counts.set(c, (counts.get(c) || 0) + 1);
  }
  let best = 'USD';
  let bestN = -1;
  for (const [c, n] of counts) {
    if (n > bestN) {
      bestN = n;
      best = c;
    }
  }
  return best;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function safeJsonParse(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    try {
      const start = trimmed.indexOf('{');
      const end = trimmed.lastIndexOf('}');
      if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      /* fallthrough */
    }
    return null;
  }
}

export function formatCurrency(value: number, currency = 'USD'): string {
  const abs = Math.abs(value);
  const symbol = currency === 'USD' ? '$' : ` ${currency} `;
  if (abs >= 1e12) return `${symbol}${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${symbol}${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${symbol}${(value / 1e6).toFixed(1)}M`;
  return `${symbol}${Math.round(value).toLocaleString()}`;
}