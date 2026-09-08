import { FinancialPoint, ForecastPoint, Foresight } from '../../types/businessIntelligence';

// ===========================================================================
// forecastService — Future Analysis / Forecast.
//
// A deterministic ordinary-least-squares projection over the ACTUAL values in
// the supplied series (reported and/or clearly-labelled estimated historical
// points). The forecast is explicitly marked as a prediction with a stated
// basis, confidence bands and assumptions. When fewer than 4 historical
// periods are available the forecast is unavailable — never guessed.
// ===========================================================================

const REQUIRED_MIN_POINTS = 4;
const DEFAULT_HORIZON = 3;

export function generateForecast(
  series: FinancialPoint[],
  horizonYears: number = DEFAULT_HORIZON,
  currency = 'USD'
): Foresight {
  const usable = series
    .filter((p) => p.revenue != null && Number.isFinite(p.revenue))
    .sort((a, b) => a.year - b.year);

  const basis = usable.map((p) => `${p.period}${p.kind === 'estimated' ? ' (est.)' : ''}`);

  if (usable.length < REQUIRED_MIN_POINTS) {
    return {
      available: false,
      reason: `Forecast based on available historical data requires at least ${REQUIRED_MIN_POINTS} historical periods; only ${usable.length} available.`,
      basis,
      horizonYears,
      trendDirection: 'unavailable',
      projectedGrowthPct: null,
      points: [],
    };
  }

  const n = usable.length;
  const xs = usable.map((_, i) => i);
  const ys = usable.map((p) => p.revenue as number);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  const denom = xs.reduce((s, x) => s + (x - meanX) ** 2, 0);

  let slope = 0;
  let intercept = meanY;
  if (denom !== 0) {
    slope = xs.reduce((s, x, i) => s + (x - meanX) * (ys[i] - meanY), 0) / denom;
    intercept = meanY - slope * meanX;
  }

  const sst = ys.reduce((s, y) => s + (y - meanY) ** 2, 0);
  const sse = sst === 0 ? 0 : xs.reduce((s, x, i) => s + (ys[i] - (intercept + slope * x)) ** 2, 0);
  const r2 = sst === 0 ? 1 : Math.max(0, 1 - sse / sst);

  const points: ForecastPoint[] = [];
  const lastYear = usable[n - 1].year;
  for (let k = 1; k <= horizonYears; k++) {
    const t = n - 1 + k;
    const year = lastYear + k;
    const raw = intercept + slope * t;
    const value = Math.max(0, Math.round(raw));
    const scatter = Math.sqrt(sst / Math.max(n - 1, 1));
    const band = Math.round(scatter * (0.5 + 0.5 * (k / horizonYears)));
    const dataVolumeFactor = Math.min(1, n / (REQUIRED_MIN_POINTS * 2));
    const confidence = Math.max(0.3, Math.min(0.92, 0.35 * dataVolumeFactor + 0.55 * r2));
    points.push({
      period: String(year),
      year,
      value,
      currency,
      kind: 'forecast',
      lowerBound: Math.max(0, value - band),
      upperBound: value + band,
      confidence: Math.round(confidence * 100) / 100,
      basis: 'Linear trend of available historical values',
    });
  }

  const spread = Math.abs(meanY) || 1;
  const trendDirection: Foresight['trendDirection'] =
    Math.abs(slope) * n <= spread * 0.02
      ? 'flat'
      : slope > 0
        ? 'up'
        : 'down';

  const perYearGrowth = spread > 0 ? (slope / spread) * 100 : null;

  return {
    available: true,
    reason:
      'Forecast based on available historical data. Projections are predictions, not guaranteed results.',
    basis,
    horizonYears,
    trendDirection,
    projectedGrowthPct: perYearGrowth != null ? Math.round(perYearGrowth * 10) / 10 : null,
    points,
  };
}