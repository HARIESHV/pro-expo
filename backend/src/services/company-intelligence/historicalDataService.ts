import {
  FinancialPoint,
  GrowthInfo,
  HistoricalPoint,
} from '../../types/businessIntelligence';

// ===========================================================================
// historicalDataService — Past Analysis.
//
// Computes historical revenue, growth/decline per period, YoY comparisons and
// key findings using ONLY the actual values present in the supplied series.
// Missing years are left as `revenue: null` (Data unavailable) and are never
// interpolated.
// ===========================================================================

export interface HistoricalAnalysisResult {
  available: boolean;
  points: HistoricalPoint[];
  yoyGrowth: GrowthInfo;
  keyFindings: string[];
  notes: string[];
}

export function analyzeHistorical(
  displayName: string,
  series: FinancialPoint[]
): HistoricalAnalysisResult {
  const notes: string[] = [];
  const withRevenue = series.filter((p) => p.revenue != null);

  if (withRevenue.length === 0) {
    notes.push(`No historical revenue data available for ${displayName}.`);
    return {
      available: false,
      points: series.map((p) => ({
        periodLabel: p.period,
        year: p.year,
        revenue: null,
        revenueDisplay: null,
        growthPct: null,
        direction: 'unavailable',
        kind: p.kind,
      })),
      yoyGrowth: emptyGrowth(),
      keyFindings: [],
      notes,
    };
  }

  const points: HistoricalPoint[] = series.map((p, i) => {
    const prev = i > 0 ? series[i - 1] : null;
    let growthPct: number | null = null;
    let direction: HistoricalPoint['direction'] = 'unavailable';
    if (p.revenue != null && prev?.revenue != null && prev.revenue > 0) {
      growthPct = ((p.revenue - prev.revenue) / prev.revenue) * 100;
      direction = Math.abs(growthPct) < 1e-9 ? 'flat' : growthPct > 0 ? 'up' : 'down';
    }
    return {
      periodLabel: p.period,
      year: p.year,
      revenue: p.revenue,
      revenueDisplay: p.revenue != null ? String(Math.round(p.revenue)) : null,
      growthPct: growthPct != null ? Math.round(growthPct * 10) / 10 : null,
      direction,
      kind: p.kind,
    };
  });

  const last = withRevenue[withRevenue.length - 1];
  const prev = withRevenue.length > 1 ? withRevenue[withRevenue.length - 2] : null;
  const yoyGrowth = computeYoY(last, prev);

  const keyFindings: string[] = [];
  if (yoyGrowth.growthPct != null) {
    const dir = yoyGrowth.direction === 'up' ? 'grew' : yoyGrowth.direction === 'down' ? 'declined' : 'stayed flat';
    keyFindings.push(
      `${displayName} ${dir} ${Math.abs(Math.round((yoyGrowth.growthPct ?? 0) * 10) / 10)}% between ${yoyGrowth.previousLabel} and ${yoyGrowth.currentLabel}.`
    );
  }
  // Largest single-period move in the historical span.
  let largestMove: { pct: number; label: string } | null = null;
  for (const pt of points) {
    if (pt.growthPct != null) {
      if (!largestMove || Math.abs(pt.growthPct) > Math.abs(largestMove.pct)) {
        largestMove = { pct: pt.growthPct, label: pt.periodLabel };
      }
    }
  }
  if (largestMove) {
    keyFindings.push(
      `Largest historical move: ${largestMove.pct > 0 ? '+' : ''}${Math.round(largestMove.pct * 10) / 10}% in ${largestMove.label}.`
    );
  }
  if (points.length > 1) {
    const first = points.find((p) => p.revenue != null);
    const lastPt = [...points].reverse().find((p) => p.revenue != null);
    if (first && lastPt && first.revenue && lastPt.revenue && first.year !== lastPt.year && first.revenue > 0) {
      const cagr = (Math.pow(lastPt.revenue / first.revenue, 1 / (lastPt.year - first.year)) - 1) * 100;
      keyFindings.push(
        `Compound annual growth ${first.year}→${lastPt.year}: approximately ${cagr >= 0 ? '+' : ''}${Math.round(cagr * 10) / 10}% per year (based on available historical values).`
      );
    }
  }
  if (!keyFindings.length) {
    keyFindings.push(`Historical data for ${displayName} is limited — insufficient to derive growth findings.`);
  }

  notes.push(`${withRevenue.length} historical period(s) with available revenue data.`);
  const estimatedCount = withRevenue.filter((p) => p.kind === 'estimated').length;
  if (estimatedCount > 0) {
    notes.push(`${estimatedCount} historical period(s) are AI-referenced estimates, not verified reported data.`);
  }

  return { available: true, points, yoyGrowth, keyFindings, notes };
}

function computeYoY(current: FinancialPoint, previous: FinancialPoint | null): GrowthInfo {
  if (!current || current.revenue == null) {
    return emptyGrowth();
  }
  if (!previous || previous.revenue == null || previous.revenue === 0) {
    return {
      current: current.revenue,
      previous: previous?.revenue ?? null,
      change: null,
      growthPct: null,
      direction: 'insufficient',
      currentLabel: current.period,
      previousLabel: previous?.period ?? '',
    };
  }
  const change = current.revenue - previous.revenue;
  const growthPct = (change / previous.revenue) * 100;
  const direction: GrowthInfo['direction'] =
    Math.abs(growthPct) < 1e-9 ? 'flat' : growthPct > 0 ? 'up' : 'down';
  return {
    current: current.revenue,
    previous: previous.revenue,
    change,
    growthPct: Math.round(growthPct * 10) / 10,
    direction,
    currentLabel: current.period,
    previousLabel: previous.period,
  };
}

function emptyGrowth(): GrowthInfo {
  return {
    current: null,
    previous: null,
    change: null,
    growthPct: null,
    direction: 'unavailable',
    currentLabel: '',
    previousLabel: '',
  };
}