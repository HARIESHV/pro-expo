import React, { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity, AlertTriangle, ArrowRight, BarChart3, BookOpen, Brain, CheckCircle2,
  ChevronRight, CircleDot, Database, FileText, FolderOpen, Lightbulb, MessageSquare, Network,
  RefreshCw, Scale, Search, ShieldCheck, Sparkles, TrendingUp, X,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button } from '../../components/ui/button';
import { Field, Select } from '../../components/ui/field';
import { Textarea } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { EmptyState, Skeleton } from '../../components/ui/states';
import { decisionsApi, DecisionEvaluationResult, DecisionInsights } from './api';
import { EvaluationResultView } from './components/EvaluationResultView';
import { ForecastPanel, TrendChart, TrendChartSkeleton } from './components/InsightCharts';

const DEPARTMENTS = ['Sales', 'Engineering', 'Finance', 'HR', 'Operations', 'Product', 'Marketing'];
const BUDGETS = ['<$10,000', '$10k - $50k', '$50k - $100k', '$100k - $500k', '$500k+'];
const RISK_TOLERANCES = ['Low', 'Medium', 'High'];

const STATUS_VARIANT: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'destructive' | 'muted'> = {
  draft: 'muted',
  evaluating: 'primary',
  evaluated: 'warning',
  approved: 'success',
  rejected: 'destructive',
  implemented: 'success',
};

/** Source dashboards Decision Intelligence can connect to (navigation only — none are modified). */
const CONNECTED_SOURCES: Array<{ label: string; route: string; icon: React.ElementType; desc: string }> = [
  { label: 'Executive Dashboard', route: '/dashboard', icon: TrendingUp, desc: 'Board-level KPIs and posture' },
  { label: 'Analytics', route: '/analytics', icon: BarChart3, desc: 'Sales & customer trends' },
  { label: 'Reports', route: '/reports', icon: BookOpen, desc: 'Generated intelligence reports' },
  { label: 'Risk Dashboard', route: '/risks', icon: ShieldCheck, desc: 'Live risk posture & mitigation' },
  { label: 'Business Intelligence', route: '/business-intelligence', icon: Database, desc: 'Strategic metrics & segments' },
  { label: 'AI Agents', route: '/agents', icon: Brain, desc: 'Agent catalog & orchestration' },
  { label: 'Knowledge Graph', route: '/knowledge-graph', icon: Network, desc: 'Entity relationships & context' },
  { label: 'Evaluate Graph', route: '/evaluate-graph', icon: Activity, desc: 'Graph health' },
  { label: 'Documents', route: '/documents', icon: FolderOpen, desc: 'Evidence corpus' },
  { label: 'Universal Search', route: '/search-home', icon: Search, desc: 'Cross-workspace discovery' },
  { label: 'AI Chat', route: '/chat', icon: MessageSquare, desc: 'Grounded conversational analysis' },
  { label: 'Query History', route: '/query-history', icon: CircleDot, desc: 'Past AI queries' },
];

