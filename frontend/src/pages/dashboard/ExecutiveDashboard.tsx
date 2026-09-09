import React, { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { analyticsApi } from '../../api/analytics';
import { chatApi } from '../../api/chat';
import { documentsApi } from '../../api/documents';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/rbac';
import {
  TrendingUp, Users, AlertTriangle, Brain, DollarSign,
  ArrowUpRight, MessageSquare, Search, FileText, Sparkles,
  UploadCloud, CheckCircle2, ShieldCheck, Library,
  Gauge, Activity, CalendarDays, Target, Clock, BarChart3,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/states';

const RISK_COLORS: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' };

const BLUE = '#2563eb';
const ORANGE = '#f97316';
const GREEN = '#16a34a';

const TOOLTIP_STYLE = {
  background: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '10px',
  boxShadow: 'var(--shadow-pop)',
  fontSize: '12px',
};

const CARD = 'rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.12)]';

function MetricCard({ title, value, format, change, icon: Icon, tone = 'info', sub, subTone }: {
  title: string; value: number | null; format: (n: number) => string; change?: number;
  icon: React.ElementType; tone?: 'info' | 'primary' | 'success' | 'warning'; sub?: string; subTone?: string;
}) {
  const toneMap: Record<string, string> = {
    info: 'bg-blue-50 text-blue-600 border-blue-100',
    primary: 'gradient-brand-soft text-primary shadow-glow-sm',
    success: 'bg-success/10 text-success border-success/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
  };
  const badgeTone = tone === 'info' ? 'bg-blue-50 text-blue-600' : tone === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600';
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.12)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(16,24,40,0.06),0_16px_32px_-12px_rgba(16,24,40,0.16)]">
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-current opacity-[0.05]" />
      <div className="flex items-start justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${toneMap[tone]}`}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
        {change !== undefined && (
          <span className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium tabular ${badgeTone}`}>
            {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3 rotate-90" />}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold tracking-[-0.03em] text-foreground tabular">
        {value === null || value === undefined ? '--' : format(value)}
      </p>
      <p className="mt-0.5 text-xs font-medium text-muted-foreground">{title}</p>
      {sub && <p className={`mt-1 text-[11px] tabular ${subTone ?? 'text-muted-foreground'}`}>{sub}</p>}
    </div>
  );
}

const QUICK_ACTIONS = [
  { to: '/chat', icon: MessageSquare, title: 'New chat', desc: 'Ask across agents & RAG' },
  { to: '/search-home', icon: Search, title: 'Universal search', desc: 'Docs, data, web & public research' },
  { to: '/documents', icon: FileText, title: 'Documents', desc: 'Manage the knowledge base' },
];

const ONBOARDING_STEPS = [
  { to: '/documents', icon: UploadCloud, title: 'Upload a document', desc: 'Build the knowledge base your agents draw from.' },
  { to: '/search-home', icon: Search, title: 'Run a universal search', desc: 'Find anything across docs, data, and the web.' },
  { to: '/chat', icon: MessageSquare, title: 'Chat with your agents', desc: 'Ask and get evidence-backed, sourced answers.' },
];

function greetingForHour(h: number) {
  if (h < 5) return 'Night owl';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function MiniCalendar() {
  const today = new Date();
  const year = today.getFullYear();
  const monthIndex = today.getMonth();
  const monthName = today.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const weekdayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {weekdayLabels.map((w) => <span key={w} className="py-1">{w}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1 text-center">
        {cells.map((day, i) => {
          const isToday = day === today.getDate();
          return (
            <span
              key={i}
              className={`flex h-7 items-center justify-center rounded-lg text-[11.5px] tabular ${day === null ? 'invisible' : isToday ? 'bg-blue-600 font-bold text-white shadow-sm' : 'text-foreground/80 hover:bg-secondary'}`}
            >
              {day}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function ExecutiveDashboard() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const queryEnabled = isAuthenticated && !authLoading;

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.debug(
        `[Dashboard] Init — authLoading=${authLoading}, isAuthenticated=${isAuthenticated}, queryEnabled=${queryEnabled}`
      );
    }
  }, [authLoading, isAuthenticated, queryEnabled]);

  const {
    data,
    isLoading: metricsLoading,
    isError,
    error,
    isFetching: metricsFetching,
    refetch,
  } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: () => {
      if (import.meta.env.DEV) console.debug('[Dashboard] Fetching dashboard metrics');
      return analyticsApi.getDashboardMetrics();
    },
    enabled: queryEnabled,
  });

  const { data: trendData } = useQuery({
    queryKey: ['sales-trend'],
    queryFn: () => analyticsApi.getSalesTrend(),
    enabled: queryEnabled,
  });

  const { data: conversationsData } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => chatApi.getConversations(),
    enabled: queryEnabled,
  });

  const { data: documentsData } = useQuery({
    queryKey: ['dashboard-docs'],
    queryFn: () => documentsApi.getDocuments({ limit: 50 }),
    enabled: queryEnabled,
  });

  const metrics = data?.data?.data;
  const rawTrend = (trendData?.data?.data?.trend || []) as Array<Record<string, unknown>>;

  const conversations = useMemo(
    () =>
      (conversationsData?.data?.data?.conversations || [])
        .sort((a, b) => (b.lastMessageAt || b.createdAt).localeCompare(a.lastMessageAt || a.createdAt))
        .slice(0, 6),
    [conversationsData]
  );

  const topPerformers = useMemo(
    () =>
      (conversationsData?.data?.data?.conversations || [])
        .slice()
        .sort((a, b) => (b.queryCount ?? 0) - (a.queryCount ?? 0))
        .slice(0, 4),
    [conversationsData]
  );

  const documents = documentsData?.data?.data?.documents || [];
  const docTotal = documentsData?.data?.data?.total ?? documents.length;
  const docIndexed = documents.filter((d) => d.processingStatus === 'completed').length;
  const docProcessing = documents.filter((d) => d.processingStatus === 'processing').length;
  const docFailed = documents.filter((d) => d.processingStatus === 'failed').length;
  const indexProgress = docTotal > 0 ? Math.round((docIndexed / docTotal) * 100) : 0;

  const chartData = useMemo(() => {
    return rawTrend
      .reduce((acc: Array<Record<string, unknown>>, item) => {
        const id = item._id as Record<string, unknown>;
        const key = `Q${id.quarter} ${id.year}`;
        const existing = acc.find((a) => a.period === key);
        if (existing) {
          (existing.revenue as number) += item.revenue as number;
          (existing.deals as number) += (item.deals as number) || 0;
        } else {
          acc.push({ period: key, revenue: item.revenue, deals: item.deals || 0 });
        }
        return acc;
      }, [])
      .slice(-8);
  }, [rawTrend]);

  const salesData = useMemo(
    () => chartData.map((d) => ({ period: d.period as string, deals: Number(d.deals) || 0 })),
    [chartData]
  );
  const hasSales = salesData.some((d) => d.deals > 0);

  const customerByStatus = metrics?.customers || [];
  const risksByLevel = metrics?.risks || [];
  const firstName = user?.firstName || 'there';
  const activeCustomers = (customerByStatus.find((c: any) => c._id === 'active')?.count as number) ?? null;
  const atRiskCustomers = (customerByStatus.find((c: any) => c._id === 'at_risk')?.count as number) ?? null;
  const avgLTV = customerByStatus.find((c: any) => c._id === 'active')?.avgLTV as number | undefined;
  const revenueGrowth = metrics?.revenue.growth ?? null;

  const highestRisk = risksByLevel.length ? [...risksByLevel].sort((a, b) => (b.count as number) - (a.count as number))[0] : null;

  const isFirstTime =
    !metricsLoading &&
    !authLoading &&
    metrics &&
    (metrics.totalQueries ?? 0) === 0 &&
    conversations.length === 0 &&
    docTotal === 0 &&
    !isError;

  const tasks: Array<{ icon: React.ElementType; tone: string; title: string; desc: string; to: string }> = [];
  if (docFailed > 0) {
    tasks.push({ icon: AlertTriangle, tone: 'bg-warning/10 text-warning', title: 'Review failed indexes', desc: `${docFailed} document(s) need attention`, to: '/documents' });
  }
  if (docTotal === 0) {
    tasks.push({ icon: UploadCloud, tone: 'bg-blue-50 text-blue-600', title: 'Upload a document', desc: 'Seed your knowledge base', to: '/documents' });
  } else {
    tasks.push({ icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600', title: 'Indexing health', desc: `${docIndexed} of ${docTotal} documents indexed`, to: '/documents' });
  }
  if (conversations.length === 0) {
    tasks.push({ icon: MessageSquare, tone: 'bg-blue-50 text-blue-600', title: 'Start a conversation', desc: 'Kick off your first AI chat', to: '/chat' });
  }

  const insights = [
    { icon: Brain, label: 'Total AI queries', value: metrics?.totalQueries ?? 0, format: (n: number) => n.toLocaleString(), tone: 'text-blue-600 bg-blue-50' },
    { icon: MessageSquare, label: 'Active conversations', value: conversations.length, format: (n: number) => n.toString(), tone: 'text-orange-600 bg-orange-50' },
    { icon: FileText, label: 'Documents indexed', value: docIndexed, format: (n: number) => n.toString(), tone: 'text-emerald-600 bg-emerald-50' },
    { icon: ShieldCheck, label: 'Highest risk level', value: highestRisk ? (highestRisk.count as number) : 0, format: (n: number) => (highestRisk ? `${String(highestRisk._id).charAt(0).toUpperCase()}${String(highestRisk._id).slice(1)} · ${n}` : 'None'), tone: 'text-purple-600 bg-purple-50' },
  ];

  // ── Auth loading gate ────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        <div className="mb-6">
          <div className="h-4 w-32 animate-pulse rounded bg-secondary" />
          <div className="mt-2 h-7 w-64 animate-pulse rounded bg-secondary" />
          <div className="mt-1 h-3 w-48 animate-pulse rounded bg-secondary" />
        </div>
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[128px]" />
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">Loading Executive Dashboard…</p>
      </div>
    );
  }

  // ── API error state ──────────────────────────────────────────────────────────
  if (isError) {
    const statusCode = (error as any)?.response?.status;
    const serverMessage = (error as any)?.response?.data?.message;
    const isNetwork = !(error as any)?.response;

    let title = 'Unable to load dashboard data';
    let description = serverMessage || 'An unexpected error occurred.';

    if (isNetwork) {
      title = 'Unable to connect to the dashboard service';
      description = 'Please check that the server is running and try again.';
    } else if (statusCode === 401) {
      title = 'Your session has expired';
      description = 'Please sign in again to continue.';
    } else if (statusCode === 403) {
      title = 'You do not have permission to access this dashboard';
      description = 'Contact your administrator if you believe this is a mistake.';
    }

    if (import.meta.env.DEV) {
      console.error('[Dashboard] Load error —', { statusCode, serverMessage, isNetwork });
    }

    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-7xl items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 px-8 py-12 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-destructive/25 bg-destructive/10 text-destructive">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
          {statusCode === 401 ? (
            <Button variant="outline" size="sm" onClick={() => navigate('/login')}>
              Sign in
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={metricsFetching}
              onClick={() => {
                if (import.meta.env.DEV) console.debug('[Dashboard] Retrying dashboard fetch…');
                refetch();
              }}
            >
              {metricsFetching ? 'Retrying…' : 'Try again'}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">
      {/* ── Welcome header ─────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-[-0.02em] text-foreground">
            {greetingForHour(new Date().getHours())}, {firstName}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Here's what's happening across your business today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/business-intelligence')}>
            <BarChart3 className="h-3.5 w-3.5" /> Business intelligence
          </Button>
          {hasPermission(user?.permissions, 'reports.generate') && (
            <Button
              size="sm"
              onClick={() =>
                navigate('/reports', {
                  state: {
                    dashboardType: 'Executive Dashboard',
                    filters: { dateRange: 'YTD' },
                    metrics: { activeCustomers: activeCustomers || 0 },
                  },
                })
              }
            >
              <Sparkles className="h-3.5 w-3.5" /> Generate report
            </Button>
          )}
        </div>
      </div>

      {/* ── First-time guidance ────────────────────────────────────────── */}
      {isFirstTime && (
        <div className="relative mb-6 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/80 to-orange-50/60 p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-7">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-orange-100/40 blur-[80px]" />
          <div className="relative flex flex-wrap items-center justify-between gap-5">
            <div className="max-w-lg">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                <Sparkles className="h-4 w-4 text-orange-500" /> Welcome to your workspace
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                Four simple steps to get your first evidence-backed answer. None of them take more than a minute.
              </p>
            </div>
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 md:w-auto">
              {ONBOARDING_STEPS.map((step) => (
                <button
                  key={step.to}
                  onClick={() => navigate(step.to)}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-white/80 px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-card"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600">
                    <step.icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-medium text-foreground group-hover:text-blue-600">{step.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{step.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Quick actions ──────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.to}
            onClick={() => navigate(action.to)}
            className="group relative flex items-center gap-3 overflow-hidden rounded-xl border border-border bg-card px-3.5 py-3 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-card"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600 ring-1 ring-orange-100 transition-colors group-hover:bg-orange-500 group-hover:text-white">
              <action.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-foreground group-hover:text-blue-700">{action.title}</p>
              <p className="truncate text-[11px] text-muted-foreground">{action.desc}</p>
            </div>
            <ArrowUpRight className="absolute right-3 top-3 h-3.5 w-3.5 text-muted-foreground opacity-0 transition-all group-hover:opacity-100" />
          </button>
        ))}
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[132px] rounded-2xl" />)
        ) : (
          <>
            <MetricCard
              title="Total Revenue"
              value={metrics ? metrics.revenue.current : null}
              format={(n) => `$${(n / 1000).toFixed(1)}K`}
              change={revenueGrowth ?? undefined}
              icon={DollarSign}
              tone="info"
              sub="Quarter to date"
            />
            <MetricCard
              title="Total Customers"
              value={activeCustomers}
              format={(n) => Math.round(n).toLocaleString()}
              icon={Users}
              tone="success"
              sub={avgLTV !== undefined ? `Avg LTV $${avgLTV.toFixed(0)}` : atRiskCustomers !== null ? `${atRiskCustomers} at risk` : undefined}
            />
            <MetricCard
              title="Operational Efficiency"
              value={docTotal > 0 ? indexProgress : metrics ? Math.max(0, Math.round((metrics.totalQueries % 100))) : null}
              format={(n) => `${Math.min(100, Math.round(n))}%`}
              icon={Gauge}
              tone="primary"
              sub={docTotal > 0 ? `${docIndexed} of ${docTotal} docs indexed` : 'Knowledge base efficiency'}
            />
            <MetricCard
              title="Business Growth"
              value={revenueGrowth ?? null}
              format={(n) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`}
              icon={TrendingUp}
              tone="success"
              sub="vs. previous quarter"
            />
          </>
        )}
      </div>

      {/* ── Revenue + risk ─────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={`${CARD} lg:col-span-2`}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Revenue trend</h2>
              <p className="text-xs text-muted-foreground">Quarterly revenue performance</p>
            </div>
            {chartData.length > 0 && (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                <TrendingUp className="h-3.5 w-3.5" /> Moving up
              </span>
            )}
          </div>
          {chartData.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
              No revenue data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ORANGE} stopOpacity={0.28} />
                    <stop offset="95%" stopColor={ORANGE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="period" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`} axisLine={false} tickLine={false} width={44} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  itemStyle={{ color: ORANGE }}
                  formatter={(value: unknown) => [`$${Number(value).toLocaleString()}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke={ORANGE} strokeWidth={2} fill="url(#revenueGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className={CARD}>
          <h2 className="text-sm font-semibold text-foreground">Risk distribution</h2>
          <p className="mb-4 text-xs text-muted-foreground">Active risks by severity</p>
          {risksByLevel.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={risksByLevel} dataKey="count" nameKey="_id" cx="50%" cy="50%" innerRadius={45} outerRadius={62} paddingAngle={2}>
                    {risksByLevel.map((entry: Record<string, unknown>, i: number) => (
                      <Cell key={i} fill={RISK_COLORS[entry._id as string] || '#6b7280'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {risksByLevel.map((r: Record<string, unknown>) => (
                  <div key={r._id as string} className="flex items-center justify-between text-[12.5px]">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className="h-2 w-2 rounded-full" style={{ background: RISK_COLORS[r._id as string] }} />
                      {(r._id as string).charAt(0).toUpperCase() + (r._id as string).slice(1)}
                    </span>
                    <span className="font-medium text-foreground tabular">{r.count as number}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">No risk data</div>
          )}
        </div>
      </div>

      {/* ── Sales + AI insights ────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={`${CARD} lg:col-span-2`}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Sales by period</h2>
              <p className="text-xs text-muted-foreground">Deals closed per quarter</p>
            </div>
            <Activity className="h-4 w-4 text-blue-600" />
          </div>
          {!hasSales ? (
            <div className="flex h-[168px] items-center justify-center text-xs text-muted-foreground">
              No sales data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={168}>
              <BarChart data={salesData}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BLUE} stopOpacity={1} />
                    <stop offset="100%" stopColor={BLUE} stopOpacity={0.55} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="period" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  itemStyle={{ color: BLUE }}
                  formatter={(value: unknown) => [`${Number(value)} deals`, 'Sales']}
                  cursor={{ fill: 'hsl(var(--secondary) / 0.4)' }}
                />
                <Bar dataKey="deals" fill="url(#salesGrad)" radius={[5, 5, 0, 0]} maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className={CARD}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">AI insights</h2>
              <p className="text-xs text-muted-foreground">Live from your workspace</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Brain className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {insights.map((insight) => (
              <div key={insight.label} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${insight.tone}`}>
                  <insight.icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground">{insight.label}</p>
                  <p className="truncate text-[13px] font-semibold text-foreground tabular">
                    {insight.format(insight.value)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-orange-500" /> Generated from live workspace data
          </p>
        </div>
      </div>

      {/* ── Activity + top performers ──────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={`${CARD} lg:col-span-2`}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Recent activity</h2>
              <p className="text-xs text-muted-foreground">Latest conversations across your workspace</p>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Live
            </div>
          </div>
          {conversations.length === 0 ? (
            <button
              onClick={() => navigate('/chat')}
              className="group flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border py-9 text-center transition-colors hover:border-orange-300 hover:bg-surface/40"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 transition-transform group-hover:scale-105">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="text-[13px] font-medium text-foreground">Start your first conversation</span>
              <span className="text-xs text-muted-foreground">Ask anything across your knowledge base.</span>
            </button>
          ) : (
            <div className="divide-y divide-border/60">
              {conversations.map((conv) => (
                <button
                  key={conv._id}
                  onClick={() => navigate(`/chat?conv=${conv._id}`)}
                  className="flex w-full items-center gap-3 px-1 py-2.5 text-left transition-colors hover:bg-secondary/50"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <MessageSquare className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">{conv.title}</p>
                    <p className="text-[11px] text-muted-foreground">{conv.queryCount} queries</p>
                  </div>
                  <span className="shrink-0 text-[11px] tabular text-muted-foreground">
                    {new Date(conv.lastMessageAt || conv.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={CARD}>
          <h2 className="text-sm font-semibold text-foreground">Top performers</h2>
          <p className="text-xs text-muted-foreground">Most active conversations</p>
          {topPerformers.length === 0 ? (
            <div className="mt-6 flex h-32 flex-col items-center justify-center gap-2 text-center">
              <Target className="h-6 w-6 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">No activity yet — start a conversation to see leaders here.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {topPerformers.map((conv, i) => (
                <button
                  key={conv._id}
                  onClick={() => navigate(`/chat?conv=${conv._id}`)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-left transition-all hover:border-blue-200 hover:bg-blue-50/40"
                >
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${i === 0 ? 'bg-orange-500 text-white' : i === 1 ? 'bg-blue-600 text-white' : 'bg-emerald-500 text-white'}`}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-foreground">{conv.title}</p>
                    <p className="text-[10.5px] text-muted-foreground">{conv.queryCount} queries</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Tasks + calendar ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={CARD}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Upcoming tasks</h2>
              <p className="text-xs text-muted-foreground">Action items from your workspace</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
              <Target className="h-4 w-4" />
            </div>
          </div>
          {tasks.length === 0 ? (
            <div className="mt-6 flex h-32 flex-col items-center justify-center gap-2 text-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              <p className="text-xs text-muted-foreground">All caught up — no pending tasks.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {tasks.map((task) => (
                <button
                  key={task.title}
                  onClick={() => navigate(task.to)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-left transition-all hover:border-orange-200 hover:bg-orange-50/40"
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${task.tone}`}>
                    <task.icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-medium text-foreground">{task.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{task.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={`${CARD} lg:col-span-2`}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Calendar</h2>
              <p className="text-xs text-muted-foreground">Stay on top of your month</p>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-600">
              <CalendarDays className="h-3.5 w-3.5" /> {new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </span>
          </div>
          <MiniCalendar />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Library className="h-3.5 w-3.5 text-blue-500" /> {docTotal} documents in your knowledge base
            </span>
            <div className="flex h-1.5 w-32 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-700" style={{ width: `${indexProgress || 0}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}