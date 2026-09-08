import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
} from 'recharts';
import {
  Building2,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Calendar,
  Database,
  Crosshair,
  Scale,
} from 'lucide-react';
import { CompanyProfile } from '../../types';
import { companyApi } from '../../api/companies';
import {
  CompanyAIInsights,
  CompanyAnalysisResult,
  CompanyComparison,
  CompanyIntelligence,
  CompanySourceItem,
  Direction,
} from '../../types/businessIntelligence';
import { cn } from '../../utils/cn';

// ---------------------------------------------------------------------------
// Formatting helpers (kept consistent with the existing BI dashboard)
// ---------------------------------------------------------------------------
const money = (v: number | null | undefined): string => (v == null || !Number.isFinite(v) ? '—' : `$${Math.round(v).toLocaleString()}`);
const compact = (v: number | null | undefined): string => {
  if (v == null || !Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};
const pct = (v: number | null | undefined): string => (v == null || !Number.isFinite(v) ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`);
const fmtDate = (iso?: string): string => (iso ? new Date(iso).toLocaleString() : '—');

const TOOLTIP_STYLE = { background: 'hsl(222,47%,9%)', border: '1px solid hsl(222,47%,15%)', borderRadius: '8px' };
const AXIS_TICK = { fill: '#6b7280', fontSize: 10 };

// ---------------------------------------------------------------------------
// Small structural helpers
// ---------------------------------------------------------------------------
function PanelCard({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-6 card-glow animate-fade-in">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-semibold text-foreground text-sm uppercase tracking-wider">{title}</h2>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

function ChartEmpty({ text = 'Insufficient data for reliable charting.' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <Database className="w-8 h-8 text-muted-foreground mb-3" />
      <p className="text-sm text-foreground/80">{text}</p>
    </div>
  );
}

function ProvenanceChip({ kind }: { kind: 'reported' | 'estimated' | 'forecast' }) {
  const map = {
    reported: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    estimated: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    forecast: 'bg-sky-500/10 border-sky-500/30 text-sky-400',
  } as const;
  return <span className={cn('text-[10px] uppercase px-2 py-0.5 rounded-full border font-semibold', map[kind])}>{kind}</span>;
}

function DirectionIcon({ dir }: { dir: Direction }) {
  if (dir === 'up') return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
  if (dir === 'down') return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
  return <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />;
}

// ---------------------------------------------------------------------------
// Chart data builders
// ---------------------------------------------------------------------------
function useRevenueTrendRows(result: CompanyAnalysisResult | undefined) {
  return useMemo(() => {
    if (!result) return [];
    const long = result.revenueTrend.long;
    const short = result.revenueTrend.short;
    const map = new Map<string, { period: string; long?: number | null; short?: number | null; longFc?: number | null; shortFc?: number | null }>();
    long.actual.forEach((p) => map.set(p.period, { period: p.period, ...(map.get(p.period) || {}), long: p.value }));
    short.actual.forEach((p) => map.set(p.period, { period: p.period, ...(map.get(p.period) || {}), short: p.value }));
    long.forecast.forEach((p) => map.set(p.period, { period: p.period, ...(map.get(p.period) || {}), longFc: p.value }));
    short.forecast.forEach((p) => map.set(p.period, { period: p.period, ...(map.get(p.period) || {}), shortFc: p.value }));
    return [...map.values()];
  }, [result]);
}

function useTimelineRows(info: CompanyIntelligence | undefined) {
  return useMemo(() => {
    if (!info) return [];
    const rows: Array<{ period: string; actual?: number | null; forecast?: number | null; type: string }> = info.historical.points.map((p) => ({
      period: p.periodLabel,
      actual: p.revenue,
      type: p.kind === 'reported' ? 'actual' : 'estimated',
    }));
    info.future.points.forEach((p) => rows.push({ period: p.period, forecast: p.value, type: 'forecast' }));
    return rows.sort((a, b) => a.period.localeCompare(b.period));
  }, [info]);
}

// ---------------------------------------------------------------------------
// Company picker with real-KB autocomplete
// ---------------------------------------------------------------------------
function CompanyPicker({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<CompanyProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', click);
    return () => document.removeEventListener('mousedown', click);
  }, []);

  const runSearch = (q: string) => {
    if (!q.trim()) {
      setOptions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    companyApi
      .search(q, { limit: 8 })
      .then((resp) => setOptions(resp?.data?.data?.results.map((r) => r.company) || []))
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, open]);

  return (
    <div className="relative flex-1 min-w-[220px]" ref={rootRef}>
      <label className="block text-[10px] uppercase font-semibold text-muted-foreground mb-1">{label}</label>
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input
          value={value}
          onFocus={() => {
            setOpen(true);
            if (value.trim()) runSearch(value);
          }}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          placeholder={placeholder || 'e.g. Apple'}
          className="w-full h-9 rounded-lg border border-input bg-card pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-input"
        />
        {loading ? <Loader2 className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin" /> : null}
      </div>
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-border bg-card shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
          {options.length ? (
            options.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onChange(c.displayName);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-secondary text-xs flex items-start gap-2"
              >
                <Building2 className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <span>
                  <span className="block text-foreground font-medium">{c.displayName}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {[c.industry, c.subIndustry, c.stockTicker && `NYSE: ${c.stockTicker}`, c.countries[0]]
                      .filter(Boolean)
                      .join(' · ') || 'Company knowledge base'}
                  </span>
                </span>
              </button>
            ))
          ) : searched && !loading ? (
            <p className="px-3 py-2 text-[11px] text-muted-foreground">No known companies match “{value}”. Analysis will treat it as unknown but still run.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result sections
// ---------------------------------------------------------------------------
function CompanyProfileCard({ info, side }: { info: CompanyIntelligence; side: 'long' | 'short' }) {
  const p = info.profile;
  const accent = side === 'long' ? 'border-emerald-500/25' : 'border-red-500/25';
  const badge = side === 'long' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30';
  return (
    <div className={`glass rounded-2xl p-6 card-glow border ${accent}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Crosshair className={cn('w-4 h-4', side === 'long' ? 'text-emerald-400' : 'text-red-400')} />
          <h2 className="font-semibold text-foreground text-sm uppercase tracking-wider">Long · {p.displayName}</h2>
        </div>
        <span className="text-[10px] uppercase px-2 py-0.5 rounded-full border font-semibold">{side} company</span>
      </div>
      {!info.resolution.resolved && (
        <p className="text-[11px] text-amber-400 mb-2 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
          Not found in the connected knowledge base — most facts below are unavailable.
        </p>
      )}
      <div className="text-[11px] text-muted-foreground space-y-1 mb-3">
        {p.industry && <p>Industry: <span className="text-foreground/80">{[p.industry, p.subIndustry].filter(Boolean).join(' / ')}</span></p>}
        {p.foundedYear && <p>Founded: <span className="text-foreground/80">{p.foundedYear}</span></p>}
        {p.headquarters?.country && <p>HQ: <span className="text-foreground/80">{[p.headquarters.city, p.headquarters.country].filter(Boolean).join(', ')}</span></p>}
        {p.stockTicker && <p>Ticker: <span className="text-foreground/80">{p.stockTicker}{p.stockExchange ? ` (${p.stockExchange})` : ''}</span></p>}
        {p.employeeRange?.approx && <p>Employees: <span className="text-foreground/80">{p.employeeRange.approx}</span></p>}
        {p.competitors?.length > 0 && <p>Competitors: <span className="text-foreground/80">{p.competitors.slice(0, 4).join(', ')}</span></p>}
      </div>
      {p.description && <p className="text-xs text-foreground/80 leading-relaxed line-clamp-3">{p.description}</p>}
      <div className="flex flex-wrap gap-1.5 mt-3">
        <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-semibold', badge)}>{info.momentum === 'up' ? 'Momentum ↑' : info.momentum === 'down' ? 'Momentum ↓' : 'Momentum →'}</span>
        <ProvenanceChip kind={info.historical.points.length && info.historical.points[info.historical.points.length - 1].kind === 'reported' ? 'reported' : 'estimated'} />
      </div>
    </div>
  );
}

