import { DataPoint, ForecastPoint, GrowthInfo, TimeGranularity } from './types';

// ===========================================================================
// Aggregation helpers — pure functions over normalized real records.
// No values are invented; zero/absent buckets are simply not emitted.
// ===========================================================================

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface SalesLike {
  amount: number;
  stage?: string;
  region?: string;
  productName?: string;
  channel?: string;
  departmentId?: string | null;
  dealId?: string | null;
  closedAt?: Date | null;
  createdAt?: Date | null;
  period?: { year?: number | null; quarter?: number | null; month?: number | null };
}

export function recordDate(r: SalesLike): Date {
  return r.closedAt || r.createdAt || new Date();
}

function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

export function bucketKey(
  granularity: TimeGranularity,
  r: SalesLike
): { key: string; label: string; } {
  const p = r.period || {};
  const year = p.year ?? recordDate(r).getFullYear();
  const date = recordDate(r);

  if (granularity === 'annual') {
    return { key: String(year), label: String(year) };
  }
  if (granularity === 'quarterly') {
    const q = p.quarter ?? Math.floor(date.getMonth() / 3) + 1;
    return { key: `${year}-Q${q}`, label: `Q${q} ${year}` };
  }
  if (granularity === 'monthly') {
    const m = p.month ?? date.getMonth() + 1;
    return { key: `${year}-${String(m).padStart(2, '0')}`, label: `${MONTHS[m - 1]} ${year}` };
  }
  if (granularity === 'weekly') {
    const { year: wy, week } = isoWeek(date);
    return { key: `${wy}-W${String(week).padStart(2, '0')}`, label: `W${week} ${wy}` };
  }
  // daily
  const dy = date.getFullYear();
  const dm = date.getMonth() + 1;
  const dd = date.getDate();
  return { key: `${dy}-${String(dm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`, label: `${MONTHS[dm - 1]} ${dd}, ${dy}` };
}

export function bucketSortKey(key: string): string {
  return key;
}