export default function DecisionIntelligencePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Deep-link context only — no global/shared workspace state.
  const riskIdParam = searchParams.get('riskId');
  const riskTitleParam = searchParams.get('title');
  const entityParam = searchParams.get('entity');
  const isEntityLink = !!entityParam;

  const contextRiskTitle = isEntityLink ? '' : riskTitleParam || '';
  const contextRiskId = isEntityLink ? null : riskIdParam;
  const contextEntityName = isEntityLink ? riskTitleParam || entityParam || '' : '';

  // Evaluation form state
  const [decision, setDecision] = React.useState('');
  const [department, setDepartment] = React.useState('Sales');
  const [budget, setBudget] = React.useState(BUDGETS[2]);
  const [riskTolerance, setRiskTolerance] = React.useState('Medium');
  const [formOpen, setFormOpen] = React.useState(!!riskIdParam);
  const [selectedDecisionId, setSelectedDecisionId] = React.useState<string | null>(null);

  // Timeline filters — scoped to this dashboard (date-range + business area)
  const [filterDepartment, setFilterDepartment] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');

  const filtersApplied = filterDepartment !== '' || dateFrom !== '' || dateTo !== '';

  const insightsFilters = useMemo(() => {
    const params: { from?: string; to?: string; department?: string } = {};
    if (dateFrom) params.from = dateFrom;
    if (dateTo) params.to = dateTo;
    if (filterDepartment) params.department = filterDepartment;
    return params;
  }, [dateFrom, dateTo, filterDepartment]);

  // ---- Data queries (each independent; any single failure cannot blank the page) ----
  const insightsQuery = useQuery({
    queryKey: ['decision-insights', filterDepartment, dateFrom, dateTo],
    queryFn: () => decisionsApi.insights(insightsFilters),
  });

  const decisionsQuery = useQuery({
    queryKey: ['decisions', filterDepartment],
    queryFn: () => decisionsApi.list({ limit: 12, department: filterDepartment || undefined }),
  });

  const recommendationsQuery = useQuery({
    queryKey: ['decision-recommendations'],
    queryFn: () => decisionsApi.recommendations(),
  });

  const evaluationMutation = useMutation({
    mutationFn: (data: { decision: string; department: string; budget: string; riskTolerance: string }) =>
      decisionsApi.evaluate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decision-insights'] });
      queryClient.invalidateQueries({ queryKey: ['decisions'] });
      queryClient.invalidateQueries({ queryKey: ['decision-recommendations'] });
    },
  });

  const insights: DecisionInsights | undefined = insightsQuery.data?.data?.data;
  const decisions = decisionsQuery.data?.data?.data?.decisions || [];
  const recommendations = recommendationsQuery.data?.data?.data?.recommendations || [];
  const riskSummary = insights?.riskSummary || {};
  const trendPoints = insights?.trend || [];

  const totalRisks =
    (riskSummary.critical || 0) + (riskSummary.high || 0) + (riskSummary.medium || 0) + (riskSummary.low || 0);

  const kpis = useMemo(
    () => [
      {
        label: filtersApplied ? 'Revenue (selected range)' : 'Revenue (all time)',
        value: `$${Math.round(insights?.metrics?.totalRevenue || 0).toLocaleString()}`,
        icon: TrendingUp,
        tone: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      },
      {
        label: 'Open decisions',
        value: String(insights?.decisions?.total ?? decisions.length),
        icon: Brain,
        tone: 'text-primary bg-primary/10 border-primary/20',
      },
      { label: 'Active risks', value: String(totalRisks), icon: ShieldCheck, tone: 'text-red-400 bg-red-500/10 border-red-500/20' },
      {
        label: 'Supporting documents',
        value: String(insights?.documents ?? decisions.reduce((a, d) => a + (d.supportingDocuments?.length || 0), 0)),
        icon: FileText,
        tone: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      },
    ],
    [insights, decisions, totalRisks, filtersApplied]
  );

  const selectedDecision = decisions.find((d) => d._id === selectedDecisionId) || null;

  const evaluationResult: DecisionEvaluationResult | undefined = evaluationMutation.data?.data?.data;

  // Seed the evaluation with context when arriving via a deep link (Risk/Entity)
  const prefilledDecision = contextRiskTitle
    ? `Evaluate mitigation options for the active risk: "${contextRiskTitle}". Propose concrete actions and quantify the trade-off.`
    : contextEntityName
      ? `Evaluate the operational impact and strategic opportunities around the entity "${contextEntityName}". Propose concrete actions.`
      : '';
  const effectiveDecisionInput = decision || (formOpen ? prefilledDecision : '');

  const deriveScenarioRows = () => {
    const rows: Array<{ name: string; outcome: string }> = [];
    if (evaluationResult) {
      rows.push({ name: 'Expected outcome', outcome: evaluationResult.recommendation || evaluationResult.summary });
    }
    for (const d of decisions.slice(0, 2)) {
      for (const s of (d.scenarios || []).slice(0, 3)) {
        if (rows.length < 3) rows.push({ name: s.name, outcome: s.outcome });
      }
    }
    return rows;
  };
  const scenarioRows = deriveScenarioRows();

  const handleEvaluate = (e: React.FormEvent) => {
    e.preventDefault();
    const input = (decision || prefilledDecision).trim();
    if (!input) return;
    evaluationMutation.mutate({ decision: input, department, budget, riskTolerance });
  };

  const openInChat = (text: string) => {
    navigate(`/chat?q=${encodeURIComponent(text)}`);
  };

  const openReport = (context: string) => {
    navigate('/reports', {
      state: {
        searchQuery: context,
        entities: [],
        kgRelationships: [],
        matchingDocuments: [],
        dashboardType: 'Decision Intelligence',
      },
    });
  };

  const clearContextChip = () => {
    setSearchParams({}, { replace: true });
  };

  const clearFilters = () => {
    setFilterDepartment('');
    setDateFrom('');
    setDateTo('');
  };

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['decision-insights'] });
    queryClient.invalidateQueries({ queryKey: ['decisions'] });
    queryClient.invalidateQueries({ queryKey: ['decision-recommendations'] });
  };

  const contextChips = useMemo(() => {
    const chips: Array<{ label: string; value: string }> = [];
    if (contextRiskTitle) chips.push({ label: 'Risk', value: contextRiskTitle });
    if (contextRiskId) chips.push({ label: 'Risk ID', value: String(contextRiskId) });
    if (contextEntityName) chips.push({ label: 'Entity', value: contextEntityName });
    return chips;
  }, [contextRiskTitle, contextRiskId, contextEntityName]);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6">
      {/* ===== Header ===== */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Decision Intelligence</h1>
          <p className="text-xs text-muted-foreground">Independent decision-making workspace — grounded in live enterprise data</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFormOpen(true);
              setTimeout(() => document.getElementById('decision-input')?.focus(), 50);
            }}
          >
            <Sparkles className="h-3.5 w-3.5" /> Evaluate proposal
          </Button>
          <Button variant="outline" size="sm" onClick={() => openReport(selectedDecision?.decision || decision || 'Decision Intelligence Overview')}>
            <BookOpen className="h-3.5 w-3.5" /> Generate report
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setFormOpen(true);
              setTimeout(() => document.getElementById('decision-input')?.focus(), 50);
            }}
          >
            <Brain className="h-3.5 w-3.5" /> New decision
          </Button>
        </div>
      </div>

      {/* ===== Context chips from deep links (risk / entity) ===== */}
      {(contextChips.length > 0 || riskIdParam) && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
            <CircleDot className="h-3 w-3" /> Context
          </span>
          {contextChips.map((chip) => (
            <span key={chip.label} className="flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-foreground">
              <span className="text-muted-foreground">{chip.label}:</span> {chip.value}
            </span>
          ))}
          <button onClick={clearContextChip} className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" /> Clear
          </button>
        </div>
      )}

      {/* ===== Timeline filters ===== */}
      <div className="mb-5 flex flex-wrap items-end gap-x-3 gap-y-3 rounded-2xl border border-border bg-card p-4">
        <Field label="Business area" className="w-40">
          <Select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)}>
            <option value="">All departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </Select>
        </Field>
        <Field label="From" className="w-40">
          <input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-card px-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30 [color-scheme:dark]"
          />
        </Field>
        <Field label="To" className="w-40">
          <input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-card px-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30 [color-scheme:dark]"
          />
        </Field>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={clearFilters} disabled={!filtersApplied}>
            <X className="h-3.5 w-3.5" /> Clear filters
          </Button>
          <Button variant="outline" size="sm" onClick={refreshAll} disabled={insightsQuery.isFetching || decisionsQuery.isFetching}>
            <RefreshCw className={cn('h-3.5 w-3.5', (insightsQuery.isFetching || decisionsQuery.isFetching) && 'animate-spin')} /> Refresh
          </Button>
        </div>
      </div>

      {insightsQuery.isError && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
          Insights could not be loaded for the current filters — the rest of the dashboard still works.
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => insightsQuery.refetch()}>
            <RefreshCw className="h-3 w-3" /> Retry
          </Button>
        </div>
      )}

      {/* ===== KPI row ===== */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {insightsQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[84px] w-full rounded-2xl" />)
        ) : (
          kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-2xl border border-border bg-card p-4">
              <div className={cn('mb-2 flex h-8 w-8 items-center justify-center rounded-lg border', kpi.tone)}>
                <kpi.icon className="h-4 w-4" />
              </div>
              <p className="text-xl font-bold tabular text-foreground">{kpi.value}</p>
              <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
            </div>
          ))
        )}
      </div>

      {/* ===== Trend + forecast ===== */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-primary" /> Revenue trend
          </p>
          <p className="mb-3 text-[11px] text-muted-foreground">
            {filtersApplied ? 'Selected range' : 'All time'} · {filterDepartment || 'all departments'} · {dateFrom || 'start'} → {dateTo || 'now'}
          </p>
          <TrendChart points={trendPoints} loading={insightsQuery.isLoading} isError={insightsQuery.isError} />
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5 text-primary" /> Forecasting / prediction
          </p>
          <p className="mb-3 text-[11px] text-muted-foreground">Next-quarter projection from trend regression</p>
          {insightsQuery.isLoading ? <TrendChartSkeleton /> : <ForecastPanel forecast={insights?.forecast} />}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* ===== Left: form + decision history ===== */}
        <div className="min-w-0 space-y-4">
          {formOpen && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Brain className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Decision simulator</h2>
                  <p className="text-[11px] text-muted-foreground">Scenario analysis against your data</p>
                </div>
                <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={() => setFormOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <form onSubmit={handleEvaluate} className="space-y-3.5">
                {prefilledDecision && (
                  <div className="rounded-lg border border-warning/25 bg-warning/5 px-3 py-2 text-[11px] text-warning">
                    Pre-loaded from the risk dashboard: {contextRiskTitle}
                  </div>
                )}
                <Field label="Proposed decision">
                  <Textarea
                    id="decision-input"
                    placeholder={
                      contextRiskTitle
                        ? `e.g. Mitigate "${contextRiskTitle}" by ...`
                        : 'e.g. Hire 3 senior AI engineers to accelerate our document summarization agent roadmap.'
                    }
                    value={decision}
                    onChange={(e) => setDecision(e.target.value)}
                    rows={3}
                  />
                </Field>

                <Field label="Department">
                  <Select value={department} onChange={(e) => setDepartment(e.target.value)}>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </Select>
                </Field>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Budget">
                    <Select value={budget} onChange={(e) => setBudget(e.target.value)}>
                      {BUDGETS.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Risk tolerance">
                    <Select value={riskTolerance} onChange={(e) => setRiskTolerance(e.target.value)}>
                      {RISK_TOLERANCES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <Button type="submit" className="mt-1 w-full" disabled={evaluationMutation.isPending || !effectiveDecisionInput.trim()}>
                  {evaluationMutation.isPending ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
                      Running simulator…
                    </>
                  ) : (
                    <>
                      Evaluate proposal <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
              </form>
            </div>
          )}

          {/* Decision history */}
          <div className="rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Decision history</h3>
                <p className="text-[11px] text-muted-foreground">
                  {insights?.decisions?.total !== undefined ? `${insights.decisions.total} total` : 'Evaluations & decisions'}
                </p>
              </div>
              <Badge variant="outline">Persisted</Badge>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {decisionsQuery.isLoading ? (
                <div className="space-y-2 p-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : decisions.length === 0 ? (
                <EmptyState
                  icon={<Brain className="h-4 w-4" />}
                  title="No decisions yet"
                  description="Evaluate a proposal to persist a decision record here."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {decisions.map((d) => (
                    <li key={d._id}>
                      <button
                        onClick={() => setSelectedDecisionId(d._id === selectedDecisionId ? null : d._id)}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                          {d.status === 'implemented' || d.status === 'approved' ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <CircleDot className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-foreground">{d.title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Badge variant={STATUS_VARIANT[d.status] || 'muted'}>{d.status}</Badge>
                            {d.department && <span className="text-[10px] text-muted-foreground">{d.department}</span>}
                            {d.confidence > 0 && (
                              <span className="text-[10px] font-mono text-muted-foreground">{Math.round(d.confidence * 100)}% conf</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className={cn('mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform', selectedDecisionId === d._id && 'rotate-90')} />
                      </button>
                      {selectedDecisionId === d._id && (
                        <div className="border-t border-border bg-secondary/20 px-4 py-3">
                          {d.summary && <p className="mb-2 text-xs leading-relaxed text-secondary-foreground">{d.summary}</p>}
                          {d.recommendation && (
                            <p className="mb-2 border-l-2 border-primary pl-2 text-xs font-medium text-foreground">{d.recommendation}</p>
                          )}
                          <div className="flex flex-wrap gap-1.5">
                            <Button size="sm" variant="outline" onClick={() => openReport(d.title)}>
                              <BookOpen className="h-3 w-3" /> Report
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openInChat(`Provide a strategic update on the decision: ${d.title}`)}>
                              <MessageSquare className="h-3 w-3" /> Analyze in chat
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => navigate('/business-intelligence', { state: { sourceDecision: d.title } })}>
                              Open in BI <ArrowRight className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* ===== Right: results + intelligence ===== */}
        <div className="min-w-0 space-y-4">
          {/* Evaluation result / empty state */}
          {evaluationMutation.isPending ? (
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-brand">
                  <Sparkles className="h-4 w-4 animate-pulse" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Simulating business scenarios…</p>
                  <p className="text-xs text-muted-foreground">Mapping decision against department data, budgets, and risk matrixes</p>
                </div>
              </div>
              <div className="space-y-2.5">
                <Skeleton className="h-3 w-[92%]" />
                <Skeleton className="h-3 w-[87%]" />
                <Skeleton className="h-3 w-[64%]" />
                <Skeleton className="mt-6 h-3 w-[75%]" />
                <Skeleton className="h-3 w-[80%]" />
              </div>
            </div>
          ) : evaluationMutation.isError ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 px-6 py-10 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-destructive/25 bg-destructive/10 text-destructive">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Evaluation failed</p>
                <p className="mt-1 max-w-md text-xs text-muted-foreground">
                  {(() => {
                    const err = evaluationMutation.error as { response?: { data?: { message?: string } } } | undefined;
                    return err?.response?.data?.message || 'The evaluation service could not be reached.';
                  })()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => evaluationMutation.reset()}>Dismiss</Button>
                <Button size="sm" onClick={() => evaluationMutation.mutate({ decision: effectiveDecisionInput.trim(), department, budget, riskTolerance })}>
                  <RefreshCw className="h-3 w-3" /> Retry
                </Button>
              </div>
            </div>
          ) : evaluationResult ? (
            <EvaluationResultView
              result={evaluationResult}
              context={{ department, budget, riskTolerance, decisionText: effectiveDecisionInput.trim() }}
              onReport={() => openReport(effectiveDecisionInput.trim())}
              onChat={() => openInChat(`Evaluate this decision with fresh analysis and provide next steps: ${effectiveDecisionInput.trim()}`)}
            />
          ) : (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Evaluate a business proposal</h2>
                <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-muted-foreground">
                  Describe a strategic decision. The simulator maps it against documents, business metrics, and live risk posture to surface opportunities, risks, and a recommendation.
                </p>
              </div>
            </div>
          )}

          {/* AI recommendations */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Lightbulb className="h-3.5 w-3.5 text-primary" /> AI recommendations
              </p>
              {!recommendationsQuery.isError && (
                <Button variant="ghost" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['decision-recommendations'] })}>
                  <RefreshCw className="h-3 w-3" /> Refresh
                </Button>
              )}
            </div>
            {recommendationsQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-[80%]" />
                <Skeleton className="h-3 w-[90%]" />
              </div>
            ) : recommendations.length > 0 ? (
              <ol className="space-y-2.5">
                {recommendations.map((rec, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                    <span className="text-secondary-foreground">{rec}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState icon={<Lightbulb className="h-4 w-4" />} title="No recommendations yet" description="Evaluate a decision to generate prioritized actions." />
            )}
          </div>

          {/* Scenario analysis + evidence grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Scale className="h-3.5 w-3.5 text-primary" /> Scenario analysis
              </p>
              {scenarioRows.length > 0 ? (
                <ul className="space-y-3">
                  {scenarioRows.map((row, i) => (
                    <li key={i} className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                      <p className="text-xs font-semibold text-foreground">{row.name}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{row.outcome}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={<Scale className="h-4 w-4" />} title="No scenarios yet" description="Evaluate a proposal or open a decision to review modeled scenarios." />
              )}
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5 text-primary" /> Supporting evidence
              </p>
              {selectedDecision && selectedDecision.supportingDocuments?.length > 0 ? (
                <ul className="space-y-2">
                  {selectedDecision.supportingDocuments.map((doc, i) => (
                    <li key={i}>
                      <button
                        onClick={() => navigate('/documents')}
                        className="flex w-full items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-left text-xs hover:bg-secondary/60"
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="truncate text-secondary-foreground">{doc.title || 'Document'}</span>
                        <ArrowRight className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : decisions.some((d) => d.supportingDocuments?.length) ? (
                <div className="space-y-2">
                  {decisions
                    .filter((d) => d.supportingDocuments?.length)
                    .slice(0, 3)
                    .flatMap((d) => d.supportingDocuments.map((doc, i) => ({ ...doc, decisionId: d._id, decisionTitle: d.title, key: `${d._id}-${i}` })))
                    .map((doc) => (
                      <div key={doc.key} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <p className="truncate text-secondary-foreground">{doc.title || 'Document'}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{doc.decisionTitle}</p>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <EmptyState icon={<BookOpen className="h-4 w-4" />} title="No documents linked" description="Evaluations attach matching document evidence automatically." />
              )}
            </div>
          </div>

          {/* Related graph entities */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Network className="h-3.5 w-3.5 text-primary" /> Related graph entities
              </p>
              <Button variant="ghost" size="sm" onClick={() => navigate('/knowledge-graph')}>
                Explore graph <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
            {decisions.some((d) => d.relatedEntities?.length) ? (
              <div className="flex flex-wrap gap-2">
                {decisions
                  .filter((d) => d.relatedEntities?.length)
                  .slice(0, 2)
                  .flatMap((d) => d.relatedEntities.map((ent, i) => ({ ...ent, key: `${d._id}-${i}` })))
                  .map((ent) => (
                    <button
                      key={ent.key}
                      onClick={() => navigate(`/knowledge-graph?entity=${encodeURIComponent(ent.name)}`)}
                      className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-[11px] text-foreground transition-colors hover:bg-secondary"
                    >
                      <CircleDot className="h-3 w-3 text-primary" /> {ent.name}
                      <span className="text-muted-foreground">· {ent.type}</span>
                    </button>
                  ))}
              </div>
            ) : (
              <EmptyState icon={<Network className="h-4 w-4" />} title="No related entities" description="Decisions map nearby knowledge-graph entities when context is available." />
            )}
          </div>

          {/* Connected intelligence sources */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Database className="h-3.5 w-3.5 text-primary" /> Connected intelligence sources
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CONNECTED_SOURCES.map((src) => (
                <button
                  key={src.label}
                  onClick={() => navigate(src.route)}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-secondary/20 px-3 py-2.5 text-left transition-colors hover:bg-secondary/60 hover:border-primary/30"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <src.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground">{src.label}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{src.desc}</p>
                  </div>
                  <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}