function ComparisonTiles({ comparison }: { comparison: CompanyComparison }) {
  const leaderColor = (l: 'long' | 'short' | 'tie' | 'unavailable') =>
    l === 'long' ? 'text-emerald-400' : l === 'short' ? 'text-red-400' : l === 'tie' ? 'text-amber-400' : 'text-muted-foreground';
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
      <div className="glass rounded-2xl p-5 card-glow">
        <p className="text-[11px] uppercase font-semibold text-muted-foreground">Latest Revenue</p>
        <p className="text-xl font-bold text-foreground">{money(comparison.long.latestRevenue)}</p>
        <p className="text-[11px] text-muted-foreground">{comparison.long.displayName}</p>
      </div>
      <div className="glass rounded-2xl p-5 card-glow">
        <p className="text-[11px] uppercase font-semibold text-muted-foreground">Latest Revenue</p>
        <p className="text-xl font-bold text-foreground">{money(comparison.short.latestRevenue)}</p>
        <p className="text-[11px] text-muted-foreground">{comparison.short.displayName}</p>
      </div>
      <div className="glass rounded-2xl p-5 card-glow">
        <p className="text-[11px] uppercase font-semibold text-muted-foreground">Revenue Delta</p>
        <p className="text-xl font-bold text-foreground">{comparison.revenueDelta != null && comparison.revenueDelta >= 0 ? '+' : ''}{money(comparison.revenueDelta)}</p>
        <p className="text-[11px] text-muted-foreground">
          {comparison.revenueRatio != null ? `${comparison.revenueRatio.toFixed(1)}×` : 'ratio n/a'} · normalized
        </p>
      </div>
      <div className="glass rounded-2xl p-5 card-glow">
        <p className="text-[11px] uppercase font-semibold text-muted-foreground">Growth Spread</p>
        <p className={cn('text-xl font-bold', (comparison.growthDeltaPct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>{pct(comparison.growthDeltaPct)}</p>
        <p className="text-[11px] text-muted-foreground">long vs short</p>
      </div>
      <div className="glass rounded-2xl p-5 card-glow">
        <p className="text-[11px] uppercase font-semibold text-muted-foreground">Leaders</p>
        <p className={cn('text-sm font-semibold', leaderColor(comparison.revenueLeader))}>Revenue: {comparison.revenueLeader}</p>
        <p className={cn('text-sm font-semibold', leaderColor(comparison.growthLeader))}>Growth: {comparison.growthLeader}</p>
      </div>
    </div>
  );
}

function RevenueTrendChart({ result }: { result: CompanyAnalysisResult }) {
  const rows = useRevenueTrendRows(result);
  const hasActual = rows.some((r) => r.long != null || r.short != null);
  const hasForecast = rows.some((r) => r.longFc != null || r.shortFc != null);
  const longName = result.companies.long.profile.displayName || 'Long';
  const shortName = result.companies.short.profile.displayName || 'Short';
  return (
    <PanelCard
      title="Revenue Trend"
      subtitle={`${longName} vs ${shortName} · solid = actual/estimated, dashed = forecast`}
      actions={<div className="flex items-center gap-2">{(['reported', 'estimated', 'forecast'] as const).map((k) => <ProvenanceChip key={k} kind={k} />)}</div>}
    >
      {rows.length && (hasActual || hasForecast) ? (
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="period" tick={AXIS_TICK} interval="preserveStartEnd" />
            <YAxis tick={AXIS_TICK} tickFormatter={compact} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => money(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="long" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} name={`${longName} (actual/est.)`} connectNulls />
            <Line type="monotone" dataKey="short" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} name={`${shortName} (actual/est.)`} connectNulls />
            {hasForecast && (
              <Line type="monotone" dataKey="longFc" stroke="#34d399" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3 }} name={`${longName} (forecast)`} connectNulls />
            )}
            {hasForecast && (
              <Line type="monotone" dataKey="shortFc" stroke="#f87171" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3 }} name={`${shortName} (forecast)`} connectNulls />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <ChartEmpty text="No revenue data available from the connected data source." />
      )}
    </PanelCard>
  );
}

