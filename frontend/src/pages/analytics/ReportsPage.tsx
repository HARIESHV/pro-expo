import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { reportsApi, GeneratedReport } from '../../api/reports';
import { useAuth } from '../../auth/useAuth';
import {
  BookOpen, Plus, Calendar, ShieldAlert, TrendingUp, Cpu, CheckCircle, Clock,
  FileText, Trash2, Printer, Search, Loader2, AlertCircle, ChevronRight, HelpCircle,
  Database, Shield, AlertTriangle
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { AccessRestricted } from '../../components/AccessRestricted';
import { hasPermission } from '../../auth/rbac';

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { reportId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  useEffect(() => {
    if (reportId) {
      setSelectedReportId(reportId);
    } else {
      setSelectedReportId(null);
    }
  }, [reportId]);

  const isPreviewMode = location.pathname.endsWith('/preview');
  
  // Form State
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'executive' | 'sales' | 'finance' | 'operations'>('executive');
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-12-31');
  const [kpis, setKpis] = useState(true);
  const [trends, setTrends] = useState(true);
  const [risks, setRisks] = useState(true);
  const [aiInsights, setAiInsights] = useState(true);
  const [recommendations, setRecommendations] = useState(true);

  // Source Selector State
  const [selectedSources, setSelectedSources] = useState<string[]>(['executive_dashboard', 'sales', 'analytics', 'risks']);
  const [contextData, setContextData] = useState<Record<string, any>>({});

  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const availableSources = [
    { id: 'universal_search', label: 'Universal Search' },
    { id: 'executive_dashboard', label: 'Executive Dashboard' },
    { id: 'analytics', label: 'Analytics' },
    ...(hasPermission(user?.permissions, 'dashboards.risks') ? [{ id: 'risks', label: 'Risk Dashboard' }] : []),
    { id: 'ai_chat', label: 'AI Chat' },
    { id: 'ai_agents', label: 'AI Agents' },
    { id: 'query_history', label: 'Query History' },
    { id: 'documents', label: 'Documents' },
    { id: 'knowledge_graph', label: 'Knowledge Graph' },
    { id: 'evaluate_graph', label: 'Evaluate Graph' },
    { id: 'business_intelligence', label: 'Business Intelligence' },
  ];

  // Check initial router state (Universal Search / Dashboard redirect)
  useEffect(() => {
    if (location.state) {
      const state = location.state as any;
      if (state.searchQuery) {
        setTitle(`Search Report: ${state.searchQuery}`);
        setType('executive');
        setSelectedSources(['universal_search', 'executive_dashboard', 'analytics', 'risks']);
        setContextData({
          searchQuery: state.searchQuery,
          searchFilters: state.filters || {},
          relevantEntities: state.entities || [],
          kgRelationships: state.kgRelationships || [],
          matchingDocuments: state.matchingDocuments || []
        });
      } else if (state.dashboardType) {
        setTitle(`${state.dashboardType} Analysis Report`);
        setType(state.dashboardType.toLowerCase().includes('sale') ? 'sales' : 'executive');
        const initialSources = [state.dashboardType.toLowerCase().replace(' ', '_'), 'analytics'];
        if (hasPermission(user?.permissions, 'dashboards.risks')) {
          initialSources.push('risks');
        }
        // Filter out any source that is not in the user's available sources list
        const permittedSourceIds = availableSources.map(s => s.id);
        const filteredSources = initialSources.filter(s => permittedSourceIds.includes(s));
        setSelectedSources(filteredSources.length > 0 ? filteredSources : ['analytics']);
        setContextData({
          dashboardFilters: state.filters || {},
          dashboardMetrics: state.metrics || {}
        });
      }
    }
  }, [location.state, user]);

  // Check view permission
  const canView = hasPermission(user?.permissions, 'reports.view');
  const canGenerate = hasPermission(user?.permissions, 'reports.generate');
  const canExport = hasPermission(user?.permissions, 'reports.export');
  const canDelete = hasPermission(user?.permissions, 'reports.delete');

  // Queries
  const { data: listData, isLoading: isListLoading } = useQuery({
    queryKey: ['reports-history'],
    queryFn: () => reportsApi.getReports(),
    enabled: !!canView,
  });

  const reports: GeneratedReport[] = listData?.data?.data?.reports || [];

  const { data: detailData, isLoading: isDetailLoading } = useQuery({
    queryKey: ['report-detail', selectedReportId],
    queryFn: () => reportsApi.getReport(selectedReportId!),
    enabled: !!canView && !!selectedReportId,
  });

  const activeReport = detailData?.data?.data?.report;

  // Mutations
  const generateMutation = useMutation({
    mutationFn: (data: Parameters<typeof reportsApi.generateReport>[0]) =>
      reportsApi.generateReport(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['reports-history'] });
      const newReport = res.data.data?.report;
      if (newReport) {
        navigate(`/reports/${newReport._id}`);
        setTitle('');
      }
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: (id: string) => reportsApi.regenerateReport(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['reports-history'] });
      queryClient.invalidateQueries({ queryKey: ['report-detail', selectedReportId] });
      const updatedReport = res.data.data?.report;
      if (updatedReport) {
        navigate(`/reports/${updatedReport._id}`);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => reportsApi.deleteReport(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['reports-history'] });
      if (selectedReportId === deletedId) {
        navigate('/reports');
      }
    },
  });

  if (!canView) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <BookOpen className="w-4 h-4 text-orange-500" />
          <span>Analytics</span>
        </div>
        <AccessRestricted
          resourceName="Enterprise Reports Module"
          requiredPermission="reports.view"
        />
      </div>
    );
  }

  const handleSourceToggle = (sourceId: string) => {
    setSelectedSources((prev) =>
      prev.includes(sourceId) ? prev.filter((id) => id !== sourceId) : [...prev, sourceId]
    );
  };

  const handleCreateReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !canGenerate) return;

    generateMutation.mutate({
      title,
      type,
      startDate,
      endDate,
      sources: selectedSources,
      context: contextData,
      sections: { kpis, trends, risks, aiInsights, recommendations },
    });
  };

  const handleExport = async (format: 'pdf' | 'csv' | 'json') => {
    if (!selectedReportId) return;
    try {
      const res = await reportsApi.exportReport(selectedReportId, format);
      setExportMessage(res.data.message || `Export to ${format.toUpperCase()} successful.`);
      setTimeout(() => setExportMessage(null), 3000);
      if (format === 'pdf') {
        window.print();
      }
    } catch (err: any) {
      setExportMessage(`Export failed: ${err.response?.data?.message || err.message}`);
      setTimeout(() => setExportMessage(null), 4000);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-[calc(100vh-4rem)] flex flex-col xl:flex-row gap-6">
      {/* Left panel: Form and History */}
      {!isPreviewMode && (
        <div className="w-full xl:w-96 flex-shrink-0 space-y-6 print:hidden">
        {/* Generate Report Card */}
        <div className="glass rounded-2xl p-6 card-glow">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-orange-500" /> Create Intelligence Report
          </h2>

          {!canGenerate ? (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl text-xs text-center font-medium leading-relaxed">
              <ShieldAlert className="w-5 h-5 mx-auto mb-2 text-amber-400" />
              Report generation is restricted for your role.
            </div>
          ) : (
            <form onSubmit={handleCreateReport} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Report Title</label>
                <input
                  type="text"
                  placeholder="e.g. Q3 Strategic Performance"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Report Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full px-4 py-2 rounded-xl bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                >
                  <option value="executive">Executive Summary</option>
                  <option value="sales">Sales & Revenue</option>
                  <option value="finance">Financial Performance</option>
                  <option value="operations">Operational Audits</option>
                </select>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
              </div>

              {/* Sources Selection */}
              <div className="space-y-2 pt-2 border-t border-border/40">
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Data Source Aggregation</label>
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                  {availableSources.map((src) => (
                    <label key={src.id} className="flex items-center justify-between text-xs cursor-pointer p-1 rounded hover:bg-secondary/40">
                      <span className="text-muted-foreground">{src.label}</span>
                      <input
                        type="checkbox"
                        checked={selectedSources.includes(src.id)}
                        onChange={() => handleSourceToggle(src.id)}
                        className="accent-orange-500 w-3.5 h-3.5 rounded"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Checklist */}
              <div className="space-y-2 pt-2 border-t border-border/40 font-medium">
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Report Sections</label>
                {[
                  { checked: kpis, setChecked: setKpis, label: 'KPI Statistics' },
                  { checked: trends, setChecked: setTrends, label: 'Trend Aggregations' },
                  { checked: risks, setChecked: setRisks, label: 'Risk Logs' },
                  { checked: aiInsights, setChecked: setAiInsights, label: 'AI Analytics' },
                  { checked: recommendations, setChecked: setRecommendations, label: 'Recommendations' },
                ].map((c) => (
                  <div key={c.label} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{c.label}</span>
                    <input
                      type="checkbox"
                      checked={c.checked}
                      onChange={(e) => c.setChecked(e.target.checked)}
                      className="accent-orange-500 w-4 h-4 rounded"
                    />
                  </div>
                ))}
              </div>

              {generateMutation.isError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    {(generateMutation.error as any)?.response?.data?.message || generateMutation.error.message || 'Report generation failed.'}
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={generateMutation.isPending || !title.trim()}
                className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-all disabled:opacity-50"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating Report...
                  </>
                ) : (
                  'Generate Intelligence Report'
                )}
              </button>
            </form>
          )}
        </div>

        {/* History List */}
        <div className="glass rounded-2xl p-6 card-glow flex-1 flex flex-col min-h-[300px]">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-orange-500" /> Report History
          </h2>
          {isListLoading ? (
            <div className="flex items-center justify-center flex-grow">
              <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
            </div>
          ) : reports.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No reports generated yet.</p>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-[350px] flex-grow pr-1">
              {reports.map((r) => (
                <div
                  key={r._id}
                  className={cn(
                    'p-3 rounded-xl border transition-all text-left flex items-start gap-2 group relative',
                    selectedReportId === r._id
                      ? 'bg-orange-100 border-orange-300 text-orange-600'
                      : 'bg-secondary/40 border-border/50 hover:bg-secondary/70 text-muted-foreground'
                  )}
                >
                  <button
                    onClick={() => { navigate(`/reports/${r._id}`); setExportMessage(null); }}
                    className="flex-grow min-w-0 text-left"
                  >
                    <p className="font-semibold text-foreground truncate text-xs">{r.title}</p>
                    <p className="text-[10px] text-muted-foreground/80 mt-1 capitalize">
                      {r.type} · {new Date(r.createdAt).toLocaleDateString()}
                    </p>
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => deleteMutation.mutate(r._id)}
                      disabled={deleteMutation.isPending}
                      className="text-muted-foreground/40 hover:text-destructive transition-colors ml-auto flex-shrink-0"
                      title="Delete report"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Right panel: Active Report Detail View */}
      <div className="flex-1 flex flex-col h-full">
        {selectedReportId ? (
          isDetailLoading ? (
            <div className="flex items-center justify-center flex-grow py-40">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            </div>
          ) : activeReport ? (
            <div className="glass rounded-2xl p-8 card-glow space-y-6 flex-grow animate-fade-in print:bg-white print:text-black print:border-none print:shadow-none">
              {/* Report Header */}
              <div className="flex items-start justify-between border-b border-border/50 pb-6 print:pb-3">
                <div>
                  <h2 className="text-2xl font-bold text-foreground print:text-black">{activeReport.title}</h2>
                  <p className="text-sm text-muted-foreground mt-1 capitalize print:text-black">
                    {activeReport.type} Report · Period: {new Date(activeReport.parameters.startDate).toLocaleDateString()} - {new Date(activeReport.parameters.endDate).toLocaleDateString()}
                  </p>

                  {/* Generated By and Date metadata */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
                    {activeReport.createdById && (
                      <span>
                        Generated by: <strong className="text-foreground">{(activeReport.createdById as any).firstName || ''} {(activeReport.createdById as any).lastName || ''}</strong> ({(activeReport.createdById as any).email || ''})
                      </span>
                    )}
                    <span>
                      Generated date: <strong className="text-foreground">{new Date(activeReport.createdAt).toLocaleString()}</strong>
                    </span>
                  </div>

                  {/* Filters block */}
                  {activeReport.parameters.context && Object.keys(activeReport.parameters.context).length > 0 && (
                    <div className="text-xs text-muted-foreground mt-3 p-3 bg-secondary/30 rounded-xl border border-border/30 max-w-2xl">
                      <span className="font-bold uppercase tracking-wider block mb-1">Context Parameters / Filters:</span>
                      <pre className="font-mono text-[10px] whitespace-pre-wrap text-foreground/80">
                        {JSON.stringify(activeReport.parameters.context, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  {/* Sources Used list */}
                  {activeReport.parameters.sources && activeReport.parameters.sources.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-3">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase mr-1">Sources:</span>
                      {activeReport.parameters.sources.map((src: string) => (
                        <span key={src} className="text-[9px] px-2 py-0.5 rounded-lg bg-secondary border border-border text-foreground font-mono capitalize">
                          {src.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 print:hidden">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Preview / Edit Toggle */}
                    <button
                      onClick={() => navigate(isPreviewMode ? `/reports/${activeReport._id}` : `/reports/${activeReport._id}/preview`)}
                      className="px-2.5 py-1.5 border border-border hover:bg-secondary rounded-lg text-[10px] font-bold text-muted-foreground hover:text-foreground"
                    >
                      {isPreviewMode ? 'Exit Preview' : 'Full Preview'}
                    </button>

                    {/* Regenerate (if authorized) */}
                    {canGenerate && (
                      <button
                        onClick={() => regenerateMutation.mutate(activeReport._id)}
                        disabled={regenerateMutation.isPending}
                        className="px-2.5 py-1.5 bg-orange-100 border border-orange-200 text-orange-600 hover:bg-orange-200 rounded-lg text-[10px] font-bold disabled:opacity-50"
                      >
                        {regenerateMutation.isPending ? 'Regenerating...' : 'Regenerate'}
                      </button>
                    )}

                    {/* Share */}
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.origin + `/reports/${activeReport._id}`);
                        setExportMessage('Share link copied to clipboard!');
                        setTimeout(() => setExportMessage(null), 3000);
                      }}
                      className="px-2.5 py-1.5 border border-border hover:bg-secondary rounded-lg text-[10px] font-bold text-muted-foreground hover:text-foreground"
                    >
                      Share
                    </button>

                    {/* Exports */}
                    {canExport ? (
                      <>
                        <button
                          onClick={() => reportsApi.download(activeReport._id, 'pdf').catch((err) => setExportMessage(`Export failed: ${err.response?.data?.message || err.message}`))}
                          className="px-2.5 py-1.5 border border-border hover:bg-secondary rounded-lg text-[10px] font-bold text-muted-foreground hover:text-foreground"
                        >
                          Download PDF
                        </button>
                        <button
                          onClick={() => reportsApi.download(activeReport._id, 'excel').catch((err) => setExportMessage(`Export failed: ${err.response?.data?.message || err.message}`))}
                          className="px-2.5 py-1.5 border border-border hover:bg-secondary rounded-lg text-[10px] font-bold text-muted-foreground hover:text-foreground"
                        >
                          Export Excel
                        </button>
                        <button
                          onClick={() => reportsApi.download(activeReport._id, 'docx').catch((err) => setExportMessage(`Export failed: ${err.response?.data?.message || err.message}`))}
                          className="px-2.5 py-1.5 border border-border hover:bg-secondary rounded-lg text-[10px] font-bold text-muted-foreground hover:text-foreground"
                        >
                          Export DOCX
                        </button>
                        <button
                          onClick={() => reportsApi.download(activeReport._id, 'csv').catch((err) => setExportMessage(`Export failed: ${err.response?.data?.message || err.message}`))}
                          className="px-2.5 py-1.5 border border-border hover:bg-secondary rounded-lg text-[10px] font-bold text-muted-foreground hover:text-foreground"
                        >
                          Export CSV
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-amber-500/80 font-medium">Export restricted</span>
                    )}
                  </div>
                </div>
              </div>

              {exportMessage && (
                <div className="p-3 bg-orange-100 border border-orange-200 text-orange-600 rounded-xl text-xs flex items-center gap-2 animate-fade-in print:hidden">
                  <Cpu className="w-4 h-4 flex-shrink-0" />
                  <span>{exportMessage}</span>
                </div>
              )}

              {/* Status failed warning */}
              {activeReport.status === 'failed' && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">AI Report Generation Failed</p>
                    <p className="text-xs">{activeReport.content.errors?.join(', ') || 'Unknown LLM agent error.'}</p>
                  </div>
                </div>
              )}

              {/* Report Content */}
              {activeReport.status === 'completed' && (
                <div className="space-y-6">
                  {/* Executive Summary */}
                  {activeReport.content.executiveSummary && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 print:text-black">
                        <FileText className="w-4 h-4 text-orange-500" /> Executive Summary
                      </h3>
                      <p className="text-foreground/90 text-sm leading-relaxed whitespace-pre-wrap print:text-black">{activeReport.content.executiveSummary}</p>
                    </div>
                  )}

                  {/* KPIs */}
                  {activeReport.parameters.sections?.kpis && activeReport.content.kpis && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 print:text-black">
                        <TrendingUp className="w-4 h-4 text-green-400" /> Key Performance Indicators
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {activeReport.content.kpis.map((kpi) => (
                          <div key={kpi.name} className="p-4 rounded-xl bg-secondary/30 border border-border/50 print:bg-white print:border-black">
                            <p className="text-xs text-muted-foreground print:text-black">{kpi.name}</p>
                            <p className="text-lg font-bold text-foreground mt-0.5 print:text-black">{kpi.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Aggregated Data Tables & Evidence */}
                  {(activeReport.content as any).aggregatedData && (
                    <div className="space-y-4 pt-4 border-t border-border/40">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 print:text-black">
                        <FileText className="w-4 h-4 text-cyan-400" /> Source Data Evidence & Analysis
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Universal Search Evidence */}
                        {(activeReport.content as any).aggregatedData.universal_search && (
                          <div className="glass rounded-xl p-4 bg-secondary/20 border border-border/40">
                            <h4 className="text-xs font-bold text-foreground mb-2">Universal Search Context</h4>
                            <p className="text-xs text-muted-foreground mb-3">Query: "{(activeReport.content as any).aggregatedData.universal_search.query}"</p>
                            {(activeReport.content as any).aggregatedData.universal_search.matchingDocuments?.length > 0 && (
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Linked Documents:</span>
                                {(activeReport.content as any).aggregatedData.universal_search.matchingDocuments.map((doc: any, i: number) => (
                                  <div key={i} className="text-xs p-1.5 bg-secondary/40 rounded border border-border/30 text-foreground truncate">
                                    {doc.title || doc.filename}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Sales by Region Table */}
                        {(activeReport.content as any).aggregatedData.sales && Array.isArray((activeReport.content as any).aggregatedData.sales) && (
                          <div className="glass rounded-xl p-4 bg-secondary/20 border border-border/40 col-span-1 md:col-span-2">
                            <h4 className="text-xs font-bold text-foreground mb-3">Sales performance by Region</h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="border-b border-border/50 text-muted-foreground">
                                    <th className="pb-2 font-semibold">Region</th>
                                    <th className="pb-2 font-semibold text-right">Total Revenue</th>
                                    <th className="pb-2 font-semibold text-right">Transactions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(activeReport.content as any).aggregatedData.sales.map((item: any, i: number) => (
                                    <tr key={i} className="border-b border-border/20 last:border-0">
                                      <td className="py-2 text-foreground font-medium">{item._id || 'Unknown'}</td>
                                      <td className="py-2 text-right text-emerald-400 font-mono">${(item.total || 0).toLocaleString()}</td>
                                      <td className="py-2 text-right text-foreground font-mono">{item.count || 0}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Customer segmentation statistics */}
                        {(activeReport.content as any).aggregatedData.customers && Array.isArray((activeReport.content as any).aggregatedData.customers) && (
                          <div className="glass rounded-xl p-4 bg-secondary/20 border border-border/40">
                            <h4 className="text-xs font-bold text-foreground mb-3">Customer Segmentation Distribution</h4>
                            <div className="space-y-3">
                              {(activeReport.content as any).aggregatedData.customers.map((item: any, i: number) => (
                                <div key={i} className="space-y-1">
                                  <div className="flex justify-between text-xs">
                                    <span className="capitalize text-muted-foreground">{item._id || 'Unknown'}</span>
                                    <span className="font-semibold text-foreground">{item.count} customers (Avg LTV: ${Math.round(item.avgLTV || 0).toLocaleString()})</span>
                                  </div>
                                  <div className="w-full bg-secondary rounded-full h-1.5">
                                    <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (item.count / 300) * 100)}%` }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Risks dashboard count */}
                        {(activeReport.content as any).aggregatedData.risks && Array.isArray((activeReport.content as any).aggregatedData.risks) && (
                          <div className="glass rounded-xl p-4 bg-secondary/20 border border-border/40">
                            <h4 className="text-xs font-bold text-foreground mb-3">Enterprise Threats & Anomaly Distribution</h4>
                            <div className="space-y-3">
                              {(activeReport.content as any).aggregatedData.risks.map((item: any, i: number) => (
                                <div key={i} className="space-y-1">
                                  <div className="flex justify-between text-xs">
                                    <span className="capitalize text-muted-foreground">{item._id} Severity</span>
                                    <span className="font-semibold text-foreground">{item.count} Active Threats</span>
                                  </div>
                                  <div className="w-full bg-secondary rounded-full h-1.5">
                                    <div className={cn(
                                      "h-1.5 rounded-full",
                                      item._id === 'critical' ? 'bg-red-500' : item._id === 'high' ? 'bg-orange-500' : 'bg-amber-500'
                                    )} style={{ width: `${Math.min(100, (item.count / 20) * 100)}%` }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* AI Insights */}
                  {activeReport.parameters.sections?.aiInsights && activeReport.content.aiInsights && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 print:text-black">
                        <Cpu className="w-4 h-4 text-violet-400" /> AI Strategic Insights
                      </h3>
                      <ul className="space-y-2">
                        {activeReport.content.aiInsights.map((insight, idx) => (
                          <li key={idx} className="flex gap-2.5 text-sm text-foreground/80 print:text-black">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
                            <span>{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommendations */}
                  {activeReport.parameters.sections?.recommendations && activeReport.content.recommendations && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 print:text-black">
                        <CheckCircle className="w-4 h-4 text-emerald-400" /> Strategic Recommendations
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {activeReport.content.recommendations.map((rec, idx) => (
                          <div key={idx} className="p-4 rounded-xl bg-orange-50 border border-orange-200 text-sm text-foreground/90 print:bg-white print:border-black print:text-black">
                            <p className="font-semibold text-orange-600 mb-1 print:text-black">Action {idx + 1}</p>
                            <p>{rec}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null
        ) : (
          /* Empty/Initial State */
          <div className="glass rounded-2xl p-10 card-glow flex flex-col items-center justify-center text-center flex-grow py-40 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-orange-100 border border-orange-200 flex items-center justify-center mb-6">
              <BookOpen className="w-8 h-8 text-orange-500" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">No Report Selected</h2>
            <p className="text-muted-foreground max-w-md mb-6">
              Select an existing intelligence report from the history on the left, or configure parameters and generate a new report.
            </p>
            <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-xl border border-border text-xs text-muted-foreground max-w-lg">
              <Cpu className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <span>
                <strong>Powered by the Executive Agent:</strong> AI constructs are strictly calculated based on database variables and validated parameters.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
