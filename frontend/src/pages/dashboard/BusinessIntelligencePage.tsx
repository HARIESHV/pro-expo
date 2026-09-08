import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
  Area,
  ComposedChart,
} from 'recharts';
import {
  TrendingUp,
  Users,
  BarChart2,
  DollarSign,
  Loader2,
  ArrowUpRight,
  MessageSquare,
  FileText,
  AlertTriangle,
  Target,
  Lightbulb,
  Sparkles,
  Calendar,
  Clock,
  Layers,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import { businessIntelligenceApi } from '../../api/businessIntelligence';
import CompanyAnalysisPanel from '../../components/dashboard/CompanyAnalysisPanel';
import { ApiResponse } from '../../types';
import {
  AIAnalysis,
  AnomalyAnalysis,
  CompanyProfile,
  CustomerAnalysis,
  FutureAnalysis,
  GrowthInfo,
  PastAnalysis,
  PresentAnalysis,
  RevenueAnalysis,
  SalesAnalysis,
  TimeGranularity,
} from '../../types/businessIntelligence';

type Tab = 'past' | 'present' | 'future';

const money = (v: number): string => `$${Math.round(v).toLocaleString()}`;

function unwrap<T>(resp: { data?: ApiResponse<T> } | undefined): T | undefined {
  return resp?.data?.data as T | undefined;
}
const compact = (v: number): string => {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};
const pct = (v: number | null): string => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`);
const fmtDate = (iso?: string | null): string => (iso ? new Date(iso).toLocaleString() : '—');

const TOOLTIP_STYLE = { background: 'hsl(222,47%,9%)', border: '1px solid hsl(222,47%,15%)', borderRadius: '8px' };
const AXIS_TICK = { fill: '#6b7280', fontSize: 10 };

function GrowthBadge({ info }: { info: GrowthInfo }) {
  const up = info.direction === 'up';
  const down = info.direction === 'down';
  const color = up ? 'text-emerald-400' : down ? 'text-red-400' : 'text-muted-foreground';
  const arrow = up ? '↑' : down ? '↓' : '→';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${color}`}>
      {arrow} {pct(info.growthPct)}
    </span>
  );
}

