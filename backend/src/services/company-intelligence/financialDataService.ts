import { CompanyFinancial } from '../../models/CompanyFinancial';
import { CompanyFinancialEnrichment } from '../../models/CompanyFinancialEnrichment';
import { activeAIProvider } from '../aiProvider';
import { logger } from '../../config/logger';
import { CompanyProfileLite, CompanySegments, FinancialPoint, SegmentRevenueItem } from '../../types/businessIntelligence';

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
  /** Segment breakdowns (regional / product / customer) for this company. */
  segments: CompanySegments;
  notes: string[];
  sources: Array<{ type: FinancialPoint['sourceType']; title: string; source: string; detail: string; retrievedAt?: string; confidence?: number | null }>;
}

/**
 * Load an annual financial series for a company.
 *
 * Sources (merged by year):
 *   1. reported   — real values from the connected data source (company
 *                   knowledge base revenue record / explicitly stored figures).
 *   2. estimated  — AI-referenced figures retrieved by `researchAndCache`,
 *                   cached in the CompanyFinancial collection (sourceType
 *                   "ai_reference"). These are ESTIMATES, never presented as
 *                   verified real data.
 *
 * Segment breakdowns (regional / product / customer) are cached per-company in
 * CompanyFinancialEnrichment and returned as clearly-labelled estimates.
 * Empty arrays mean the connected data source provided no such data for this
 * company — never invented here.
 *
 * Retrieval semantics:
 *   - `refresh: true`         → always re-run the retrieval step.
 *   - `retrieveIfEmpty: true` → run retrieval only when the company has no
 *     cached financial data yet, so a normal Analyze never returns "0
 *     historical periods" just because the retrieval step was skipped.
 *
 * If no reliable values can be produced the series is empty and the caller
 * sees `available: false` — no numbers are invented.
 */
export async function getFinancialSeries(opts: {
  nameKey: string;
  displayName: string;
  profile: CompanyProfileLite;
  refresh?: boolean;
  retrieveIfEmpty?: boolean;
}): Promise<FinancialSeriesResult> {
  const { nameKey, displayName, profile, refresh, retrieveIfEmpty } = opts;
  const notes: string[] = [];
  const sources: FinancialSeriesResult['sources'] = [];

  let points = await loadSeries(nameKey, displayName, profile);
  let segments = await loadSegments(nameKey);

  // Prefer a directly reported public filing when the profile has a ticker.
  // This fills gaps in the curated profile without mixing in enterprise data
  // or requiring another API credential.
  if (!points.some((point) => point.kind === 'reported') && profile.stockTicker) {
    const secPoints = await retrieveSecFinancials(displayName, profile.stockTicker);
    if (secPoints.length > 0) {
      points = secPoints;
      await persistReportedPoints(nameKey, secPoints);
    }
  }

  // A normal Analyze must still retrieve data for a company the first time it
  // is analyzed (cache is empty); it reuses cached values afterwards. Refresh
  // always re-runs the retrieval step for the current companies.
  if (refresh || (retrieveIfEmpty && points.length === 0)) {
    const refreshed = await researchAndCache(nameKey, displayName, profile);
    if (refreshed) notes.push(refreshed);
    points = await loadSeries(nameKey, displayName, profile);
    segments = await loadSegments(nameKey);
  }

  const estimatedCount = points.filter((p) => p.kind === 'estimated').length;
  const reportedCount = points.filter((p) => p.kind === 'reported').length;

  const segGroups: Array<{ items: SegmentRevenueItem[]; label: string }> = [
    { items: segments.regions, label: 'Regional revenue' },
    { items: segments.products, label: 'Product & segment revenue' },
    { items: segments.customerSegments, label: 'Customer segment data' },
  ];

  if (points.length === 0) {
    notes.push(`Real-world financial data unavailable for ${displayName}.`);
    sources.push({
      type: 'connected_data',
      title: 'No financial data',
      source: 'Connected data sources',
      detail: `No reported or estimated financial figures could be retrieved for ${displayName}.`,
    });
    return { points, available: false, currency: 'USD', segments, notes, sources };
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
  const segTotal = segments.regions.length + segments.products.length + segments.customerSegments.length;
  if (segTotal > 0) {
    notes.push(
      `Segment data available for ${displayName}: ${segments.regions.length} region(s), ${segments.products.length} product segment(s), ${segments.customerSegments.length} customer segment(s) (AI-referenced estimates).`
    );
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
    retrievedAt: p.retrievedAt,
    confidence: p.confidence,
  })));

  for (const g of segGroups) {
    if (!g.items.length) continue;
    sources.push({
      type: 'ai_reference' as const,
      title: `${displayName} · ${g.label} (${g.items.length})`,
      source: g.items[0].source,
      detail: `${displayName} ${g.label.toLowerCase()} breakdown: ${g.items.map((i) => i.name).join(', ')}. AI-referenced estimate — not verified reported data.`,
      retrievedAt: points[0]?.retrievedAt,
      confidence: segmentsAvgConfidence(g.items),
    });
  }

  return { points, available: true, currency, segments, notes, sources };
}

