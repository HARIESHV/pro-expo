import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { queriesApi, QueryHistoryDetails } from '../../api/queries';
import { History, Brain, Trash2, Clock, Cpu, Eye, Loader2, ArrowRight, CornerDownRight, FileText } from 'lucide-react';
import { cn } from '../../utils/cn';

export default function QueryHistoryPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState('');

  // Queries
  const { data: listData, isLoading: isListLoading } = useQuery({
    queryKey: ['queries-history', agentFilter],
    queryFn: () => queriesApi.getQueries({ agent: agentFilter }),
  });

  const queries = listData?.data?.data?.queries || [];

  const { data: detailData, isLoading: isDetailLoading } = useQuery({
    queryKey: ['query-detail', selectedQueryId],
    queryFn: () => queriesApi.getQuery(selectedQueryId!),
    enabled: !!selectedQueryId,
  });

  const activeQuery = detailData?.data?.data?.query;

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: (id: string) => queriesApi.deleteQuery(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['queries-history'] });
      if (selectedQueryId === deletedId) {
        setSelectedQueryId(null);
      }
    },
  });

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-[calc(100vh-4rem)] flex flex-col xl:flex-row gap-6">
      
      {/* Left panel: List and filters */}
      <div className="w-full xl:w-96 flex-shrink-0 space-y-4 flex flex-col">
        {/* Filters */}
        <div className="glass rounded-2xl p-4 card-glow flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-semibold text-foreground">Filters</span>
          </div>
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none"
          >
            <option value="">All Agents</option>
            {['executive', 'rag', 'sales', 'analytics', 'decision', 'knowledge'].map((a) => (
              <option key={a} value={a}>{a.toUpperCase()}</option>
            ))}
          </select>
        </div>

        {/* Queries History List */}
        <div className="glass rounded-2xl p-6 card-glow flex-grow flex flex-col min-h-[400px]">
          <h2 className="text-base font-bold text-foreground mb-4">Query History Logs</h2>
          
          {isListLoading ? (
            <div className="flex items-center justify-center flex-grow">
              <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
            </div>
          ) : queries.length === 0 ? (
            <div className="text-center py-20 flex-grow flex flex-col justify-center">
              <History className="w-10 h-10 text-muted-foreground opacity-30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Your query history is currently empty.</p>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-[500px] flex-grow pr-1">
              {queries.map((q) => (
                <div
                  key={q._id}
                  className={cn(
                    'p-3 rounded-xl border transition-all text-left flex items-start gap-2 relative group',
                    selectedQueryId === q._id
                      ? 'bg-orange-100 border-orange-300 text-orange-600'
                      : 'bg-secondary/40 border-border/50 hover:bg-secondary/70 text-muted-foreground'
                  )}
                >
                  <button
                    onClick={() => setSelectedQueryId(q._id)}
                    className="flex-grow min-w-0 text-left"
                  >
                    <p className="font-semibold text-foreground truncate text-xs">{q.originalQuery}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-[9px] text-muted-foreground/80">
                      <span className="capitalize px-1 rounded bg-secondary border border-border">{q.status}</span>
                      <span>·</span>
                      <span>{new Date(q.createdAt).toLocaleDateString()}</span>
                    </div>
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(q._id)}
                    disabled={deleteMutation.isPending}
                    className="text-muted-foreground/40 hover:text-destructive transition-colors ml-auto flex-shrink-0"
                    title="Delete query log"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right panel: Active Query Detail */}
      <div className="flex-grow flex flex-col justify-start">
        {selectedQueryId ? (
          isDetailLoading ? (
            <div className="flex items-center justify-center flex-grow py-40">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            </div>
          ) : activeQuery ? (
            <div className="glass rounded-2xl p-8 card-glow space-y-6 flex-grow animate-fade-in">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/50 pb-6">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Query Execution Details</h3>
                  <p className="text-xs text-muted-foreground mt-1">Logged on {new Date(activeQuery.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => navigate(`/chat?q=${encodeURIComponent(activeQuery.originalQuery || '')}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-orange-300 bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-lg font-semibold transition-all"
                  >
                    <CornerDownRight className="w-3.5 h-3.5" /> Reopen in Chat
                  </button>
                  <button
                    onClick={() => navigate('/reports', { state: { searchQuery: activeQuery.originalQuery, entities: [], kgRelationships: [], matchingDocuments: [] } })}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:bg-secondary rounded-lg text-xs font-semibold transition-all text-muted-foreground hover:text-foreground"
                  >
                    <FileText className="w-3.5 h-3.5" /> Generate Report
                  </button>
                  {activeQuery.executionTimeMs && (
                    <span className="flex items-center gap-1 px-2.5 py-1 bg-secondary rounded-lg border border-border text-muted-foreground">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      {activeQuery.executionTimeMs} ms
                    </span>
                  )}
                </div>
              </div>

              {/* Original query */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Question</span>
                <p className="text-foreground font-semibold text-sm bg-secondary/30 p-4 rounded-xl border border-border/50">
                  {activeQuery.originalQuery}
                </p>
              </div>

              {/* AI Answer / Result */}
              {activeQuery.status === 'completed' && activeQuery.result && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider block flex items-center gap-1">
                      <Cpu className="w-3.5 h-3.5" /> AI Response
                    </span>
                    <div className="text-foreground/90 text-sm leading-relaxed whitespace-pre-wrap p-4 bg-orange-50 border border-orange-200 rounded-xl">
                      {activeQuery.result.answer || activeQuery.result.summary || 'No answer payload returned.'}
                    </div>
                  </div>

                  {activeQuery.result.recommendations && activeQuery.result.recommendations.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Recommendations</span>
                      <ul className="space-y-1.5 text-xs text-foreground/80">
                        {activeQuery.result.recommendations.map((rec, idx) => (
                          <li key={idx} className="flex gap-2 bg-secondary/20 p-2.5 rounded-lg border border-border/30">
                            <CornerDownRight className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {activeQuery.agentsUsed && activeQuery.agentsUsed.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground font-semibold">Orchestration Agents:</span>
                      <div className="flex gap-1.5">
                        {activeQuery.agentsUsed.map((agent) => (
                          <span key={agent} className="text-[9px] font-bold px-2 py-0.5 rounded bg-orange-100 border border-orange-200 text-orange-600 capitalize font-mono">
                            {agent}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Status errors */}
              {activeQuery.status === 'failed' && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-xs">
                  <p className="font-semibold mb-1">Execution Failure Trace</p>
                  <p>{activeQuery.errorMessage || 'Unknown system error occurred during execution.'}</p>
                </div>
              )}
            </div>
          ) : null
        ) : (
          /* Empty Active state */
          <div className="glass rounded-2xl p-10 card-glow flex flex-col items-center justify-center text-center flex-grow py-40 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-orange-100 border border-orange-200 flex items-center justify-center mb-6">
              <History className="w-8 h-8 text-orange-500" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">No Query Log Selected</h2>
            <p className="text-muted-foreground max-w-md mb-6">
              Select a previous AI request or database search log from history list on the left to inspect its execution timeline.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