function KpiCard({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: React.ReactNode; tone: string }) {
  return (
    <div className="glass rounded-2xl p-5 card-glow hover:glass-hover transition-all duration-300">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg border ${tone} flex items-center justify-center`}>{icon}</div>
        <span className="text-[11px] text-muted-foreground uppercase font-semibold">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub ? <div className="text-xs text-muted-foreground mt-1">{sub}</div> : null}
    </div>
  );
}

function Card({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
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

function Insufficient({ text = 'Insufficient data for reliable analysis.' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <AlertTriangle className="w-8 h-8 text-amber-400 mb-3" />
      <p className="text-sm text-foreground/80">{text}</p>
    </div>
  );
}

function EventItem({ title, detail, label }: { title: string; detail: string; label: string }) {
  return (
    <div className="flex gap-3 border-b border-border/50 last:border-0 py-2.5">
      <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5 w-20 truncate">{label}</span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

export default function BusinessIntelligencePage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('present');
  const [granularity, setGranularity] = useState<TimeGranularity | undefined>(undefined);
  const [aiRequested, setAiRequested] = useState(false);

  const granularityParam = granularity as TimeGranularity | undefined;

  // ------------------------------------------------------------------
  const profileQ = useQuery({
    queryKey: ['bi', 'profile'],
    queryFn: () => businessIntelligenceApi.getProfile(),
    staleTime: 5 * 60 * 1000,
  });
  const profile = unwrap<CompanyProfile>(profileQ.data);

  const enabledForPresent = tab === 'present';

  const revenueQ = useQuery({
    queryKey: ['bi', 'revenue', granularityParam],
    queryFn: () => businessIntelligenceApi.getRevenue(granularityParam),
    enabled: !!profile,
  });
  const revenue = unwrap<RevenueAnalysis>(revenueQ.data);

  const salesQ = useQuery({
    queryKey: ['bi', 'sales', granularityParam],
    queryFn: () => businessIntelligenceApi.getSales(granularityParam),
    enabled: enabledForPresent,
  });
  const sales = unwrap<SalesAnalysis>(salesQ.data);

  const customersQ = useQuery({
    queryKey: ['bi', 'customers', granularityParam],
    queryFn: () => businessIntelligenceApi.getCustomers(granularityParam),
    enabled: enabledForPresent,
  });
  const customers = unwrap<CustomerAnalysis>(customersQ.data);

  const pastQ = useQuery({
    queryKey: ['bi', 'past', granularityParam],
    queryFn: () => businessIntelligenceApi.getPast(granularityParam),
    enabled: tab === 'past',
  });
  const past = unwrap<PastAnalysis>(pastQ.data);

  const presentQ = useQuery({
    queryKey: ['bi', 'present', granularityParam],
    queryFn: () => businessIntelligenceApi.getPresent(granularityParam),
    enabled: enabledForPresent,
  });
  const present = unwrap<PresentAnalysis>(presentQ.data);

  const futureQ = useQuery({
    queryKey: ['bi', 'future', granularityParam],
    queryFn: () => businessIntelligenceApi.getFuture(granularityParam),
    enabled: tab === 'future',
  });
  const future = unwrap<FutureAnalysis>(futureQ.data);

  const anomaliesQ = useQuery({
    queryKey: ['bi', 'anomalies', granularityParam],
    queryFn: () => businessIntelligenceApi.getAnomalies(granularityParam),
    enabled: enabledForPresent,
  });
  const anomalies = unwrap<AnomalyAnalysis>(anomaliesQ.data);

  const aiQ = useQuery({
    queryKey: ['bi', 'analysis', granularityParam],
    queryFn: () => businessIntelligenceApi.getAnalysis(granularityParam),
    enabled: aiRequested,
    staleTime: 10 * 1000,
  });
  const aiAnalysis = unwrap<AIAnalysis>(aiQ.data);

  // ------------------------------------------------------------------
  // Shared derived chart data
  // ------------------------------------------------------------------
  const actualVsForecast = useMemo(() => {
    const actual = (revenue?.series || []).map((p) => ({ name: p.label, actual: p.value }));
    const fc = future?.revenueForecast?.points || [];
    const map = new Map<string, { name: string; actual?: number; forecast?: number; lowerBound?: number; upperBound?: number }>();
    actual.forEach((a) => map.set(a.name, { name: a.name, actual: a.actual }));
    fc.forEach((f) => {
      const row = map.get(f.label) || { name: f.label };
      map.set(f.label, { ...row, forecast: f.value, lowerBound: f.lowerBound, upperBound: f.upperBound });
    });
    return [...map.values()];
  }, [revenue, future]);

  const customerTrend = useMemo(() => {
    const acquisitions = (customers?.acquisitionTrend || past?.customerSeries || []);
    const churn = (customers?.churnTrend || past?.churnSeries || []);
    const map = new Map<string, { name: string; acquired?: number; churned?: number }>();
    acquisitions.forEach((p) => map.set(p.label, { name: p.label, acquired: p.value }));
    churn.forEach((p) => map.set(p.label, { name: p.label, churned: p.value }));
    return [...map.values()];
  }, [customers, past]);

  const regionData = (sales?.breakdown.byRegion || []).slice(0, 6).map((r) => ({ name: r.key, revenue: r.revenue }));
  const productData = (sales?.bestProducts || []).slice(0, 6).map((p) => ({ name: p.key, revenue: p.revenue }));
  const segmentData = (customers?.bySegment || []).map((s) => ({ name: s.key, count: s.count }));
  const priorityData = present?.operations.openTicketsByPriority || [];

  const lastUpdatedAt = present?.lastUpdatedAt || aiAnalysis?.generatedAt || profile?.dataSpan.label ? (present?.lastUpdatedAt ?? aiAnalysis?.generatedAt ?? null) : null;

  const isBlank = !!profile && profile.revenueScale === 0 && profile.customerCount === 0 && profile.transactionCount === 0;

  const handleAskAI = (question: string) => {
    navigate(`/chat?q=${encodeURIComponent(question)}`);
  };

  const tabButtons: Array<{ id: Tab; label: string }> = [
    { id: 'past', label: 'Past' },
    { id: 'present', label: 'Present' },
    { id: 'future', label: 'Future' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-[calc(100vh-4rem)] animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-foreground">Business Intelligence</h1>
          <p className="text-xs text-muted-foreground">Driven by live enterprise data — actuals, forecasts and AI findings</p>
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
            className="flex items-center gap-2 rounded-lg gradient-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90"
          >
            <MessageSquare className="w-3.5 h-3.5" /> Ask AI Agent
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="glass rounded-2xl p-4 mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1 bg-secondary/40 rounded-xl p-1">
          {tabButtons.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === id ? 'bg-primary/90 text-white shadow' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Layers className="w-4 h-4" />
          <span>Granularity</span>
          <select
            value={granularity ?? 'auto'}
            onChange={(e) => setGranularity(e.target.value === 'auto' ? undefined : (e.target.value as TimeGranularity))}
            className="bg-secondary/60 border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none"
          >
            <option value="auto">Auto ({profile?.preferredGranularity || 'monthly'})</option>
            {(profile?.availableGranularities || []).map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        <span className="inline-flex items-center gap-1.5 text-[11px] rounded-full border border-border px-2.5 py-1 text-muted-foreground">
          <Calendar className="w-3 h-3" />
          Current Analysis: {revenue?.currentLabel || present?.periodLabel || 'No data'}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] rounded-full border border-border px-2.5 py-1 text-muted-foreground">
          <Clock className="w-3 h-3" />
          Last Updated: {fmtDate(lastUpdatedAt)}
        </span>
        <span className="text-[11px] text-muted-foreground ml-auto">{profile?.basisDescription || ''}</span>
      </div>

      {/* ============ Real-world Company Analysis (Long vs Short) ============ */}
      <div className="mb-8">
        <CompanyAnalysisPanel />
      </div>

      {profileQ.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass rounded-2xl p-6 h-28 bg-secondary/25 animate-pulse" />
          ))}
        </div>
      ) : isBlank ? (
        <div className="glass rounded-2xl p-10 card-glow flex flex-col items-center justify-center text-center py-40 my-auto animate-fade-in max-w-xl mx-auto w-full">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
            <TrendingUp className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">No business data available</h2>
          <p className="text-muted-foreground mb-6 leading-relaxed text-sm">
            Connect data sources, upload sales logs, or synchronize your database to build strategic business intelligence metrics and interactive sales graphs.
          </p>
          <button
            onClick={() => navigate('/search-home')}
            className="px-5 py-2.5 bg-primary hover:bg-primary/95 text-white font-medium text-sm rounded-xl transition duration-200"
          >
            Go to Universal Search
          </button>
        </div>
      ) : (
        <>
          {/* ===================== PAST ===================== */}
          {tab === 'past' && past && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card title="Revenue History" subtitle={`Actual closed-won revenue by ${revenue?.granularity || 'period'}`}>
                {past.revenueSeries.length ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={past.revenueSeries.map((p) => ({ name: p.label, revenue: p.value }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={AXIS_TICK} />
                      <YAxis tick={AXIS_TICK} tickFormatter={compact} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => money(v)} />
                      <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <Insufficient />
                )}
              </Card>

              <Card title="Customers" subtitle="Acquired vs churned over time">
                {customerTrend.length ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={customerTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={AXIS_TICK} />
                      <YAxis tick={AXIS_TICK} allowDecimals={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Line type="monotone" dataKey="acquired" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="churned" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <Insufficient />
                )}
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 xl:col-span-2">
                {(['qoq', 'yoy', 'mom'] as const).map((key) => {
                  const c = past.comparisons[key];
                  return (
                    <div key={key} className="glass rounded-2xl p-5 card-glow">
                      <p className="text-[11px] uppercase font-semibold text-muted-foreground">{key.toUpperCase()}</p>
                      {c ? (
                        <>
                          <p className="text-lg font-bold text-foreground mt-1">{money(c.current)}</p>
                          <p className="text-xs text-muted-foreground">{c.currentLabel} vs {c.previousLabel}</p>
                          <GrowthBadge info={c} />
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-2">Insufficient data for {key.toUpperCase()} comparison.</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <Card title="Key Findings" subtitle="Evidence-backed historical patterns">
                {past.keyFindings.length ? (
                  <ul className="space-y-3">
                    {past.keyFindings.map((f, i) => (
                      <li key={i} className="rounded-xl bg-secondary/30 border border-border/50 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${f.direction === 'growth' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                            {f.direction === 'growth' ? 'Growth' : 'Decline'}
                          </span>
                          <p className="text-xs font-semibold text-foreground">{f.finding}</p>
                        </div>
                        {f.evidence.slice(0, 3).map((e, j) => (
                          <p key={j} className="text-[11px] text-muted-foreground ml-1">• {e}</p>
                        ))}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Insufficient text="No material historical patterns identified from the available data." />
                )}
              </Card>

              <Card title="Timeline" subtitle="Signals, risks and events from real records">
                <div className="max-h-72 overflow-y-auto pr-1">
                  {past.events.length ? (
                    past.events.slice(0, 40).map((e, i) => (
                      <EventItem key={i} title={e.title} detail={e.detail} label={e.periodLabel} />
                    ))
                  ) : (
                    <Insufficient text="No historical events recorded." />
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* ===================== PRESENT ===================== */}
          {tab === 'present' && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
                <KpiCard
                  icon={<DollarSign className="w-5 h-5 text-emerald-400" />}
                  tone="bg-emerald-500/10 border-emerald-500/20"
                  label="Revenue"
                  value={money(present?.revenue.current || revenue?.current || 0)}
                  sub={present?.revenue ? <GrowthBadge info={present.revenue} /> : undefined}
                />
                <KpiCard
                  icon={<Target className="w-5 h-5 text-blue-400" />}
                  tone="bg-blue-500/10 border-blue-500/20"
                  label="Open Pipeline"
                  value={compact(present?.revenue.pipeline || 0)}
                  sub="not yet closed-won"
                />
                <KpiCard
                  icon={<Users className="w-5 h-5 text-violet-400" />}
                  tone="bg-violet-500/10 border-violet-500/20"
                  label="Active Customers"
                  value={customers?.active ?? present?.customers.active ?? 0}
                  sub={`${customers?.total ?? 0} total · ${customers?.atRisk ?? 0} at risk`}
                />
                <KpiCard
                  icon={<BarChart2 className="w-5 h-5 text-sky-400" />}
                  tone="bg-sky-500/10 border-sky-500/20"
                  label="Closed-Won Deals"
                  value={present?.revenue.closedWonDeals ?? sales?.closedWonDeals ?? 0}
                  sub={sales?.averageDealSize != null ? `avg ${money(sales.averageDealSize)}` : ''}
                />
                <KpiCard
                  icon={<CheckCircle2 className="w-5 h-5 text-amber-400" />}
                  tone="bg-amber-500/10 border-amber-500/20"
                  label="Satisfaction"
                  value={present?.operations.satisfactionAvg ?? '—'}
                  sub={`${present?.operations.openTickets ?? 0} open tickets`}
                />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
                <Card title="Revenue Performance" subtitle={`Actual revenue by ${revenue?.granularity || 'period'} (closed-won)`}>
                  {revenue?.series?.length ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={revenue.series.map((p) => ({ name: p.label, revenue: p.value }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" tick={AXIS_TICK} />
                        <YAxis tick={AXIS_TICK} tickFormatter={compact} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => money(v)} />
                        <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 3 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <Insufficient />
                  )}
                </Card>

                <Card title="Revenue by Region" subtitle="Top contributing regions (closed-won)">
                  {regionData.length ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={regionData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" tick={AXIS_TICK} />
                        <YAxis tick={AXIS_TICK} tickFormatter={compact} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => money(v)} />
                        <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Insufficient />
                  )}
                </Card>

                <Card title="Revenue by Product" subtitle="Top products (bestProducts)">
                  {productData.length ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={productData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" tick={AXIS_TICK} interval={0} angle={-15} height={50} />
                        <YAxis tick={AXIS_TICK} tickFormatter={compact} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => money(v)} />
                        <Bar dataKey="revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Insufficient />
                  )}
                </Card>

                <Card title="Customers by Segment" subtitle="Customer distribution">
                  {segmentData.length ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={segmentData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" tick={AXIS_TICK} />
                        <YAxis tick={AXIS_TICK} allowDecimals={false} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Insufficient />
                  )}
                </Card>
              </div>

              {/* Anomalies */}
              {anomalies?.available && anomalies.items.length > 0 && (
                <div className="glass rounded-2xl p-6 card-glow mb-6">
                  <h2 className="font-semibold text-foreground text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-400" /> Anomaly Detection
                    <span className="text-[11px] text-muted-foreground normal-case">≥{anomalies.thresholdPct}% period-over-period deviation</span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {anomalies.items.slice(0, 6).map((a, i) => (
                      <div key={i} className={`rounded-xl p-3 border ${a.severity === 'high' ? 'bg-red-500/10 border-red-500/30' : a.severity === 'medium' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-blue-500/10 border-blue-500/30'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] uppercase font-semibold text-foreground">{a.metric} · {a.bucketLabel}</span>
                          <span className={`text-xs font-bold ${a.severity === 'high' ? 'text-red-400' : a.severity === 'medium' ? 'text-amber-400' : 'text-blue-400'}`}>
                            {a.deviationPct != null && a.deviationPct > 0 ? '+' : ''}{a.deviationPct}%
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{a.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card title="At-Risk Accounts" subtitle="Highest risk scores from customer records">
                  {customers?.topAtRisk?.length ? (
                    <div className="space-y-2">
                      {customers.topAtRisk.map((c, i) => (
                        <div key={i} className="flex items-center justify-between rounded-xl bg-secondary/30 border border-border/50 p-3">
<div>
                          <p className="text-xs font-semibold text-foreground">{c.name}</p>
                          <p className="text-[11px] text-muted-foreground">{c.company ? `${c.region} · ${c.company}` : c.region}</p>
                        </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-red-400">risk {c.riskScore}</span>
                            <p className="text-[11px] text-muted-foreground">{money(c.ltv)} LTV</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Insufficient text="No at-risk accounts flagged." />
                  )}
                </Card>

                <Card title="Operations" subtitle="Support workload & cost signals">
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="rounded-xl bg-secondary/30 border border-border/50 p-3">
                      <p className="text-[11px] text-muted-foreground uppercase">Open Tickets</p>
                      <p className="text-xl font-bold text-foreground">{present?.operations.openTickets ?? 0}</p>
                    </div>
                    <div className="rounded-xl bg-secondary/30 border border-border/50 p-3">
                      <p className="text-[11px] text-muted-foreground uppercase">Avg Resolution</p>
                      <p className="text-xl font-bold text-foreground">{present?.operations.avgResolutionHours ?? '—'}h</p>
                    </div>
                  </div>
                  {priorityData.length ? (
                    <div className="flex flex-wrap gap-2">
                      {priorityData.map((p) => (
                        <span key={p.key} className={`text-xs px-2.5 py-1 rounded-full border ${p.key === 'critical' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-secondary border-border/50 text-muted-foreground'}`}>
                          {p.key}: {p.count}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {present?.operations.projectsOverBudget?.length ? (
                    <div className="mt-4">
                      <p className="text-[11px] uppercase text-amber-400 font-semibold mb-1">Projects over budget</p>
                      {present.operations.projectsOverBudget.map((p, i) => (
                        <p key={i} className="text-xs text-muted-foreground">• {p.name}: {money(p.budget)} → {money(p.actualCost)}</p>
                      ))}
                    </div>
                  ) : null}
                </Card>
              </div>

              {/* AI analysis panel */}
              {renderAiPanel({
                aiAnalysis,
                aiRequested,
                aiLoading: aiQ.isFetching && aiRequested,
                onRun: () => setAiRequested(true),
                onRefetch: () => aiQ.refetch(),
              })}
            </>
          )}

          {/* ===================== FUTURE ===================== */}
          {tab === 'future' && future && (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
                <Card
                  title="Revenue Forecast"
                  subtitle={future.revenueForecast.available ? `Actual + projected trend · ${Math.round((future.revenueForecast.confidence || 0) * 100)}% confidence` : 'Projection unavailable'}
                  actions={future.revenueForecast.available ? (
                    <span className={`text-[11px] px-2.5 py-1 rounded-full border ${future.revenueForecast.direction === 'up' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : future.revenueForecast.direction === 'down' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-secondary border-border/50 text-muted-foreground'}`}>
                      {future.revenueForecast.direction} forecast
                    </span>
                  ) : undefined}
                >
                  {actualVsForecast.length && future.revenueForecast.available ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <ComposedChart data={actualVsForecast}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" tick={AXIS_TICK} />
                        <YAxis tick={AXIS_TICK} tickFormatter={compact} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, name: string) => [money(v), name]} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Area dataKey="upperBound" stroke="transparent" fill="rgba(245,158,11,0.08)" name="upper" />
                        <Area dataKey="lowerBound" stroke="transparent" fill="transparent" name="lower" />
                        <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} name="Actual" />
                        <Line type="monotone" dataKey="forecast" stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3, fill: '#f59e0b' }} name="Forecast" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <Insufficient text={future.revenueForecast.reason || 'Insufficient historical data for a reliable forecast.'} />
                  )}
                </Card>

                <Card title="Forecast Cards" subtitle="Trend projections from actual periods">
                  <div className="space-y-3">
                    {(['revenueForecast', 'salesForecast', 'customerForecast'] as const).map((key) => {
                      const f = future[key];
                      return (
                        <div key={key} className="rounded-xl bg-secondary/30 border border-border/50 p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] uppercase font-semibold text-foreground">{key.replace('Forecast', '')}</span>
                            {f.available ? (
                              <span className="text-[11px] text-emerald-400 font-semibold">confidence {(f.confidence || 0).toFixed(0)}%</span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">unavailable</span>
                            )}
                          </div>
                          {f.available ? (
                            <>
                              <p className="text-lg font-bold text-foreground">
                                {f.points.length ? money(f.points[f.points.length - 1].value) : '—'}
                                <span className="text-[11px] text-muted-foreground font-normal"> {f.direction} trend</span>
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {f.points.map((p) => p.label).join(' · ')} · arrived from {f.actualPoints} actual periods
                              </p>
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground">{f.reason}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                <Card title="Forecast Assumptions" subtitle="Method: OLS linear regression">
                  <div className="space-y-2">
                    {(future.revenueForecast.assumptions || []).map((a, i) => (
                      <p key={i} className="text-xs text-muted-foreground flex gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" /> {a}
                      </p>
                    ))}
                  </div>
                </Card>

                <Card title="Risks" subtitle="From open risk records">
                  {future.riskForecast.length ? (
                    <div className="space-y-2">
                      {future.riskForecast.map((r, i) => (
                        <div key={i} className="rounded-xl bg-red-500/5 border border-red-500/20 p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-foreground">{r.title}</p>
                            <span className="text-[11px] text-red-400 font-bold">score {r.riskScore}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">{r.level} · likelihood {r.likelihood}% · impact {r.impact}%</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Insufficient text="No active risks recorded." />
                  )}
                </Card>

                <Card title="Opportunities" subtitle="Derived from actual performance">
                  {future.opportunities.length ? (
                    <div className="space-y-2">
                      {future.opportunities.map((o, i) => (
                        <div key={i} className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3">
                          <p className="text-xs font-semibold text-foreground">{o.title}</p>
                          <p className="text-[11px] text-muted-foreground">{o.detail}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Insufficient text="No opportunities identified yet." />
                  )}
                </Card>
              </div>

              <Card title="Recommended Next Steps" subtitle="Deterministic recommendations from real data">
                {future.recommendations.length ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {future.recommendations.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-xl bg-secondary/30 border border-border/50 p-3">
                        <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-foreground/90">{r}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Insufficient text="No recommendations available yet." />
                )}
              </Card>

              {renderAiPanel({
                aiAnalysis,
                aiRequested,
                aiLoading: aiQ.isFetching && aiRequested,
                onRun: () => setAiRequested(true),
                onRefetch: () => aiQ.refetch(),
              })}
            </>
          )}
        </>
      )}
    </div>
  );
}

function renderAiPanel(opts: {
  aiAnalysis?: AIAnalysis;
  aiRequested: boolean;
  aiLoading: boolean;
  onRun: () => void;
  onRefetch: () => void;
}) {
  const { aiAnalysis, aiRequested, aiLoading, onRun, onRefetch } = opts;
  return (
    <div className="glass rounded-2xl p-6 card-glow mt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm uppercase tracking-wider">AI Analysis</h2>
          {aiAnalysis ? (
            <span className="text-[10px] text-muted-foreground ml-2">
              {aiAnalysis.provider} · {aiAnalysis.basisPeriod} · {fmtDate(aiAnalysis.generatedAt)}
            </span>
          ) : null}
        </div>
        {aiAnalysis ? (
          <button
            onClick={onRefetch}
            className="text-xs text-primary hover:underline flex items-center gap-1 disabled:opacity-50"
            disabled={aiLoading}
          >
            {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUpRight className="w-3 h-3" />} Re-run
          </button>
        ) : (
          <button
            onClick={onRun}
            disabled={aiRequested && aiLoading}
            className="flex items-center gap-2 rounded-lg gradient-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {aiLoading ? 'Analyzing live data…' : 'Run AI Analysis'}
          </button>
        )}
      </div>

      {!aiRequested && !aiAnalysis ? (
        <p className="text-xs text-muted-foreground">
          Generates evidence-backed findings from the live enterprise data shown above. Each insight cites the exact figures driving it.
        </p>
      ) : aiLoading && !aiAnalysis ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : aiAnalysis ? (
        <div className="space-y-5">
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
            <p className="text-[11px] uppercase font-semibold text-muted-foreground mb-1">Executive Summary</p>
            <p className="text-sm text-foreground/90 leading-relaxed">{aiAnalysis.summary}</p>
          </div>

          {aiAnalysis.findings.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {aiAnalysis.findings.map((f, i) => (
                <div key={i} className="rounded-xl bg-secondary/30 border border-border/50 p-4">
                  <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary mb-2 inline-block">{f.metric}</span>
                  <p className="text-xs font-semibold text-foreground mb-1">{f.finding}</p>
                  <div className="text-[11px] text-muted-foreground space-y-0.5 mb-2">
                    {f.evidence.slice(0, 3).map((e, j) => (
                      <p key={j}>• {e}</p>
                    ))}
                  </div>
                  <dl className="text-[11px] space-y-1">
                    <div><dt className="text-muted-foreground inline">Likely cause: </dt><dd className="inline text-foreground/80">{f.likelyCause}</dd></div>
                    <div><dt className="text-muted-foreground inline">Business impact: </dt><dd className="inline text-foreground/80">{f.businessImpact}</dd></div>
                    <div><dt className="text-muted-foreground inline">Recommended: </dt><dd className="inline text-foreground/80">{f.recommendedAction}</dd></div>
                  </dl>
                </div>
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-4">
              <p className="text-[11px] uppercase font-semibold text-red-400 mb-2">Risks</p>
              {aiAnalysis.risks.length ? (
                <ul className="space-y-2">
                  {aiAnalysis.risks.map((r, i) => (
                    <li key={i} className="text-xs">
                      <p className="text-foreground font-semibold">{r.title}</p>
                      <p className="text-muted-foreground">{r.description}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No risks identified.</p>
              )}
            </div>
            <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4">
              <p className="text-[11px] uppercase font-semibold text-emerald-400 mb-2">Opportunities</p>
              {aiAnalysis.opportunities.length ? (
                <ul className="space-y-2">
                  {aiAnalysis.opportunities.map((o, i) => (
                    <li key={i} className="text-xs">
                      <p className="text-foreground font-semibold">{o.title}</p>
                      <p className="text-muted-foreground">{o.detail}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No opportunities identified.</p>
              )}
            </div>
            <div className="rounded-xl bg-blue-500/5 border border-blue-500/20 p-4">
              <p className="text-[11px] uppercase font-semibold text-blue-400 mb-2">Recommendations</p>
              {aiAnalysis.recommendations.length ? (
                <ul className="space-y-2">
                  {aiAnalysis.recommendations.map((r, i) => (
                    <li key={i} className="text-xs text-foreground/80 list-disc ml-4">{r}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No recommendations provided.</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Click “Run AI Analysis” to generate evidence-backed findings.</p>
      )}
    </div>
  );
}