async function retrieveSecFinancials(displayName: string, ticker: string): Promise<FinancialPoint[]> {
  try {
    const tickerResponse = await fetch('https://www.sec.gov/files/company_tickers.json', {
      headers: { Accept: 'application/json', 'User-Agent': 'Enterprise-Intelligence-Platform/1.0 (admin@company.com)' },
    });
    if (!tickerResponse.ok) return [];
    const tickerRows = (await tickerResponse.json()) as Record<string, { ticker?: string; cik_str?: number }>;
    const match = Object.values(tickerRows).find((row) => String(row.ticker || '').toUpperCase() === ticker.toUpperCase());
    if (!match?.cik_str) return [];

    const cik = String(match.cik_str).padStart(10, '0');
    const factsResponse = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Enterprise-Intelligence-Platform/1.0' },
    });
    if (!factsResponse.ok) return [];
    const facts = (await factsResponse.json()) as {
      facts?: { usgaap?: Record<string, { units?: { USD?: Array<{ val?: number; fy?: number; fp?: string; form?: string; end?: string; filed?: string }> } }> };
    };
    const usgaap = facts.facts?.usgaap || {};
    const revenueFact = ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet']
      .map((key) => usgaap[key])
      .find((fact) => fact?.units?.USD?.length);
    const annual = (revenueFact?.units?.USD || [])
      .filter((row) => row.form === '10-K' && row.fp === 'FY' && Number.isFinite(row.val) && Number.isFinite(row.fy))
      .sort((a, b) => Number(a.fy) - Number(b.fy));
    const latestByYear = new Map<number, (typeof annual)[number]>();
    for (const row of annual) latestByYear.set(Number(row.fy), row);

    return [...latestByYear.entries()].map(([year, row]) => ({
      period: `FY${year}`,
      year,
      revenue: Number(row.val),
      profit: null,
      profitMarginPct: null,
      kind: 'reported' as const,
      sourceType: 'connected_data' as const,
      source: `SEC company facts for ${displayName} (${ticker.toUpperCase()})`,
      confidence: 1,
      currency: 'USD',
      note: `Annual revenue reported in the SEC 10-K company facts feed; filed ${row.filed || 'date unavailable'}.`,
      retrievedAt: new Date().toISOString(),
    }));
  } catch (err: any) {
    logger.warn(`[company-intelligence] SEC financial retrieval failed for ${displayName}: ${err?.message || err}`);
    return [];
  }
}

async function persistReportedPoints(nameKey: string, points: FinancialPoint[]): Promise<void> {
  for (const point of points) {
    await CompanyFinancial.findOneAndUpdate(
      { companyKey: nameKey, period: point.period },
      {
        $set: {
          year: point.year,
          revenue: point.revenue,
          profit: point.profit,
          profitMarginPct: point.profitMarginPct,
          currency: point.currency,
          kind: point.kind,
          source: point.source,
          sourceType: point.sourceType,
          confidence: point.confidence,
          note: point.note,
          retrievedAt: point.retrievedAt ? new Date(point.retrievedAt) : new Date(),
        },
      },
      { upsert: true }
    );
  }
}

