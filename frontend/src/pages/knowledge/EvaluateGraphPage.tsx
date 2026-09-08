import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { Heart, Activity, CheckCircle, RefreshCw, AlertTriangle, ShieldCheck, Database, Layers, ShieldAlert, Loader2, FileText } from 'lucide-react';
import { cn } from '../../utils/cn';

interface GraphIssue {
  id: string;
  type: string;
  entity: string;
  explanation: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendedFix: string;
}

interface EvaluationResult {
  healthScore: number;
  entityQuality: number;
  relationshipQuality: number;
  sourceCoverage: number;
  duplicateCount: number;
  disconnectedCount: number;
  lowConfidenceCount: number;
  issues: GraphIssue[];
}

export default function EvaluateGraphPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: evalData, isLoading, refetch, isRefetching, isError, error } = useQuery({
    queryKey: ['graph-evaluation'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: EvaluationResult }>('/knowledge-graph/evaluate');
      return res.data.data;
    },
  });

  const handleRecalculate = () => {
    refetch();
  };

  const results = evalData;

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center justify-center p-8">
        <div className="max-w-md w-full glass rounded-2xl p-8 text-center space-y-5 border-destructive/20 bg-destructive/5 text-destructive animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7 text-destructive" />
          </div>
          <div>
            <h2 className="text-xl font-bold mb-2">Evaluation Failed</h2>
            <p className="text-destructive/80 text-sm leading-relaxed">
              {(error as any)?.response?.data?.message || error.message || 'Unable to perform graph evaluation.'}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-destructive hover:bg-destructive/90 text-white text-sm font-semibold mx-auto transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-[calc(100vh-4rem)] space-y-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-foreground">Graph Integrity Evaluation</h1>
          <p className="text-xs text-muted-foreground">Analyze entity extraction confidence, duplicates, and health score</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/reports', { state: { dashboardType: 'Evaluate Graph', filters: {}, metrics: {} } })}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <FileText className="w-3.5 h-3.5" /> Generate Graph Evaluation Report
          </button>
          <button
            onClick={handleRecalculate}
            disabled={isRefetching}
            className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-1.5 border border-border text-xs font-medium text-foreground transition-colors hover:text-primary disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isRefetching && 'animate-spin')} />
            {isRefetching ? 'Recalculating...' : 'Recalculate Evaluation'}
          </button>
        </div>
      </div>

      {results && (
        <>
          {/* Health Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in">
            {/* Health Score */}
            <div className="glass rounded-2xl p-6 card-glow bg-gradient-to-b from-primary/5 to-transparent">
              <div className="flex items-center justify-between mb-3">
                <Heart className="w-5 h-5 text-red-400" />
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Health Score</span>
              </div>
              <p className="text-3xl font-bold text-foreground font-mono">{results.healthScore}%</p>
              <div className="w-full bg-secondary h-1.5 rounded-full mt-3 overflow-hidden">
                <div 
                  className={cn(
                    'h-full rounded-full', 
                    results.healthScore > 80 ? 'bg-green-400' : results.healthScore > 50 ? 'bg-amber-400' : 'bg-red-400'
                  )} 
                  style={{ width: `${results.healthScore}%` }}
                />
              </div>
            </div>

            {/* Entity Quality */}
            <div className="glass rounded-2xl p-6 card-glow">
              <div className="flex items-center justify-between mb-3">
                <ShieldCheck className="w-5 h-5 text-primary" />
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Entity Quality</span>
              </div>
              <p className="text-3xl font-bold text-foreground font-mono">{results.entityQuality}%</p>
              <p className="text-xs text-muted-foreground mt-2">Avg extraction confidence</p>
            </div>

            {/* Relationship Quality */}
            <div className="glass rounded-2xl p-6 card-glow">
              <div className="flex items-center justify-between mb-3">
                <Layers className="w-5 h-5 text-cyan-400" />
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Relation Quality</span>
              </div>
              <p className="text-3xl font-bold text-foreground font-mono">{results.relationshipQuality}%</p>
              <p className="text-xs text-muted-foreground mt-2">Avg connection confidence</p>
            </div>

            {/* Source Coverage */}
            <div className="glass rounded-2xl p-6 card-glow">
              <div className="flex items-center justify-between mb-3">
                <Database className="w-5 h-5 text-emerald-400" />
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Source Coverage</span>
              </div>
              <p className="text-3xl font-bold text-foreground font-mono">{results.sourceCoverage}%</p>
              <p className="text-xs text-muted-foreground mt-2">Node documentation link ratio</p>
            </div>
          </div>

          {/* Counts metrics */}
          <div className="grid grid-cols-3 gap-4 animate-fade-in text-center">
            <div className="glass rounded-xl p-4 bg-secondary/20">
              <span className="text-xs text-muted-foreground">Disconnected Nodes</span>
              <p className="text-lg font-bold text-foreground mt-1 font-mono">{results.disconnectedCount}</p>
            </div>
            <div className="glass rounded-xl p-4 bg-secondary/20">
              <span className="text-xs text-muted-foreground">Potential Duplicates</span>
              <p className="text-lg font-bold text-foreground mt-1 font-mono">{results.duplicateCount}</p>
            </div>
            <div className="glass rounded-xl p-4 bg-secondary/20">
              <span className="text-xs text-muted-foreground">Low Confidence Items</span>
              <p className="text-lg font-bold text-foreground mt-1 font-mono">{results.lowConfidenceCount}</p>
            </div>
          </div>

          {/* Issues list */}
          <div className="glass rounded-2xl p-6 card-glow space-y-4 animate-fade-in">
            <h3 className="text-base font-bold text-foreground">Detected Integrity Issues</h3>
            
            {results.issues.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm flex items-center justify-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span>No integrity issues detected. Your knowledge graph is clean and healthy!</span>
              </div>
            ) : (
              <div className="space-y-3">
                {results.issues.map((issue) => (
                  <div 
                    key={issue.id} 
                    className="p-4 rounded-xl bg-secondary/30 border border-border/50 flex flex-col md:flex-row md:items-start justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          'text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider',
                          issue.severity === 'critical' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                          issue.severity === 'high' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                          issue.severity === 'medium' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          'bg-green-500/10 text-green-400 border border-green-500/20'
                        )}>
                          {issue.severity}
                        </span>
                        <span className="text-xs font-semibold text-foreground capitalize font-mono">
                          {issue.type.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-muted-foreground font-bold">·</span>
                        <span className="text-xs text-primary font-bold">{issue.entity}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{issue.explanation}</p>
                    </div>

                    <div className="md:text-right shrink-0 md:max-w-xs space-y-1 bg-secondary/50 p-2.5 rounded-lg border border-border/50 text-[11px] text-foreground/80">
                      <p className="font-semibold text-primary">Recommended Fix</p>
                      <p className="text-muted-foreground leading-snug">{issue.recommendedFix}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