function GrowthComparisonChart({ result }: { result: CompanyAnalysisResult }) {
  const data = result.growthComparison.map((g) => ({ period: g.period, long: g.longGrowthPct, short: g.shortGrowthPct }));
  const longName = result.companies.long.profile.displayName || 'Long';
  const shortName = result.companies.short.profile.displayName || 'Short';
  return (
    <PanelCard title="Growth Comparison" subtitle="Period-over-period revenue growth % per company">
      {data.length ? (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="period" tick={AXIS_TICK} />
            <YAxis tick={AXIS_TICK} tickFormatter={(v: number) => `${v}%`} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [v==null?'—':`${v>0?'+':''}${v.toFixed(1)}%`, n]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="long" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} name={longName} />
            <Line type="monotone" dataKey="short" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} name={shortName} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <ChartEmpty text="Not enough periods to compare growth." />
      )}
    </PanelCard>
  );
}

function TimelineChart({ info, side }: { info: CompanyIntelligence; side: 'long' | 'short' }) {
  const rows = useTimelineRows(info);
  const color = side === 'long' ? '#10b981' : '#ef4444';
  const hasFc = rows.some((r) => r.forecast != null);
  return (
    <PanelCard
      title={`${info.profile.displayName || side} · Past → Present → Future`}
      subtitle={`${info.historical.points.length} historical period(s) · ${info.future.points.length} projected · forecast ${pct(info.future.projectedGrowthPct)}`}
    >
      {info.historical.available || info.future.available ? (
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="period" tick={AXIS_TICK} interval="preserveStartEnd" />
            <YAxis tick={AXIS_TICK} tickFormatter={compact} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [money(v), n]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="actual" stroke={color} strokeWidth={2.5} dot={{ r: 3 }} name="Actual/estimated" connectNulls />
            {hasFc && (
              <Line type="monotone" dataKey="forecast" stroke={color} strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3, fill: color }} name="Forecast" connectNulls />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <ChartEmpty text={info.future.reason || 'No historical or forecast data available.'} />
      )}
      {info.present.available && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground font-semibold">Latest ({info.present.latestRevenueLabel})</p>
            <p className="text-sm font-bold text-foreground">{money(info.present.latestRevenue)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground font-semibold">Growth</p>
            <p className="text-sm font-bold text-foreground">{pct(info.present.growthPct)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground font-semibold">Profit</p>
            <p className="text-sm font-bold text-foreground">
              {info.present.profit != null ? money(info.present.profit) : '—'}
              {info.present.profitMarginPct != null ? <span className="block text-[10px] text-muted-foreground font-normal">{info.present.profitMarginPct}% margin</span> : null}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground font-semibold">Direction</p>
            <div className="flex justify-center items-center gap-1 text-sm font-bold text-foreground">
              <DirectionIcon dir={info.present.direction} />
              <span className="normal-case">{info.present.direction}</span>
            </div>
          </div>
        </div>
      )}
    </PanelCard>
  );
}

function RisksOpportunitiesSection({ result }: { result: CompanyAnalysisResult }) {
  const hasAny =
    result.companies.long.risks.length ||
    result.companies.short.risks.length ||
    result.companies.long.opportunities.length ||
    result.companies.short.opportunities.length ||
    result.companies.long.strengths.length ||
    result.companies.short.strengths.length ||
    result.companies.long.weaknesses.length ||
    result.companies.short.weaknesses.length;
  if (!hasAny) {
    return (
      <PanelCard title="Risks & Opportunities" subtitle="Derived from gathered data">
        <ChartEmpty text="Not enough data to derive risks, opportunities, strengths or weaknesses." />
      </PanelCard>
    );
  }
  return (
    <PanelCard title="Strengths, Weaknesses, Risks & Opportunities" subtitle="Independently derived for each selected company from the available data">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(['long', 'short'] as const).map((side) => {
          const info = result.companies[side];
          const name = info.profile.displayName || side;
          return (
            <div key={side} className="rounded-xl bg-secondary/30 border border-border/50 p-4">
              <p className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wide">{name}</p>
              {info.strengths.length ? (
                <div className="mb-3">
                  <p className="text-[10px] uppercase font-semibold text-emerald-400 mb-1.5">Strengths</p>
                  <ul className="space-y-1">
                    {info.strengths.map((s, i) => (
                      <li key={i} className="text-[11px] text-foreground/80 flex gap-1.5"><span className="text-emerald-400">•</span>{s.title}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {info.weaknesses.length ? (
                <div className="mb-3">
                  <p className="text-[10px] uppercase font-semibold text-amber-400 mb-1.5">Weaknesses</p>
                  <ul className="space-y-1">
                    {info.weaknesses.map((w, i) => (
                      <li key={i} className="text-[11px] text-foreground/80 flex gap-1.5"><span className="text-amber-400">•</span>{w.title}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {info.risks.length ? (
                <div className="mb-3">
                  <p className="text-[10px] uppercase font-semibold text-red-400 mb-1.5">Risks</p>
                  {info.risks.slice(0, 4).map((r, i) => (
                    <div key={i} className="rounded-lg bg-red-500/5 border border-red-500/20 p-2.5 mb-1.5">
                      <p className="text-[11px] font-semibold text-foreground">{r.title}</p>
                      <p className="text-[11px] text-muted-foreground">{r.description}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              {info.opportunities.length ? (
                <div>
                  <p className="text-[10px] uppercase font-semibold text-emerald-400 mb-1.5">Opportunities</p>
                  {info.opportunities.slice(0, 3).map((o, i) => (
                    <div key={i} className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-2.5 mb-1.5">
                      <p className="text-[11px] font-semibold text-foreground">{o.title}</p>
                      <p className="text-[11px] text-muted-foreground">{o.detail}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </PanelCard>
  );
}

function InsightsSection({ ai }: { ai: CompanyAIInsights }) {
  const blobs: Array<{ label: string; text?: string }> = [
    { label: 'Revenue Analysis', text: ai.revenueAnalysis },
    { label: 'Growth Analysis', text: ai.growthAnalysis },
    { label: 'Risk Analysis', text: ai.riskAnalysis },
    { label: 'Opportunity Analysis', text: ai.opportunityAnalysis },
    { label: 'Long vs Short Comparison', text: ai.longVsShortComparison },
    { label: 'Future Outlook', text: ai.futureOutlook },
  ];
  return (
    <PanelCard
      title="AI Insights"
      subtitle={`${ai.provider} · generated ${fmtDate(ai.generatedAt)}`}
      actions={<Sparkles className="w-4 h-4 text-primary" />}
    >
      <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 mb-4">
        <p className="text-[11px] uppercase font-semibold text-muted-foreground mb-1">Executive Summary</p>
        <p className="text-sm text-foreground/90 leading-relaxed">{ai.executiveSummary}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {ai.historicalInsights.length > 0 && (
          <div className="rounded-xl bg-secondary/30 border border-border/50 p-4">
            <p className="text-[11px] uppercase font-semibold text-muted-foreground mb-2">Historical Insights</p>
            <ul className="space-y-1.5">{[...ai.historicalInsights].slice(0, 6).map((s, i) => <li key={i} className="text-xs text-foreground/80 flex gap-1.5"><span className="text-primary">•</span>{s}</li>)}</ul>
          </div>
        )}
        {ai.currentInsights.length > 0 && (
          <div className="rounded-xl bg-secondary/30 border border-border/50 p-4">
            <p className="text-[11px] uppercase font-semibold text-muted-foreground mb-2">Current Insights</p>
            <ul className="space-y-1.5">{[...ai.currentInsights].slice(0, 6).map((s, i) => <li key={i} className="text-xs text-foreground/80 flex gap-1.5"><span className="text-primary">•</span>{s}</li>)}</ul>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {blobs.filter((b) => b.text && b.text.trim()).map((b) => (
          <div key={b.label} className="rounded-xl bg-foreground/[0.03] border border-border/50 p-4">
            <p className="text-[11px] uppercase font-semibold text-muted-foreground mb-1">{b.label}</p>
            <p className="text-xs text-foreground/80 leading-relaxed">{b.text}</p>
          </div>
        ))}
        <div className="md:col-span-3 rounded-xl bg-gradient-to-br from-emerald-500/10 to-red-500/5 border border-border/50 p-4">
          <p className="text-[11px] uppercase font-semibold text-muted-foreground mb-1">Final Business Intelligence Summary</p>
          <p className="text-xs text-foreground/80 leading-relaxed">{ai.finalBusinessIntelligenceSummary}</p>
        </div>
      </div>
    </PanelCard>
  );
}

function SourcesSection({ sources }: { sources: CompanySourceItem[] }) {
  return (
    <PanelCard title="Data Sources & Provenance" subtitle="Every figure is traced to a source type — nothing is silently invented">
      {sources.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sources.map((s, i) => (
            <div key={i} className="rounded-xl bg-secondary/30 border border-border/50 p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-foreground">{s.title}</p>
                <ProvenanceChip kind={s.type === 'forecast' ? 'forecast' : s.type === 'ai_reference' ? 'estimated' : 'reported'} />
              </div>
              <p className="text-[11px] text-muted-foreground">{s.detail}</p>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {s.company} · {s.type}
                {s.retrievedAt ? ` · retrieved ${fmtDate(s.retrievedAt)}` : ''}
                {s.confidence != null ? ` · confidence ${Math.round(s.confidence * 100)}%` : ''}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <ChartEmpty text="No sources recorded for this analysis." />
      )}
    </PanelCard>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------
export interface CompanyAnalysisPanelProps {
  longCompany: string;
  shortCompany: string;
  onLongCompanyChange: (v: string) => void;
  onShortCompanyChange: (v: string) => void;
  biData: CompanyAnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  onAnalyze: (refresh: boolean) => void;
}

export default function CompanyAnalysisPanel({
  longCompany,
  shortCompany,
  onLongCompanyChange,
  onShortCompanyChange,
  biData,
  isLoading,
  error,
  onAnalyze,
}: CompanyAnalysisPanelProps) {
  const pairValid = longCompany.trim().length >= 2 && shortCompany.trim().length >= 2;
  const lastResult = biData;

  // Never show a previous analysis as if it belonged to the newly typed
  // companies — clear the view (user must re-run Analyze) once the pair drifts.
  const pairChanged =
    !!biData &&
    (biData.companyQuery.long.trim() !== longCompany.trim() || biData.companyQuery.short.trim() !== shortCompany.trim());

  const showResult = !!biData && !isLoading && !pairChanged;

  return (
    <section className="space-y-6">
      <div className="glass rounded-2xl p-6 card-glow animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="font-semibold text-foreground text-sm uppercase tracking-wider flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary" /> Company Analysis · Long vs Short
            </h2>
            <p className="text-xs text-muted-foreground">
              Select two real-world companies. The engine resolves them against the connected knowledge base, gathers reported data,
              produces forecasts, and runs a grounded AI interpretation. Results are stored per organization.
            </p>
          </div>
          {lastResult && !pairChanged && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Calendar className="w-3 h-3" />
              Last updated: {fmtDate(lastResult.lastUpdatedAt)}
            </div>
          )}
        </div>

        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <CompanyPicker label="Long Company" value={longCompany} onChange={onLongCompanyChange} placeholder="e.g. Apple" />
          <span className="hidden md:flex items-center pb-2.5 text-muted-foreground"><ArrowRight className="w-4 h-4" /></span>
          <CompanyPicker label="Short Company" value={shortCompany} onChange={onShortCompanyChange} placeholder="e.g. Samsung" />
          <div className="flex items-end gap-2 pt-1">
            <button
              onClick={() => onAnalyze(false)}
              disabled={!pairValid || isLoading}
              className="flex items-center gap-2 rounded-lg gradient-brand px-4 py-2 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
              {isLoading ? 'Analyzing company data…' : 'Analyze'}
            </button>
            {lastResult && !pairChanged && (
              <button
                onClick={() => onAnalyze(true)}
                disabled={isLoading || !pairValid}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} /> Refresh
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-xs text-red-300">
            {error}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="glass rounded-2xl p-10 card-glow flex flex-col items-center justify-center py-24 animate-fade-in">
          <Loader2 className="w-7 h-7 text-primary animate-spin mb-4" />
          <p className="text-sm text-foreground/80 font-medium">Analyzing company data…</p>
          <p className="text-xs text-muted-foreground mt-1">Resolving entities, gathering reported data, projecting forecasts, and running AI interpretation.</p>
        </div>
      )}

      {showResult && biData && (
        <div className="space-y-6 animate-fade-in">
          {(!biData.companies.long.resolution.resolved || !biData.companies.short.resolution.resolved) && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-2.5 text-xs text-amber-300">
              Unable to identify the requested company. Please check the company name — {[biData.companies.long, biData.companies.short]
                .filter((c) => !c.resolution.resolved)
                .map((c) => `“${c.resolution.displayName}”`)
                .join(' and ')} were not found in the connected knowledge base, so their analysis is limited to whatever data is available.
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground px-1">
            <span className="inline-flex items-center gap-1.5"><Crosshair className="w-3 h-3 text-emerald-400" /> {biData.companyQuery.long}</span>
            <ArrowRight className="w-3 h-3" />
            <span className="inline-flex items-center gap-1.5"><Crosshair className="w-3 h-3 text-red-400" /> {biData.companyQuery.short}</span>
            <span className="ml-auto">Analysis ID: {biData.meta.analysisId} · {biData.meta.currencyNormalization}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CompanyProfileCard info={biData.companies.long} side="long" />
            <CompanyProfileCard info={biData.companies.short} side="short" />
          </div>

          <ComparisonTiles comparison={biData.comparison} />

          <RevenueTrendChart result={biData} />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <GrowthComparisonChart result={biData} />
            <TimelineChart info={biData.companies.long} side="long" />
          </div>

          <TimelineChart info={biData.companies.short} side="short" />

          <RisksOpportunitiesSection result={biData} />

          <InsightsSection ai={biData.aiInsights} />
          <SourcesSection sources={biData.sources} />
        </div>
      )}

      {!isLoading && !showResult ? (
        <div className="glass rounded-2xl py-12 card-glow flex flex-col items-center justify-center text-center animate-fade-in">
          <Building2 className="w-8 h-8 text-muted-foreground mb-3" />
          {pairChanged ? (
            <>
              <p className="text-sm text-foreground/80">Company selection changed.</p>
              <p className="text-xs text-muted-foreground mt-1">Click Analyze to run a fresh analysis for {longCompany.trim() || '—'} vs {shortCompany.trim() || '—'}.</p>
            </>
          ) : biData ? (
            <>
              <p className="text-sm text-foreground/80">Insufficient real-world data available for the selected companies.</p>
              <p className="text-xs text-muted-foreground mt-1">No reliable figures could be gathered; adjust the companies or use Refresh when more data is connected.</p>
            </>
          ) : (
            <>
              <p className="text-sm text-foreground/80">Pick a Long Company and a Short Company, then click Analyze.</p>
              <p className="text-xs text-muted-foreground mt-1">Historical, present and future analysis is built from real available data.</p>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}