/** Cached per-company segment breakdowns (regional/product/customer). */
async function loadSegments(nameKey: string): Promise<CompanySegments> {
  const doc = await CompanyFinancialEnrichment.findOne({ companyKey: nameKey }).lean();
  if (!doc) return { regions: [], products: [], customerSegments: [] };
  const mapItem = (s: { name: string; revenue?: number | null; sharePct?: number | null; currency?: string; source?: string; confidence?: number | null; note?: string }): SegmentRevenueItem => ({
    name: s.name,
    revenue: typeof s.revenue === 'number' ? s.revenue : null,
    sharePct: typeof s.sharePct === 'number' ? s.sharePct : null,
    currency: (s.currency || 'USD').toUpperCase(),
    kind: 'estimated',
    sourceType: 'ai_reference',
    source: s.source || 'AI-referenced disclosure estimate',
    confidence: typeof s.confidence === 'number' ? s.confidence : null,
    note: s.note,
  });
  return {
    regions: (doc.segments?.regions ?? []).map(mapItem),
    products: (doc.segments?.products ?? []).map(mapItem),
    customerSegments: (doc.segments?.customerSegments ?? []).map(mapItem),
  };
}

function segmentsAvgConfidence(items: SegmentRevenueItem[]): number | null {
  const vals = items.map((i) => i.confidence).filter((c): c is number => typeof c === 'number' && Number.isFinite(c));
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
}

/** Build the merged (KB reported + cached stored) yearly series for a company. */
async function loadSeries(nameKey: string, displayName: string, profile: CompanyProfileLite): Promise<FinancialPoint[]> {
  const stored = await CompanyFinancial.find({ companyKey: nameKey }).sort({ year: 1 }).lean();

  // Merge real knowledge-base revenue figures as "reported" points.
  const kbRevenue = profile.revenue;
  const reportedKb: FinancialPoint[] = kbRevenue?.amount && kbRevenue.year
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
      }]
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
      retrievedAt: s.retrievedAt ? new Date(s.retrievedAt).toISOString() : undefined,
    });
  }

  return [...pointsByYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, p]) => p);
}

/** Run the AI model to produce clearly-labelled estimated annual figures + segment breakdowns, then cache them. */
async function researchAndCache(nameKey: string, displayName: string, profile: CompanyProfileLite): Promise<string | null> {
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
        {
          year: 2023,
          revenueUSD: 0,
          profitUSD: 0,
          confidence: 0.0,
          note: 'brief basis for this year',
        },
        {
          year: 2022,
          revenueUSD: 0,
          profitUSD: 0,
          confidence: 0.0,
          note: 'brief basis for this year',
        },
      ],
      segments: {
        regions: [{ name: 'Americas', revenueUSD: 0, sharePct: 0.0, confidence: 0.0, note: 'basis for this region figure' }],
        products: [{ name: 'Product or segment', revenueUSD: 0, sharePct: 0.0, confidence: 0.0, note: 'basis for this product figure' }],
        customerSegments: [{ name: 'Customer segment type', revenueUSD: 0, sharePct: 0.0, confidence: 0.0, note: 'basis for this customer figure' }],
      },
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
          `- SEGMENT BREAKDOWN (OPTIONAL, SAME NO-FABRICATION RULE): only when the annual report discloses regional, product/segment, ` +
          `or customer-segment revenue splits AND you are HIGHLY confident of them, list each item under "segments" with its ` +
          `revenueUSD (full amount) or sharePct (percent of total revenue). For any category you are NOT confident about, return [].\n` +
          `- If you cannot provide reliable figures for ANY year, return { "years": [], "note": "No reliable public figures were confidently known." }.\n` +
          `- Return ONLY valid JSON matching this schema:\n${JSON.stringify(schema)}`,
      },
      {
        role: 'user' as const,
        content:
          `Company: ${displayName}\n` +
          (profile.legalName ? `Legal name: ${profile.legalName}\n` : '') +
          (profile.stockTicker ? `Ticker / entity identifier: ${profile.stockTicker}${profile.stockExchange ? ` (${profile.stockExchange})` : ''}\n` : '') +
          (profile.industry ? `Industry: ${profile.industry}${profile.subIndustry ? ` / ${profile.subIndustry}` : ''}\n` : '') +
          `Provide revenue and net profit for EACH of the most recent complete fiscal years you are highly confident about ` +
          `(typically 4-8 years spanning 2025, 2024, 2023, 2022, 2021, ...), plus any confidently-known segment splits. Return the JSON now.`,
      },
    ];

    // One retry on provider error so a single transient failure for one of two
    // companies analyzed in parallel never silently zeroes out that company.
    let raw: string;
    try {
      raw = await provider.complete(messages, { json: true, temperature: 0.2, maxTokens: 2000 });
    } catch (err: any) {
      logger.warn(`[company-intelligence] AI research attempt 1 failed for ${displayName}: ${err?.message || err}`);
      await delay(900);
      raw = await provider.complete(messages, { json: true, temperature: 0.2, maxTokens: 2000 });
    }

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

    const seg = await persistSegments(nameKey, displayName, parsed.segments, now);

    logger.info(
      `[company-intelligence] BI research ok: ${displayName} → ${inserted} estimated year(s), ` +
        `${seg.regions} region(s), ${seg.products} product segment(s), ${seg.customerSegments} customer segment(s).`
    );

    const parts: Array<string | null> = [
      inserted > 0 ? `Retrieved ${inserted} estimated annual figure(s) for ${displayName}.` : null,
      seg.regions + seg.products + seg.customerSegments > 0
        ? `Retrieved ${seg.regions} region(s), ${seg.products} product segment(s), ${seg.customerSegments} customer segment(s) for ${displayName} (estimated).`
        : null,
      inserted === 0 && seg.regions + seg.products + seg.customerSegments === 0
        ? `No new estimated figures could be reliably produced for ${displayName}.`
        : null,
    ];
    return parts.filter(Boolean).join(' ') || null;
  } catch (err: any) {
    logger.warn(`[company-intelligence] Estimated-financials research failed for ${displayName}:`, err?.message || err);
    return `Estimated-financials research for ${displayName} is currently unavailable.`;
  }
}

