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
  ArrowUpRight, BookOpen, MessageSquare, Search, FileText, Sparkles,
  CornerDownRight, UploadCloud, CheckCircle2, ShieldCheck, Library,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/states';
import { CountUp } from '../../components/motion';

const RISK_COLORS: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' };

const TOOLTIP_STYLE = {
  background: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '10px',
  boxShadow: 'var(--shadow-pop)',
  fontSize: '12px',
};

function MetricCard({ title, value, format, change, icon: Icon, tone = 'primary' }: {
  title: string; value: number | null; format: (n: number) => string; change?: number;
  icon: React.ElementType; tone?: 'primary' | 'success' | 'warning'
}) {
  const toneMap = {
    primary: 'gradient-brand-soft text-primary shadow-glow-sm',
    success: 'bg-success/10 text-success border-success/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card">
      <div className="flex items-start justify-between">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${toneMap[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
        {change !== undefined && (
          <span className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium tabular ${change >= 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
            {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3 rotate-90" />}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="mt-3 text-xl font-semibold tracking-tight text-foreground tabular">
        {value === null ? '--' : <CountUp value={value} format={format} />}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{title}</p>
    </div>
  );
}

const QUICK_ACTIONS = [
  { to: '/chat', icon: MessageSquare, title: 'New chat', desc: 'Ask across agents & RAG' },
  { to: '/search-home', icon: Search, title: 'Universal search', desc: 'Docs, data, web & public research' },
  { to: '/documents', icon: FileText, title: 'Documents', desc: 'Manage the knowledge base' },
  { to: '/decision-intelligence', icon: Brain, title: 'Decision intelligence', desc: 'Evaluate strategic moves' },
];

const ONBOARDING_STEPS = [
  { to: '/documents', icon: UploadCloud, title: 'Upload a document', desc: 'Build the knowledge base your agents draw from.' },
  { to: '/search-home', icon: Search, title: 'Run a universal search', desc: 'Find anything across docs, data, and the web.' },
  { to: '/chat', icon: MessageSquare, title: 'Chat with your agents', desc: 'Ask and get evidence-backed, sourced answers.' },
  { to: '/decision-intelligence', icon: Brain, title: 'Evaluate a decision', desc: 'Stress-test a move before you commit.' },
];

function greetingForHour(h: number) {
  if (h < 5) return 'Night owl';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function ExecutiveDashboard() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Determine when it's safe to fire API requests:
  // auth must have finished loading AND the user must be confirmed authenticated.
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
        } else {
          acc.push({ period: key, revenue: item.revenue, deals: item.deals });
        }
        return acc;
      }, [])
      .slice(-8);
  }, [rawTrend]);

  const customerByStatus = metrics?.customers || [];
  const risksByLevel = metrics?.risks || [];
  const firstName = user?.firstName || 'there';
  const isFirstTime =
    !metricsLoading &&
    !authLoading &&
    metrics &&
    (metrics.totalQueries ?? 0) === 0 &&
    conversations.length === 0 &&
    docTotal === 0 &&
    !isError;

  // ── Auth loading gate ────────────────────────────────────────────────────────
  // Show a skeleton while auth context is still resolving (token validation /api/auth/me).
  // This prevents queries from firing with no token and showing a spurious error.
  if (authLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
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
      <div className="mx-auto flex min-h-[60vh] w-full max-w-6xl items-center justify-center px-4">
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
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      {/* Greeting */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-foreground">
            {greetingForHour(new Date().getHours())}, {firstName}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Here's what's happening across your workspace today.
          </p>
        </div>
        {hasPermission(user?.permissions, 'reports.generate') && (
          <Button
            variant="outline"
            onClick={() =>
              navigate('/reports', {
                state: {
                  dashboardType: 'Executive Dashboard',
                  filters: { dateRange: 'YTD' },
                  metrics: { activeCustomers: customerByStatus.find((c: any) => c._id === 'active')?.count || 0 },
                },
              })
            }
          >
            <BookOpen className="h-3.5 w-3.5" /> Generate report
          </Button>
        )}
      </div>

      {/* First-time guidance */}
      {isFirstTime && (
        <div className="relative mb-6 overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-card sm:p-7">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-[80px]" />
          <div className="relative flex flex-wrap items-center justify-between gap-5">
            <div className="max-w-lg">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                <Sparkles className="h-4 w-4 text-primary" /> Welcome to your workspace
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                Four simple steps to get your first evidence-backed answer. None of them take more than a minute.
              </p>
            </div>
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 md:w-auto">
              {ONBOARDING_STEPS.map((step) => (
                <button
                  key={step.to}
                  onClick={() => navigate(step.to)}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-surface/40 px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-surface"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <step.icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-medium text-foreground group-hover:text-primary">{step.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{step.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.to}
            onClick={() => navigate(action.to)}
            className="group relative flex items-center gap-3 overflow-hidden rounded-xl border border-border bg-card px-3.5 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-card"
          >
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-brand-soft text-primary shadow-glow-sm`}>
              <action.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-foreground group-hover:text-primary">{action.title}</p>
              <p className="truncate text-[11px] text-muted-foreground">{action.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[128px]" />)
        ) : (
          <>
            <MetricCard
              title="Revenue this quarter"
              value={metrics ? metrics.revenue.current : null}
              format={(n) => `$${(n / 1000).toFixed(0)}K`}
              change={metrics?.revenue.growth}
              icon={DollarSign}
              tone="success"
            />
            <MetricCard
              title="Active customers"
              value={(customerByStatus.find((c: any) => c._id === 'active')?.count as number) ?? null}
              format={(n) => Math.round(n).toLocaleString()}
              icon={Users}
            />
            <MetricCard
              title="At-risk customers"
              value={(customerByStatus.find((c: any) => c._id === 'at_risk')?.count as number) ?? null}
              format={(n) => Math.round(n).toLocaleString()}
              icon={AlertTriangle}
              tone="warning"
            />
            <MetricCard
              title="Total AI queries"
              value={metrics ? metrics.totalQueries : null}
              format={(n) => Math.round(n).toLocaleString()}
              icon={Brain}
            />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Revenue trend</h2>
              <p className="text-xs text-muted-foreground">Quarterly revenue performance</p>
            </div>
            {chartData.length > 0 && (
              <span className="flex items-center gap-1 text-xs font-medium text-success">
                <ArrowUpRight className="h-3.5 w-3.5" /> Moving up
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
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="period" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`} axisLine={false} tickLine={false} width={44} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  itemStyle={{ color: '#3b82f6' }}
                  formatter={(value: unknown) => [`$${Number(value).toLocaleString()}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revenueGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
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

      {/* Recent conversations + knowledge base */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Recent conversations</h2>
              <p className="text-xs text-muted-foreground">Pick up where you left off</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/chat')}>
              Open chat <CornerDownRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          {conversations.length === 0 ? (
            <button
              onClick={() => navigate('/chat')}
              className="group flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border py-9 text-center transition-colors hover:border-primary/30 hover:bg-surface/40"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
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
                  <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
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

        <div className="flex flex-col rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Knowledge base</h2>
              <p className="text-xs text-muted-foreground">Documents powering your answers</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-brand-soft border border-primary/20 text-primary">
              <Library className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-end justify-between">
              <p className="font-mono text-2xl font-semibold tabular text-foreground">
                {metricsLoading ? '—' : docTotal === 0 ? 0 : <CountUp value={docTotal} format={(n) => Math.round(n).toString()} />}
              </p>
              <span className="text-xs text-muted-foreground">documents</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${indexProgress}%` }} />
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {docTotal === 0
                ? 'Upload a document to start indexing'
                : `${indexProgress}% indexed${docProcessing > 0 ? ` · ${docProcessing} processing` : ''}${docFailed > 0 ? ` · ${docFailed} failed` : ''}`}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              { icon: CheckCircle2, label: 'Indexed', value: docIndexed, tone: 'text-success bg-success/10' },
              { icon: AlertTriangle, label: 'Needs attention', value: docFailed, tone: 'text-warning bg-warning/10' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-md ${item.tone}`}>
                  <item.icon className="h-3 w-3" />
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-sm font-medium tabular text-foreground">
                    {metricsLoading ? '—' : <CountUp value={item.value} format={(n) => Math.round(n).toString()} />}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">{item.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-success" /> Data secured
            </span>
            <Button variant="ghost" size="sm" onClick={() => navigate('/documents')}>
              Manage <ArrowUpRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}