/** Aggregate real sales-like records into a time series at the requested granularity. */
export function buildTimeSeries(
  records: SalesLike[],
  granularity: TimeGranularity,
  opts: { includeOnlyClosedWon?: boolean } = {}
): DataPoint[] {
  const map = new Map<string, DataPoint>();
  for (const r of records) {
    if (opts.includeOnlyClosedWon && r.stage !== 'closed_won') continue;
    const { key, label } = bucketKey(granularity, r);
    const existing = map.get(key);
    if (existing) {
      existing.value += r.amount;
      existing.count += 1;
      if (r.dealId) existing.sources = existing.sources || [];
      if (r.dealId) existing.sources!.push(String(r.dealId));
    } else {
      map.set(key, {
        key,
        label,
        value: r.amount,
        count: 1,
        sources: r.dealId ? [String(r.dealId)] : [],
      });
    }
  }
  return [...map.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** Count records per bucket (used for deals, customers, churn). */
export function buildCountSeries(
  records: Array<{ period?: SalesLike['period']; date?: Date; id?: string }>,
  granularity: TimeGranularity
): DataPoint[] {
  const map = new Map<string, DataPoint>();
  for (const r of records) {
    const pseudo: SalesLike = { amount: 0, period: r.period, closedAt: r.date || null, dealId: r.id || null };
    const { key, label } = bucketKey(granularity, pseudo);
    const existing = map.get(key);
    if (existing) {
      existing.value += 1;
      existing.count += 1;
    } else {
      map.set(key, { key, label, value: 1, count: 1, sources: r.id ? [String(r.id)] : [] });
    }
  }
  return [...map.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

export function computeGrowth(current: number, previous: number | null, currentLabel: string, previousLabel: string): GrowthInfo {
  const change = current - (previous ?? 0);
  const direction: GrowthInfo['direction'] =
    previous == null || previous === 0 ? 'insufficient' : Math.abs(change) < 1e-9 ? 'flat' : change > 0 ? 'up' : 'down';
  const growthPct = previous != null && previous > 0 ? (change / previous) * 100 : null;
  return { change, growthPct, direction, current, previous, currentLabel, previousLabel };
}

/** Compare the last two non-empty buckets of an actual series. */
export function latestGrowth(series: DataPoint[]): GrowthInfo {
  if (series.length === 0) {
    return computeGrowth(0, null, '', '');
  }
  const current = series[series.length - 1];
  if (series.length === 1) {
    return computeGrowth(current.value, null, current.label, '');
  }
  const previous = series[series.length - 2];
  return computeGrowth(current.value, previous.value, current.label, previous.label);
}

export function sumSeries(series: DataPoint[]): number {
  return series.reduce((acc, p) => acc + p.value, 0);
}

export function labelFromKey(granularity: TimeGranularity, key: string): string {
  const d: SalesLike & { period?: { year: number; quarter: number; month: number } } = {
    amount: 0,
    period: { year: 2026, quarter: 1, month: 1 },
    closedAt: new Date(),
  };
  if (granularity === 'annual') {
    const y = parseInt(key, 10);
    return String(y || key);
  }
  const parts = key.split('-');
  const y = parseInt(parts[0], 10);
  if (granularity === 'quarterly') return `Q${parts[1].replace('Q', '')} ${y}`;
  if (granularity === 'monthly') return `${MONTHS[parseInt(parts[1], 10) - 1]} ${y}`;
  if (granularity === 'weekly') return `W${parseInt(parts[1].replace('W', ''), 10)} ${y}`;
  return key;
}

/** Advance a bucket key to the next bucket of the same granularity. */
export function nextBucketKey(granularity: TimeGranularity, key: string): string {
  if (granularity === 'annual') return String(parseInt(key, 10) + 1);
  if (granularity === 'quarterly') {
    const [y, qs] = key.split('-');
    let q = parseInt(qs.replace('Q', ''), 10);
    let yy = parseInt(y, 10);
    q += 1;
    if (q > 4) {
      q = 1;
      yy += 1;
    }
    return `${yy}-Q${q}`;
  }
  if (granularity === 'monthly') {
    const [y, ms] = key.split('-');
    let m = parseInt(ms, 10);
    let yy = parseInt(y, 10);
    m += 1;
    if (m > 12) {
      m = 1;
      yy += 1;
    }
    return `${yy}-${String(m).padStart(2, '0')}`;
  }
  if (granularity === 'weekly') {
    const [y, w] = key.split('-');
    let week = parseInt(w.replace('W', ''), 10);
    let yy = parseInt(y, 10);
    week += 1;
    if (week > 52) {
      week = 1;
      yy += 1;
    }
    return `${yy}-W${String(week).padStart(2, '0')}`;
  }
  // daily
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

export interface ForecastInput {
  series: DataPoint[];
  granularity: TimeGranularity;
  horizon: number;
  requiredMinPoints?: number;
}

export interface ForecastOutput {
  available: boolean;
  reason?: string;
  requiredMinPoints: number;
  actualPoints: number;
  points: ForecastPoint[];
  direction: 'up' | 'down' | 'flat' | 'unknown';
  confidence: number | null;
  historicalBasis: string[];
  assumptions: string[];
  methodology: 'linear-regression' | 'none';
}

/**
 * Build a validated forecast from an actual time series using ordinary least
 * squares regression. Predictions are only produced when at least
 * `requiredMinPoints` actual buckets exist; otherwise `available: false` and a
 * clear reason is returned so the dashboard never invents a forecast.
 */
export function buildForecast(input: ForecastInput): ForecastOutput {
  const requiredMinPoints = input.requiredMinPoints ?? 4;
  const { series, granularity, horizon } = input;

  if (series.length < requiredMinPoints) {
    return {
      available: false,
      reason: 'Insufficient historical data.',
      requiredMinPoints,
      actualPoints: series.length,
      points: [],
      direction: 'unknown',
      confidence: null,
      historicalBasis: series.map((p) => p.label),
      assumptions: [`Forecasting requires at least ${requiredMinPoints} historical periods; only ${series.length} available.`],
      methodology: 'none',
    };
  }

  const n = series.length;
  const xs = series.map((_, i) => i);
  const ys = series.map((p) => p.value);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  const denom = xs.reduce((s, x) => s + (x - meanX) ** 2, 0);

  let slope = 0;
  let intercept = meanY;
  if (denom !== 0) {
    slope = xs.reduce((s, x, i) => s + (x - meanX) * (ys[i] - meanY), 0) / denom;
    intercept = meanY - slope * meanX;
  }

  // Fit quality: 1 - SSE/SST (coefficient of determination).
  const sst = ys.reduce((s, y) => s + (y - meanY) ** 2, 0);
  const sse = sst === 0 ? 0 : xs.reduce((s, x, i) => s + (ys[i] - (intercept + slope * x)) ** 2, 0);
  const r2 = sst === 0 ? 1 : Math.max(0, 1 - sse / sst);

  const points: ForecastPoint[] = [];
  let key = series[n - 1].key;
  for (let k = 1; k <= horizon; k++) {
    key = nextBucketKey(granularity, key);
    const t = n - 1 + k;
    const value = Math.max(0, Math.round(intercept + slope * t));
    const scatter = Math.sqrt(sst / Math.max(n - 1, 1));
    const band = Math.round(scatter * (0.5 + 0.5 * (k / horizon)));
    points.push({
      key,
      label: labelFromKey(granularity, key),
      value,
      kind: 'forecast',
      lowerBound: Math.max(0, value - band),
      upperBound: value + band,
    });
  }

  const spread = Math.abs(meanY) || 1;
  const direction: ForecastOutput['direction'] =
    Math.abs(slope) * n <= spread * 0.02 ? 'flat' : slope > 0 ? 'up' : 'down';

  const dataVolumeFactor = Math.min(1, series.length / (requiredMinPoints * 2));
  const confidence = Math.max(0.3, Math.min(0.92, 0.35 * dataVolumeFactor + 0.55 * r2));

  return {
    available: true,
    requiredMinPoints,
    actualPoints: series.length,
    points,
    direction,
    confidence,
    historicalBasis: series.map((p) => p.label),
    assumptions: [
      'Forecast is projected from the linear trend of actual historical periods.',
      'Predicted values are labelled as forecast and should not be treated as actual revenue.',
      'External market factors (competitor moves, macro shifts) are not modeled.',
    ],
    methodology: 'linear-regression',
  };
}

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function pct(a: number, b: number): number | null {
  if (b === 0) return null;
  return ((a - b) / b) * 100;
}