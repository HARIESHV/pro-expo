import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { risksApi, RiskDetails, RiskIntelligenceSource, RiskAnalysisMeta } from '../../api/risks';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, TrendingDown, ShieldAlert, Activity, Loader2, RefreshCw,
  FileText, ChevronDown, ExternalLink, ShieldCheck, X, Database, Bot,
  CheckCircle2, Globe, BarChart3, BookOpen, MessageSquare, Network,
} from 'lucide-react';
import { cn } from '../../utils/cn';

const SOURCE_META: Record<RiskIntelligenceSource, { label: string; route: string; icon: React.ElementType; color: string }> = {
  document: { label: 'DOCUMENT', route: '/documents', icon: FileText, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  ai_analysis: { label: 'AI ANALYSIS', route: '/chat', icon: Bot, color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  universal_search: { label: 'UNIVERSAL SEARCH', route: '/search-home', icon: Globe, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  chat: { label: 'AI CHAT', route: '/chat', icon: MessageSquare, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
  analytics: { label: 'ANALYTICS', route: '/analytics', icon: BarChart3, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  business_intelligence: { label: 'BUSINESS INTELLIGENCE', route: '/business-intelligence', icon: TrendingDown, color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
  knowledge_graph: { label: 'KNOWLEDGE GRAPH', route: '/knowledge-graph', icon: Network, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  graph_evaluation: { label: 'GRAPH EVALUATION', route: '/evaluate-graph', icon: ShieldCheck, color: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20' },
  decision_intelligence: { label: 'DECISION INTELLIGENCE', route: '/decision-intelligence', icon: BookOpen, color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
};

const STATUS_COLORS: Record<string, string> = {
  open: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  monitoring: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  mitigated: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  resolved: 'text-green-500 bg-green-500/10 border-green-500/20',
  identified: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  assessing: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  mitigating: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  accepted: 'text-muted-foreground bg-secondary border-border',
};

const LEVEL_COLORS: Record<string, string> = {
  critical: 'text-red-400 bg-red-500/10 border-red-500/20',
  high: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  low: 'text-green-400 bg-green-500/10 border-green-500/20',
};

const SEVERITY_BAR: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-green-500',
};

export default function RiskDashboardPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [levelFilter, setLevelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const { data: summaryData, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['risk-summary'],
    queryFn: () => risksApi.getRiskSummary(),
  });

  const { data: listData, isLoading: isListLoading } = useQuery({
    queryKey: ['risks-list', levelFilter, statusFilter],
    queryFn: () => risksApi.getRisks({ level: levelFilter, status: statusFilter }),
  });

  const { data: reportData, refetch: refetchReport, isFetching: isReportFetching } = useQuery({
    queryKey: ['risk-report'],
    queryFn: () => risksApi.getRiskReport(),
    enabled: false,
  });

  const summary = summaryData?.data?.data?.summary || {};
  const total = summaryData?.data?.data?.total ?? Object.values(summary).reduce((a, b) => a + b, 0);
  const sourceCounts = summaryData?.data?.data?.sources || {};
  const risks: RiskDetails[] = listData?.data?.data?.risks || [];
  const meta: Partial<RiskAnalysisMeta> = listData?.data?.data || {};
  const unavailableSources: RiskIntelligenceSource[] = meta.unavailableSources || [];

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Pick<RiskDetails, 'status' | 'mitigation' | 'recommendations'>> }) =>
      risksApi.updateRisk(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk-summary'] });
      queryClient.invalidateQueries({ queryKey: ['risks-list'] });
    },
  });

  const recalcMutation = useMutation({
    mutationFn: () => risksApi.recalculate(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk-summary'] });
      queryClient.invalidateQueries({ queryKey: ['risks-list'] });
      queryClient.invalidateQueries({ queryKey: ['risk-report'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => risksApi.deleteRisk(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk-summary'] });
      queryClient.invalidateQueries({ queryKey: ['risks-list'] });
    },
  });

  const handleGenerateReport = async () => {
    setReportOpen(true);
    refetchReport();
  };

  const overviewCards = [
    { label: 'Total Risks', count: total, icon: ShieldAlert, color: 'text-primary bg-primary/10 border-primary/20' },
    { label: 'Critical', count: summary.critical || 0, icon: ShieldAlert, color: 'text-red-400 bg-red-500/10 border-red-500/20' },
    { label: 'High', count: summary.high || 0, icon: AlertTriangle, color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
    { label: 'Moderate', count: summary.medium || 0, icon: TrendingDown, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    { label: 'Low', count: summary.low || 0, icon: Activity, color: 'text-green-400 bg-green-500/10 border-green-500/20' },
  ];

  const distributionBySeverity = ['critical', 'high', 'medium', 'low']
    .map((l) => ({ label: l, count: summary[l] || 0 }))
    .filter((d) => d.count > 0);

  const categoryMap = new Map<string, number>();
  risks.forEach((r) => categoryMap.set(r.category, (categoryMap.get(r.category) || 0) + 1));
  const byCategory = [...categoryMap.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);

  const bySource = Object.entries(sourceCounts).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);

  const hasRisks = risks.length > 0;
  const hasAnySource = Object.values(sourceCounts).some((c) => c > 0) || risks.length > 0;

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-[calc(100vh-4rem)] space-y-6">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-foreground">Risk Intelligence</h1>
          <p className="text-xs text-muted-foreground">
            Centralized, automatically generated risk detection across the enterprise platform
          </p>
          {meta.analyzedAt && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Last analyzed {new Date(meta.analyzedAt).toLocaleString()} · {meta.totalSignals ?? 0} risk signals consolidated
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => recalcMutation.mutate()}
            disabled={recalcMutation.isPending}
            className="flex items-center gap-2 px-4 py-2.5 border border-primary/40 hover:border-primary bg-primary/10 rounded-xl text-sm font-semibold transition-all text-primary"
          >
            {recalcMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {recalcMutation.isPending ? 'Recalculating...' : 'Refresh Risk Analysis'}
          </button>
          <button
            onClick={handleGenerateReport}
            className="flex items-center gap-2 px-4 py-2.5 border border-border hover:bg-secondary rounded-xl text-sm font-semibold transition-all text-muted-foreground hover:text-foreground"
          >
            <FileText className="w-4 h-4" />
            Generate Risk Report
          </button>
        </div>
      </div>

      {/* Source availability notice */}
      {unavailableSources.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3 text-xs text-amber-300">
          Some risk sources are temporarily unavailable:{' '}
          {unavailableSources.map((s) => (SOURCE_META[s]?.label || s).toLowerCase()).join(', ')}. Risk analysis continues
          using the remaining available sources.
        </div>
      )}

      {meta.totalSignals === 0 && (
        <div className="bg-secondary/40 border border-border rounded-2xl px-4 py-3 text-xs text-muted-foreground">
          Insufficient enterprise data for reliable risk analysis. Upload documents or add business data to enable detection.
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {overviewCards.map((item) => (
          <div key={item.label} className="glass rounded-2xl p-6 card-glow animate-fade-in">
            <div className={cn('w-10 h-10 rounded-xl border flex items-center justify-center mb-3', item.color)}>
              <item.icon className="w-5 h-5" />
            </div>
            {isSummaryLoading ? (
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            ) : (
              <p className="text-2xl font-bold text-foreground">{item.count}</p>
            )}
            <p className="text-sm text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk List */}
        <div className="lg:col-span-2 glass rounded-2xl p-6 card-glow space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-foreground mr-2">Detected Risks</p>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-secondary border border-border text-xs text-foreground focus:outline-none"
            >
              <option value="">All Severities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-secondary border border-border text-xs text-foreground focus:outline-none"
            >
              <option value="">All Statuses</option>
              {['open', 'monitoring', 'mitigated', 'resolved'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {isListLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : risks.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm">{hasAnySource ? 'No significant risks detected.' : 'No risk data available.'}</p>
              <p className="text-xs mt-1">
                {hasAnySource
                  ? 'Risk Intelligence continuously monitors all sources and will surface risks when meaningful evidence appears.'
                  : 'Connect or import enterprise data to begin automatic risk analysis.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {risks.map((risk) => {
                const isOpen = expanded === risk._id;
                return (
                  <div key={risk._id} className="bg-card border border-border rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setExpanded(isOpen ? null : risk._id)}
                      className="w-full text-left p-4 hover:bg-secondary/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-foreground text-sm">{risk.title}</p>
                            <span className={cn('text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider font-semibold', LEVEL_COLORS[risk.level] || LEVEL_COLORS.medium)}>
                              {risk.level}
                            </span>
                            <span className={cn('text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider font-semibold', STATUS_COLORS[risk.status] || STATUS_COLORS.open)}>
                              {risk.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{risk.category} · {risk.description}</p>
                        </div>
                        <ChevronDown className={cn('w-4 h-4 text-muted-foreground shrink-0 transition-transform', isOpen && 'rotate-180')} />
                      </div>

                      {/* Key metrics + source badges */}
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <Metric label="Score" value={String(risk.riskScore)} />
                        <Metric label="Prob" value={risk.probability != null ? `${risk.probability}%` : '-'} />
                        <Metric label="Impact" value={risk.impact != null ? `${risk.impact}%` : '-'} />
                        <span className="text-[10px] px-2 py-1 rounded-lg bg-secondary text-muted-foreground border border-border">
                          Confidence {Math.round((risk.confidence || 0) * 100)}%
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                          {(risk.sources || []).map((s) => {
                            const m = SOURCE_META[s];
                            if (!m) return null;
                            return (
                              <button
                                key={s}
                                onClick={(e) => { e.stopPropagation(); navigate(m.route); }}
                                title={`View ${m.label}`}
                                className={cn('flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md border uppercase tracking-wider font-semibold', m.color)}
                              >
                                <m.icon className="w-2.5 h-2.5" />
                                {m.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </button>

                    {/* Expanded details */}
                    {isOpen && (
                      <div className="border-t border-border px-4 py-4 space-y-4 bg-secondary/20">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Description</p>
                          <p className="text-sm text-foreground/90">{risk.description}</p>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Why was this risk detected?</p>
                          <div className="space-y-2">
                            {(risk.evidence || []).map((ev, idx) => (
                              <div key={idx} className="bg-card border border-border rounded-xl px-3 py-2 text-xs">
                                <p className="text-muted-foreground mb-0.5">{ev.label}</p>
                                <p className="text-foreground/85">{ev.detail}</p>
                              </div>
                            ))}
                            {(risk.evidence || []).length === 0 && (
                              <p className="text-xs text-muted-foreground italic">Insufficient evidence to establish this risk.</p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <DetailStat label="Probability" value={`${risk.probability ?? '-'}%`} />
                          <DetailStat label="Impact" value={`${risk.impact ?? '-'}%`} />
                          <DetailStat label="Risk Score" value={String(risk.riskScore ?? '-')} />
                          <DetailStat label="Confidence" value={`${Math.round((risk.confidence || 0) * 100)}%`} />
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Mitigation</p>
                          <p className="text-sm text-foreground/90">{risk.mitigation || risk.mitigationStrategies?.[0] || 'Insufficient information to define mitigation.'}</p>
                        </div>

                        {(risk.recommendations || []).length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Recommended Actions</p>
                            <ul className="space-y-1">
                              {risk.recommendations.map((rec, idx) => (
                                <li key={idx} className="flex gap-2 text-sm text-foreground/85">
                                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                  <span>{rec}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* source dashboard navigation */}
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Source Dashboards</p>
                          <div className="flex flex-wrap gap-2">
                            {(risk.sources || []).map((s) => {
                              const m = SOURCE_META[s];
                              if (!m) return null;
                              return (
                                <button
                                  key={s}
                                  onClick={() => navigate(m.route)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary border border-border text-xs text-foreground hover:border-primary/40 transition-colors"
                                >
                                  <m.icon className="w-3.5 h-3.5 text-primary" />
                                  View {m.label.replace(/_/g, ' ').toLowerCase()}
                                  <ExternalLink className="w-3 h-3 text-muted-foreground" />
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 flex-wrap">
                          <select
                            value={risk.status}
                            onChange={(e) => updateMutation.mutate({ id: risk._id, updates: { status: e.target.value as any } })}
                            className="bg-secondary/50 border border-border text-xs rounded-lg px-2 py-1.5 text-foreground focus:outline-none"
                          >
                            {['open', 'monitoring', 'mitigated', 'resolved'].map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => deleteMutation.mutate(risk._id)}
                            className="ml-auto text-xs text-muted-foreground hover:text-destructive transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Side distribution panels */}
        <div className="space-y-6">
          <div className="glass rounded-2xl p-5 card-glow">
            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Risk Distribution</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">By Severity</p>
            <div className="space-y-2 mb-4">
              {distributionBySeverity.length === 0 && <p className="text-xs text-muted-foreground italic">No data</p>}
              {distributionBySeverity.map((d) => (
                <Bar key={d.label} label={d.label} count={d.count} total={total} barClass={SEVERITY_BAR[d.label] || 'bg-primary'} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">By Category</p>
            <div className="space-y-2 mb-4">
              {byCategory.length === 0 && <p className="text-xs text-muted-foreground italic">No data</p>}
              {byCategory.map((d) => (
                <Bar key={d.category} label={d.category} count={d.count} total={risks.length} barClass="bg-primary" />
              ))}
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">By Source</p>
            <div className="space-y-2">
              {bySource.length === 0 && <p className="text-xs text-muted-foreground italic">No data</p>}
              {bySource.map((d) => {
                const m = SOURCE_META[d.source as RiskIntelligenceSource];
                return (
                  <button
                    key={d.source}
                    onClick={() => m && navigate(m.route)}
                    className="w-full flex items-center justify-between gap-2 text-xs text-foreground hover:opacity-80 transition-opacity"
                  >
                    <span className="flex items-center gap-1.5">
                      {m && <m.icon className="w-3.5 h-3.5 text-muted-foreground" />}
                      {m?.label || d.source}
                    </span>
                    <span className="text-muted-foreground">{d.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Risk Report Modal */}
      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setReportOpen(false)}>
          <div className="bg-card border border-border rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-pop" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold text-foreground">Risk Intelligence Report</h3>
              </div>
              <button onClick={() => setReportOpen(false)} className="p-2 hover:bg-secondary rounded-lg text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {isReportFetching ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : reportData?.data?.data?.report ? (
              <RiskReportBody report={reportData.data.data.report as any} navigate={navigate} />
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">Unable to generate the report right now.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-secondary/40 border border-border rounded-lg px-2 py-1">
      <span className="uppercase tracking-wider">{label}</span>
      <span className="font-mono text-foreground font-semibold">{value}</span>
    </span>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm font-bold text-foreground font-mono mt-0.5">{value}</p>
    </div>
  );
}

function Bar({ label, count, total, barClass }: { label: string; count: number; total: number; barClass: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground capitalize">{label.replace(/_/g, ' ')}</span>
        <span className="text-foreground font-semibold">{count}</span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', barClass)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RiskReportBody({ report, navigate }: { report: any; navigate: (p: string) => void }) {
  const badgeFor = (s: string) => SOURCE_META[s as RiskIntelligenceSource];
  return (
    <div className="space-y-4">
      <div className="bg-secondary/30 border border-border rounded-2xl p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Executive Summary</p>
        <p className="text-sm text-foreground/90">{report.executiveSummary}</p>
        <p className="text-[11px] text-muted-foreground mt-2">Generated {new Date(report.generatedAt).toLocaleString()} · {report.totalRisks} active risks</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Risk Categories</p>
        <div className="flex flex-wrap gap-2">
          {report.riskCategories?.map((c: any) => (
            <span key={c.category} className="text-[11px] px-2 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20">
              {c.category} ({c.count})
            </span>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Risk Sources</p>
        <div className="flex flex-wrap gap-2">
          {report.riskSources?.map((s: any) => {
            const m = badgeFor(s.source);
            return (
              <button
                key={s.source}
                onClick={() => m && navigate(m.route)}
                className={cn('flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border uppercase tracking-wider font-semibold', m?.color || 'text-muted-foreground bg-secondary border-border')}
              >
                {m && <m.icon className="w-3 h-3" />}
                {m?.label || s.source} ({s.count})
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">All Risks</p>
        <div className="space-y-2">
          {report.risks?.map((r: any) => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-center gap-2">
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border uppercase', LEVEL_COLORS[r.severity])}>{r.severity}</span>
                <span className="text-sm font-semibold text-foreground">{r.title}</span>
                <span className="ml-auto text-[10px] text-muted-foreground font-mono">Score {r.riskScore}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{r.description}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(r.sources || []).map((s: string) => {
                  const m = badgeFor(s);
                  return m ? (
                    <button key={s} onClick={() => navigate(m.route)} className={cn('text-[9px] px-1.5 py-0.5 rounded border uppercase', m.color)}>
                      {m.label}
                    </button>
                  ) : null;
                })}
              </div>
              {r.mitigation && (
                <p className="text-[11px] text-foreground/80 mt-2">
                  <span className="text-muted-foreground">Mitigation: </span>{r.mitigation}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
