import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Database,
  FileText,
  Globe,
  MessageSquare,
  Package,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Users,
  Wrench,
} from 'lucide-react';
import { businessIntelligenceApi } from '../../api/businessIntelligence';
import CompanyAnalysisPanel from '../../components/dashboard/CompanyAnalysisPanel';
import { CompanyAnalysisResult, CompanyIntelligence, Direction } from '../../types/businessIntelligence';

const money = (v: number | null | undefined): string => (v == null || !Number.isFinite(v) ? '—' : `$${Math.round(v).toLocaleString()}`);
const pct = (v: number | null | undefined): string => (v == null || !Number.isFinite(v) ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`);

// ---------------------------------------------------------------------------
// Presentational building blocks
// ---------------------------------------------------------------------------
function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-6 card-glow animate-fade-in">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-semibold text-foreground text-sm uppercase tracking-wider">{title}</h2>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

function DirectionArrow({ dir }: { dir: Direction }) {
  if (dir === 'up') return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
  if (dir === 'down') return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
  return <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />;
}

// ---------------------------------------------------------------------------
// Company detail sections built exclusively from the analysis result (biData).
// Facets the real-world company dataset does not provide are labelled
// "Data unavailable for <company>" instead of showing unrelated data.
// ---------------------------------------------------------------------------
function RevenuePerformanceCard({ biData }: { biData: CompanyAnalysisResult }) {
  const { comparison } = biData;
  const rows = [
    {
      name: comparison.long.displayName || 'Long',
      revenue: comparison.long.latestRevenue,
      growth: comparison.long.growthPct,
      momentum: comparison.long.momentum,
    },
    {
      name: comparison.short.displayName || 'Short',
      revenue: comparison.short.latestRevenue,
      growth: comparison.short.growthPct,
      momentum: comparison.short.momentum,
    },
  ];
  return (
    <Card title="Revenue Performance" subtitle={`Latest available revenue for the selected pair · ${biData.meta.currencyNormalization}`}>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center justify-between rounded-xl bg-secondary/30 border border-border/50 p-3">
            <div>
              <p className="text-xs font-semibold text-foreground">{r.name}</p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <DirectionArrow dir={r.momentum} /> {r.momentum} momentum
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-foreground">{money(r.revenue)}</p>
              <p className={`text-[11px] font-semibold ${r.growth != null && r.growth >= 0 ? 'text-emerald-400' : r.growth != null ? 'text-red-400' : 'text-muted-foreground'}`}>
                {pct(r.growth)} growth
              </p>
            </div>
          </div>
        ))}
        <p className="text-[11px] text-muted-foreground pt-1">
          Away from the trade, per-company revenue, growth and direction come from <span className="text-foreground/80">{biData.revenueTrend.long.currency} figures</span>{' '}
          gathered for {biData.companies.long.resolution.displayName} and {biData.companies.short.resolution.displayName} by the data layer.
        </p>
      </div>
    </Card>
  );
}

function UnavailableCard({
  title,
  subtitle,
  icon,
  companyName,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  companyName: string;
}) {
  return (
    <Card title={title} subtitle={subtitle}>
      <div className="flex flex-col items-center justify-center py-12 text-center">
        {icon}
        <p className="text-sm text-foreground/80">{title} unavailable for {companyName}.</p>
        <p className="text-xs text-muted-foreground mt-1">{subtitle} is not available from the connected company data source.</p>
      </div>
    </Card>
  );
}

function CompanyMetricCard({ title, info, capability, items, emptyText, icon }: {
  title: string;
  info: CompanyIntelligence;
  capability: keyof CompanyIntelligence['capabilities'];
  items?: Array<{ name: string; revenue: number | null; sharePct: number | null; source: string }>;
  emptyText: string;
  icon: React.ReactNode;
}) {
  const name = info.resolution.displayName;
  if (!info.capabilities[capability]) {
    return <UnavailableCard title={title} subtitle={emptyText} icon={icon} companyName={name} />;
  }
  return (
    <Card title={title} subtitle={name}>
      <div className="space-y-2">
        {(items || []).map((item) => (
          <div key={item.name} className="flex items-center justify-between border-b border-border/40 pb-2 text-xs">
            <span className="text-foreground/80">{item.name}</span>
            <span className="text-foreground font-semibold">{item.revenue != null ? money(item.revenue) : item.sharePct != null ? `${item.sharePct.toFixed(1)}%` : '—'}</span>
          </div>
        ))}
        <p className="text-[10px] text-muted-foreground pt-1">Source: {(items || [])[0]?.source || 'connected company data'}</p>
      </div>
    </Card>
  );
}

function AnomalyCard({ info }: { info: CompanyIntelligence }) {
  if (!info.capabilities.anomalies) return <UnavailableCard title="Anomaly Detection" subtitle="Insufficient historical company data for anomaly detection" icon={<ShieldAlert className="w-8 h-8 text-muted-foreground mb-3" />} companyName={info.resolution.displayName} />;
  return (
    <Card title="Anomaly Detection" subtitle={info.resolution.displayName}>
      {info.anomalies.length ? info.anomalies.map((item) => <div key={`${item.period}-${item.metric}`} className="mb-2 text-xs text-foreground/80"><span className="font-semibold">{item.period} · {item.metric}</span><p className="text-muted-foreground mt-1">{item.description}</p></div>) : <p className="text-xs text-muted-foreground">No unusual deviations detected in the selected company&apos;s historical revenue.</p>}
    </Card>
  );
}

function CompanyDetailSections({ biData }: { biData: CompanyAnalysisResult }) {
  const companies = [biData.companies.long, biData.companies.short];
  return (
    <>
      <div className="flex items-baseline gap-2 mt-10 mb-4 px-1">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Company Detail</h2>
        <span className="text-[11px] text-muted-foreground">
          Built solely from the analysis above. Facets the company dataset does not provide are labelled unavailable.
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <RevenuePerformanceCard biData={biData} />
        {companies.map((info) => <CompanyMetricCard key={`region-${info.resolution.nameKey}`} title="Revenue by Region" info={info} capability="regionalRevenue" items={info.segments.regions} emptyText="Regional revenue data" icon={<Globe className="w-8 h-8 text-muted-foreground mb-3" />} />)}
        {companies.map((info) => <CompanyMetricCard key={`product-${info.resolution.nameKey}`} title="Revenue by Product" info={info} capability="productRevenue" items={info.segments.products} emptyText="Product-level revenue data" icon={<Package className="w-8 h-8 text-muted-foreground mb-3" />} />)}
        {companies.map((info) => <CompanyMetricCard key={`customer-${info.resolution.nameKey}`} title="Customers by Segment" info={info} capability="customerSegments" items={info.segments.customerSegments} emptyText="Customer segment data is not available from the connected company data source" icon={<Users className="w-8 h-8 text-muted-foreground mb-3" />} />)}
        {companies.map((info) => <AnomalyCard key={`anomaly-${info.resolution.nameKey}`} info={info} />)}
        {companies.map((info) => <UnavailableCard key={`risk-${info.resolution.nameKey}`} title="Key Risk Accounts" subtitle="Account-level risk data is unavailable for the selected company" icon={<AlertTriangle className="w-8 h-8 text-muted-foreground mb-3" />} companyName={info.resolution.displayName} />)}
        {companies.map((info) => <UnavailableCard key={`operations-${info.resolution.nameKey}`} title="Operations" subtitle="Operational data unavailable for the selected company" icon={<Wrench className="w-8 h-8 text-muted-foreground mb-3" />} companyName={info.resolution.displayName} />)}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Business Intelligence — Long Company vs Short Company
// ---------------------------------------------------------------------------
export default function BusinessIntelligencePage() {
  const navigate = useNavigate();

  // Single source of truth for the whole dashboard: the two user-entered
  // companies and the single analysis result (biData) they produced.
  const [longCompany, setLongCompany] = useState('');
  const [shortCompany, setShortCompany] = useState('');
  const [biData, setBiData] = useState<CompanyAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stale-response protection: only the newest request may write biData.
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Abort any in-flight analysis when the page unmounts.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const runAnalysis = (refresh: boolean) => {
    const long = longCompany.trim();
    const short = shortCompany.trim();
    if (long.length < 2 || short.length < 2) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;

    // Clear stale state before kicking off a new run — the view must never
    // show a previous analysis for the newly selected companies.
    setBiData(null);
    setError(null);
    setIsLoading(true);

    const call = refresh
      ? businessIntelligenceApi.refresh(long, short, controller.signal)
      : businessIntelligenceApi.analyze(long, short, controller.signal);

    call
      .then((resp) => {
        if (requestId !== requestIdRef.current || controller.signal.aborted) return;
        const result = resp?.data?.data;
        if (result) {
          setBiData(result);
        } else {
          setError('No analysis data returned. Please try again.');
        }
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current || controller.signal.aborted) return;
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          (err instanceof Error ? err.message : '') ||
          'Unable to analyze these companies. Please try again.';
        setError(message);
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setIsLoading(false);
      });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-[calc(100vh-4rem)] animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-foreground">Business Intelligence</h1>
          <p className="text-xs text-muted-foreground">Real-world company analysis — Long Company vs Short Company, driven by gathered data</p>
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

      {/* Analysis workflow (input + full company-grounded result) */}
      <CompanyAnalysisPanel
        longCompany={longCompany}
        shortCompany={shortCompany}
        onLongCompanyChange={setLongCompany}
        onShortCompanyChange={setShortCompany}
        biData={biData}
        isLoading={isLoading}
        error={error}
        onAnalyze={runAnalysis}
      />

      {/* Lower sections are built exclusively from the same biData */}
      {biData && !isLoading && <CompanyDetailSections biData={biData} />}
    </div>
  );
}