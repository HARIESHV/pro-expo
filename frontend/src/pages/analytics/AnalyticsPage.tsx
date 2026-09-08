import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { analyticsApi } from '../../api/analytics';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { BarChart2, TrendingUp, Users, Globe, Loader2, FileText } from 'lucide-react';

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: ['sales-trend'],
    queryFn: () => analyticsApi.getSalesTrend(),
  });
  const { data: customerData, isLoading: customerLoading } = useQuery({
    queryKey: ['customer-analytics'],
    queryFn: () => analyticsApi.getCustomerAnalytics(),
  });

  const trendRaw = trendData?.data?.data?.trend || [];
  const byRegionRaw = customerData?.data?.data?.byRegion || [];
  const bySegmentRaw = customerData?.data?.data?.bySegment || [];

  const isTrendEmpty = trendRaw.length === 0;
  const isRegionEmpty = byRegionRaw.length === 0;
  const isSegmentEmpty = bySegmentRaw.length === 0;

  // 1. Fallback / Seed Trend Data
  const trend = !isTrendEmpty ? trendRaw : [
    { _id: { quarter: 1, year: 2026 }, revenue: 1200000, deals: 45 },
    { _id: { quarter: 2, year: 2026 }, revenue: 1500000, deals: 52 },
    { _id: { quarter: 3, year: 2026 }, revenue: 1800000, deals: 65 },
    { _id: { quarter: 4, year: 2026 }, revenue: 2100000, deals: 78 }
  ];

  // 2. Fallback / Seed Region Data
  const byRegion = !isRegionEmpty ? byRegionRaw : [
    { _id: 'North America', count: 120 },
    { _id: 'Europe', count: 95 },
    { _id: 'Asia', count: 70 },
    { _id: 'Middle East', count: 40 },
    { _id: 'Other', count: 25 }
  ];

  // 3. Fallback / Seed Segment Data
  const bySegment = !isSegmentEmpty ? bySegmentRaw : [
    { _id: 'Enterprise', count: 45 },
    { _id: 'Mid-Market', count: 85 },
    { _id: 'SMB', count: 220 }
  ];

  // Aggregate trend by period
  const chartData = trend.reduce((acc: Record<string, unknown>[], item: any) => {
    const id = item._id;
    const key = `Q${id.quarter} '${String(id.year).slice(2)}`;
    const existing = acc.find((a) => a.period === key);
    if (existing) {
      (existing.revenue as number) += item.revenue;
      (existing.deals as number) += item.deals;
    } else {
      acc.push({ period: key, revenue: item.revenue, deals: item.deals });
    }
    return acc;
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-foreground">Analytics</h1>
          <p className="text-xs text-muted-foreground">Business intelligence and performance analytics</p>
        </div>
        <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/reports', { state: { dashboardType: 'Analytics', filters: {}, metrics: {} } })}
          className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <FileText className="w-3.5 h-3.5" /> Generate Analytics Report
        </button>
      </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* Revenue by Quarter */}
        <div className="glass rounded-2xl p-6 card-glow animate-fade-in flex flex-col justify-between min-h-[350px]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-foreground text-sm">Revenue by Quarter</h2>
            </div>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider font-mono ${
              isTrendEmpty ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}>
              {isTrendEmpty ? 'Demo Data' : 'Live DB'}
            </span>
          </div>
          {trendLoading ? (
            <div className="flex items-center justify-center flex-grow">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="period" tick={{ fill: '#6b7280', fontSize: 10 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  contentStyle={{ background: 'hsl(222,47%,9%)', border: '1px solid hsl(222,47%,15%)', borderRadius: '12px' }}
                  formatter={(v: number) => [`$${v.toLocaleString()}`, 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Deals by Quarter */}
        <div className="glass rounded-2xl p-6 card-glow animate-fade-in flex flex-col justify-between min-h-[350px]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-violet-400" />
              <h2 className="font-semibold text-foreground text-sm">Deals Closed by Quarter</h2>
            </div>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider font-mono ${
              isTrendEmpty ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}>
              {isTrendEmpty ? 'Demo Data' : 'Live DB'}
            </span>
          </div>
          {trendLoading ? (
            <div className="flex items-center justify-center flex-grow">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="period" tick={{ fill: '#6b7280', fontSize: 10 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: 'hsl(222,47%,9%)', border: '1px solid hsl(222,47%,15%)', borderRadius: '12px' }} />
                <Line type="monotone" dataKey="deals" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Customers by Region */}
        <div className="glass rounded-2xl p-6 card-glow animate-fade-in flex flex-col justify-between min-h-[350px]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-cyan-400" />
              <h2 className="font-semibold text-foreground text-sm">Customers by Region</h2>
            </div>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider font-mono ${
              isRegionEmpty ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}>
              {isRegionEmpty ? 'Demo Data' : 'Live DB'}
            </span>
          </div>
          {customerLoading ? (
            <div className="flex items-center justify-center flex-grow">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byRegion} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} />
                <YAxis dataKey="_id" type="category" tick={{ fill: '#9ca3af', fontSize: 10 }} width={90} />
                <Tooltip contentStyle={{ background: 'hsl(222,47%,9%)', border: '1px solid hsl(222,47%,15%)', borderRadius: '12px' }} />
                <Bar dataKey="count" fill="#06b6d4" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Customers by Segment */}
        <div className="glass rounded-2xl p-6 card-glow animate-fade-in flex flex-col justify-between min-h-[350px]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-green-400" />
              <h2 className="font-semibold text-foreground text-sm">Customers by Segment</h2>
            </div>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider font-mono ${
              isSegmentEmpty ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}>
              {isSegmentEmpty ? 'Demo Data' : 'Live DB'}
            </span>
          </div>
          {customerLoading ? (
            <div className="flex items-center justify-center flex-grow">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={bySegment}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="_id" tick={{ fill: '#6b7280', fontSize: 10 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: 'hsl(222,47%,9%)', border: '1px solid hsl(222,47%,15%)', borderRadius: '12px' }} />
                <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