async function persistSegments(
  nameKey: string,
  displayName: string,
  raw: unknown,
  now: Date
): Promise<{ regions: number; products: number; customerSegments: number }> {
  const empty = { regions: 0, products: 0, customerSegments: 0 };
  const src = raw as { regions?: unknown; products?: unknown; customerSegments?: unknown } | null | undefined;
  if (!src) return empty;

  const cleanList = (list: unknown): Array<{
    name: string;
    revenue: number | null;
    sharePct: number | null;
    currency: string;
    source: string;
    confidence: number | null;
    note?: string;
  }> => {
    if (!Array.isArray(list)) return [];
    const out: ReturnType<typeof cleanList> = [];
    for (const it of list as Array<Record<string, unknown>>) {
      const name = typeof it?.name === 'string' ? it.name.trim() : '';
      if (!name) continue;
      const revenue = Number(it.revenueUSD);
      const sharePct = Number(it.sharePct);
      const hasRevenue = Number.isFinite(revenue) && revenue >= 0;
      const hasShare = Number.isFinite(sharePct) && sharePct > 0;
      if (!hasRevenue && !hasShare) continue;
      out.push({
        name,
        revenue: hasRevenue ? revenue : null,
        sharePct: hasShare ? clamp(sharePct, 0, 100) : null,
        currency: 'USD',
        source: `AI-referenced public disclosure estimate (${displayName} ${name})`,
        confidence: clamp(Number(it.confidence) || 0.5, 0, 1),
        note: typeof it.note === 'string' ? it.note : undefined,
      });
    }
    return out;
  };

  const regions = cleanList(src.regions);
  const products = cleanList(src.products);
  const customerSegments = cleanList(src.customerSegments);
  if (!regions.length && !products.length && !customerSegments.length) return empty;

  await CompanyFinancialEnrichment.findOneAndUpdate(
    { companyKey: nameKey },
    {
      $set: {
        displayName,
        segments: { regions, products, customerSegments },
        source: 'AI-referenced public disclosure estimates',
        retrievedAt: now,
      },
    },
    { upsert: true }
  );
  return { regions: regions.length, products: products.length, customerSegments: customerSegments.length };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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