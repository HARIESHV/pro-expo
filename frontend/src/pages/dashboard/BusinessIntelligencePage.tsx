import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../../api/analytics';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, Users, BarChart2, DollarSign, Loader2, ArrowUpRight, MessageSquare, FileText } from 'lucide-react';

export default function BusinessIntelligencePage() {
  const navigate = useNavigate();

  // Queries
  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: () => analyticsApi.getDashboardMetrics(),
  });

  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: ['sales-trend'],
    queryFn: () => analyticsApi.getSalesTrend(),
  });

  const { data: customerData, isLoading: customerLoading } = useQuery({
    queryKey: ['customer-analytics'],
    queryFn: () => analyticsApi.getCustomerAnalytics(),
  });

  const metrics = metricsData?.data?.data;
  const trend = (trendData?.data?.data?.trend || []) as Array<Record<string, unknown>>;
  const bySegment = (customerData?.data?.data?.bySegment || []) as Array<Record<string, unknown>>;

  // Aggregate trend by period
  const chartData = trend.reduce((acc: Record<string, unknown>[], item) => {
    const id = item._id as Record<string, unknown>;
    const key = `Q${id.quarter} '${String(id.year).slice(2)}`;
    const existing = acc.find((a) => a.period === key);
    if (existing) {
      (existing.revenue as number) += item.revenue as number;
    } else {
      acc.push({ period: key, revenue: item.revenue as number, deals: item.deals as number });
    }
    return acc;
  }, []).slice(-6);

  const activeCount = metrics?.customers?.find((c: any) => c._id === 'active')?.count || 0;
  const avgLtv = metrics?.customers?.find((c: any) => c._id === 'active')?.avgLTV || 0;

  const isDataEmpty =
    !metricsLoading &&
    !trendLoading &&
    !customerLoading &&
    (!metrics || (!metrics.revenue?.current && activeCount === 0 && avgLtv === 0)) &&
    chartData.length === 0;

  const handleAskAI = (question: string) => {
    navigate(`/chat?q=${encodeURIComponent(question)}`);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-[calc(100vh-4rem)] flex flex-col justify-between">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-foreground">Business Intelligence</h1>
          <p className="text-xs text-muted-foreground">Strategic KPIs, revenue trends, and customer segments</p>
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

      {isDataEmpty ? (
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
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 animate-fade-in">
            {metricsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="glass rounded-2xl p-6 h-28 bg-secondary/25 animate-pulse" />
              ))
            ) : (
              <>
                <div className="glass rounded-2xl p-6 card-glow hover:glass-hover transition-all duration-300">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <span className="text-xs text-muted-foreground uppercase font-semibold">Total Revenue (This Q)</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    ${metrics?.revenue?.current ? (metrics.revenue.current / 1000).toFixed(0) : '0'}K
                  </p>
                </div>

                <div className="glass rounded-2xl p-6 card-glow hover:glass-hover transition-all duration-300">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                      <Users className="w-5 h-5" />
                    </div>
                    <span className="text-xs text-muted-foreground uppercase font-semibold">Active Customers</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{activeCount}</p>
                </div>

                <div className="glass rounded-2xl p-6 card-glow hover:glass-hover transition-all duration-300">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <span className="text-xs text-muted-foreground uppercase font-semibold">Average Customer LTV</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    ${avgLtv ? avgLtv.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Main Charts Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
            {/* Revenue Performance Trend */}
            <div className="glass rounded-2xl p-6 card-glow animate-fade-in">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-semibold text-foreground text-sm uppercase tracking-wider">Revenue Performance</h2>
                  <p className="text-xs text-muted-foreground">Historical quarterly sales indicators</p>
                </div>
                <button
                  onClick={() => handleAskAI('Perform a sales trend analysis for the last 4 quarters')}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  Analyze with AI <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
              {trendLoading ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="period" tick={{ fill: '#6b7280', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={(v) => `$${v / 1000}K`} />
                    <Tooltip contentStyle={{ background: 'hsl(222,47%,9%)', border: '1px solid hsl(222,47%,15%)', borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Customer Segments */}
            <div className="glass rounded-2xl p-6 card-glow animate-fade-in">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-semibold text-foreground text-sm uppercase tracking-wider">Customer Segments</h2>
                  <p className="text-xs text-muted-foreground">Customer distribution by demographic segment</p>
                </div>
                <button
                  onClick={() => handleAskAI('Show customer segment breakdown and suggest targeted campaigns')}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  Analyze with AI <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
              {customerLoading ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={bySegment}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="_id" tick={{ fill: '#6b7280', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: 'hsl(222,47%,9%)', border: '1px solid hsl(222,47%,15%)', borderRadius: '8px' }} />
                    <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Suggested Follow-Ups */}
          <div className="glass rounded-2xl p-6 card-glow animate-fade-in">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" /> Suggested Business Intelligence Inquiries
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                'What is the average lifetime value (LTV) of enterprise customers compared to SMBs?',
                'Generate a forecast of sales revenue for the next two quarters.',
                'Which customer segments have the highest risk of churn?',
                'What operational bottlenecks are affecting our current deal cycle time?',
              ].map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAskAI(suggestion)}
                  className="text-left p-3.5 rounded-xl bg-secondary/30 border border-border/50 hover:bg-secondary/70 hover:border-border transition-all text-xs text-foreground/80 flex items-center justify-between group"
                >
                  <span>{suggestion}</span>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all flex-shrink-0 ml-4" />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
