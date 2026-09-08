import { AnomalyItem, FinancialPoint } from '../../types/businessIntelligence';
import { formatCurrency } from './financialDataService';

// ===========================================================================
// anomalyService — Anomaly Detection.
//
// Operates ONLY on the selected company's actual historical time series
// (revenue level deviations + period-over-period growth deviations using a
// z-score / baseline method). Needs at least 3 observed periods; with fewer it
// reports `available: false` ("Insufficient historical company data for
// anomaly detection."). No anomalies are ever invented.
// ===========================================================================

export interface AnomalyDetectionResult {
  available: boolean;
  items: AnomalyItem[];
  method: string;
  scannedPeriods: number;
  reason?: string;
}

const MIN_PERIODS = 3;

export function detectRevenueAnomalies(displayName: string, series: FinancialPoint[]): AnomalyDetectionResult {
  const rows = series
    .filter((p) => p.revenue != null && Number.isFinite(p.revenue))
    .sort((a, b) => a.year - b.year);

  if (rows.length < MIN_PERIODS) {
    return {
      available: false,
      items: [],
      method: 'none',
      scannedPeriods: rows.length,
      reason: `Insufficient historical company data for anomaly detection (${rows.length} of ${MIN_PERIODS} minimum periods with revenue).`,
    };
  }

  const items: AnomalyItem[] = [];
  const vals = rows.map((p) => p.revenue as number);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
  const currency = rows[0].currency || 'USD';

  // 1) Revenue level outliers (z-score around the series baseline).
  if (std > 0 && mean > 0) {
    for (let i = 0; i < rows.length; i++) {
      const z = Math.abs((vals[i] - mean) / std);
      if (z < 1.5) continue;
      const deviationPct = Math.round(((vals[i] - mean) / mean) * 1000) / 10;
      const above = vals[i] > mean;
      items.push({
        period: rows[i].period,
        metric: 'Revenue',
        value: vals[i],
        expected: mean,
        deviationPct,
        level: z >= 2.5 ? 'high' : 'medium',
        description: `${displayName} revenue in ${rows[i].period} (${formatCurrency(vals[i], currency)}) sits ${z.toFixed(1)} standard deviation(s) ${above ? 'above' : 'below'} the ${rows.length}-period baseline (${formatCurrency(mean, currency)}), ${deviationPct >= 0 ? '+' : ''}${deviationPct}%.`,
        evidence: [`Year ${rows[i].period}: ${formatCurrency(vals[i], currency)}`, `Baseline mean: ${formatCurrency(mean, currency)}`],
      });
    }
  }

  // 2) Period-over-period growth anomalies (unusual spikes/plunges).
  const growths: Array<{ pct: number; period: string }> = [];
  for (let i = 1; i < rows.length; i++) {
    if (vals[i - 1] > 0) growths.push({ pct: ((vals[i] - vals[i - 1]) / vals[i - 1]) * 100, period: rows[i].period });
  }
  if (growths.length >= 3) {
    const gm = growths.reduce((s, g) => s + g.pct, 0) / growths.length;
    const gstd = Math.sqrt(growths.reduce((s, g) => s + (g.pct - gm) ** 2, 0) / growths.length);
    if (gstd > 0) {
      for (const g of growths) {
        const dev = g.pct - gm;
        if (Math.abs(dev) < 2 * gstd) continue;
        if (Math.abs(g.pct) <= 10) continue;
        items.push({
          period: g.period,
          metric: 'Revenue growth',
          value: g.pct,
          expected: gm,
          deviationPct: Math.round(dev * 10) / 10,
          level: Math.abs(dev) >= 3 * gstd ? 'high' : 'medium',
          description: `${displayName} grew ${g.pct >= 0 ? '+' : ''}${Math.round(g.pct * 10) / 10}% in ${g.period} against a typical ${gm >= 0 ? '+' : ''}${Math.round(gm * 10) / 10}% period-over-period move — an unusual ${g.pct >= 0 ? 'acceleration' : 'contraction'}.`,
          evidence: [`Growth ${g.period}: ${g.pct >= 0 ? '+' : ''}${Math.round(g.pct * 10) / 10}%`, `Typical growth: ${gm >= 0 ? '+' : ''}${Math.round(gm * 10) / 10}%`],
        });
      }
    }
  }

  return {
    available: true,
    items,
    method: 'z-score deviation on revenue level and period-over-period growth of the company\'s own historical series',
    scannedPeriods: rows.length,
  };
}