import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, BarChart3, LineChart as LineChartIcon, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { Badge } from '../../../components/ui/badge';
import { EmptyState, Skeleton } from '../../../components/ui/states';
import { DecisionForecast, DecisionTrendPoint } from '../api';

const TOOLTIP_STYLE = {
  background: 'hsl(222,47%,9%)',
  border: '1px solid hsl(222,47%,15%)',
  borderRadius: '8px',
  fontSize: '12px',
} as const;

export function TrendChartSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}

export function TrendChart({ points, loading, isError }: { points: DecisionTrendPoint[]; loading: boolean; isError: boolean }) {
  if (loading) return <TrendChartSkeleton />;
  if (isError) {
    return (
      <div className="flex h-44 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-center">
        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Trend data could not be loaded.</p>
      </div>
    );
  }
  if (points.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 className="h-4 w-4" />}
        title="No trend data"
        description="Ingest sales records to see revenue trend analysis here."
        className="min-h-[160px]"
      />
    );
  }
  return (
    <ResponsiveContainer width="100%" height={190}>
      <LineChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} />
        <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={(v: number) => `$${Math.round(v / 1000)}K`} width={46} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Revenue']} />
        <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} dot={{ fill: '#10b981', r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ForecastPanel({ forecast }: { forecast?: DecisionForecast }) {
  if (!forecast || forecast.points.length === 0) {
    return (
      <EmptyState
        icon={<LineChartIcon className="h-4 w-4" />}
        title="No forecast available"
        description="A forecast needs at least two months of revenue history."
        className="min-h-[160px]"
      />
    );
  }

  const direction = forecast.direction;
  const DirectionIcon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : BarChart3;
  const tone =
    direction === 'up' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : direction === 'down' ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-muted-foreground bg-secondary border-border';
  const directionLabel = direction === 'up' ? 'Projected up' : direction === 'down' ? 'Projected down' : 'Stable';

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className={cn('flex h-6 w-6 items-center justify-center rounded-md border', tone)}>
          <DirectionIcon className="h-3.5 w-3.5" />
        </div>
        <Badge variant="outline">{directionLabel}</Badge>
        <p className="text-[11px] text-muted-foreground">
          Next {forecast.points.length} month{forecast.points.length === 1 ? '' : 's'}
        </p>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={forecast.points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} />
          <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={(v: number) => `$${Math.round(v / 1000)}K`} width={46} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Projected revenue']} />
          <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">{forecast.note}</p>
    </div>
  );
}