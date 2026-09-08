import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { knowledgeGraphApi } from '../../api/knowledgeGraph';
import { GraphData, KnowledgeGraphEdge, KnowledgeGraphNode } from '../../types';
import {
  Network,
  Search,
  Loader2,
  ChevronDown,
  X,
  BarChart3,
  ArrowUpRight,
  Inbox,
  Database,
  Check,
  Gauge,
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '../../components/ui/button';
import { cn } from '../../utils/cn';
import { GraphCanvas, NODE_COLORS, edgeLabel } from './GraphCanvas';

const ENTITY_ORDER = [
  'customer',
  'employee',
  'product',
  'project',
  'department',
  'organization',
  'region',
  'document',
  'decision',
  'risk',
  'insight',
  'query',
  'conversation',
  'topic',
  'concept',
  'event',
  'metric',
];

const SOURCE_ORDER = ['knowledge', 'document', 'database', 'chat', 'decision', 'universal_search'];
const SOURCE_LABELS: Record<string, string> = {
  knowledge: 'Knowledge base',
  document: 'Documents',
  database: 'Enterprise records',
  chat: 'Chat & conversations',
  decision: 'Decision intelligence',
  universal_search: 'Universal search',
};

const DEFAULT_LIMIT = 800;

const SKIP_PROPS = new Set(['id', '_id', '__v', 'createdAt', 'updatedAt', 'embedding', 'vector', 'intent', 'agents']);

function typeLabel(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function sourceLabel(s: string | undefined): string | null {
  if (!s) return null;
  return SOURCE_LABELS[s] || s.replace(/_/g, ' ');
}

function plural(t: string): string {
  if (t === 'query') return 'queries';
  if (t.endsWith('s')) return `${t}es`;
  return `${t}s`;
}

function formatProp(v: unknown): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'object') {
    if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? '' : 's'}`;
    const s = JSON.stringify(v);
    return s && s.length > 40 ? `${s.slice(0, 38)}…` : (s || '—');
  }
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2);
  const s = String(v);
  return s.length > 40 ? `${s.slice(0, 38)}…` : s;
}

export default function KnowledgeGraphPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const entityParam = searchParams.get('entity');
  const { theme } = useTheme();
  const [entityTypes, setEntityTypes] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<KnowledgeGraphEdge | null>(null);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<KnowledgeGraphNode[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [searchFocus, setSearchFocus] = useState(false);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [minConfidence, setMinConfidence] = useState(0);
  const [sources, setSources] = useState<Set<string>>(new Set());
  const [sourceOpen, setSourceOpen] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typeRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['knowledge-graph', entityTypes, minConfidence, sources.size, limit],
    queryFn: () =>
      knowledgeGraphApi.getGraph({
        types: entityTypes || undefined,
        sources: sources.size ? Array.from(sources).join(',') : undefined,
        minConfidence: minConfidence > 0 ? minConfidence : undefined,
        limit,
      }),
  });

  const graphData: GraphData = data?.data?.data || { nodes: [], edges: [] };
  const totalNodes = data?.data?.data?.totalNodes ?? graphData.nodes.length;
  const totalEdges = data?.data?.data?.totalEdges ?? graphData.edges.length;
  const truncated = totalNodes > graphData.nodes.length;

  // Progressive expansion: neighbor nodes pulled in when an entity is selected,
  // merged on top of the base graph so truncation never hides nearby context.
  const [extra, setExtra] = useState<GraphData>({ nodes: [], edges: [] });
  const displayData = useMemo(() => {
    if (extra.nodes.length === 0 && extra.edges.length === 0) return graphData;
    const nodesMap = new Map(graphData.nodes.map((n) => [n.id, n]));
    const edgesMap = new Map(graphData.edges.map((e) => [e.id, e]));
    for (const n of extra.nodes) if (!nodesMap.has(n.id)) nodesMap.set(n.id, n);
    for (const e of extra.edges) if (!edgesMap.has(e.id)) edgesMap.set(e.id, e);
    return { nodes: Array.from(nodesMap.values()), edges: Array.from(edgesMap.values()) };
  }, [graphData, extra]);

  const nodesById = useMemo(() => {
    const m = new Map<string, KnowledgeGraphNode>();
    for (const n of displayData.nodes) m.set(n.id, n);
    return m;
  }, [displayData]);

  const selectedNode = selectedId ? nodesById.get(selectedId) ?? null : null;

  // Support navigation from Universal Search: /knowledge-graph?entity=<id>
  useEffect(() => {
    if (!entityParam) return;
    const id = decodeURIComponent(entityParam);
    if (nodesById.size === 0 && graphData.nodes.length === 0) return;
    if (nodesById.get(id)) {
      setSelectedEdge(null);
      setSelectedId(id);
    }
  }, [entityParam, graphData.nodes, nodesById, isLoading]);

  const selFrom = selectedEdge ? nodesById.get(selectedEdge.from) ?? null : null;
  const selTo = selectedEdge ? nodesById.get(selectedEdge.to) ?? null : null;

  const handleSelectNode = useCallback((id: string | null) => {
    setSelectedEdge(null);
    setSelectedId(id);
  }, []);

  const handleSelectEdge = useCallback((edge: KnowledgeGraphEdge | null) => {
    setSelectedEdge(edge);
    if (edge) setSelectedId(null);
  }, []);

  const related = useMemo(() => {
    if (!selectedId) return [];
    const seen = new Set<string>();
    const out: Array<{ id: string; name: string; type: string; label: string }> = [];
    for (const e of displayData.edges) {
      let other: string | null = null;
      let label = e.label || e.type || '';
      if (e.from === selectedId && !seen.has(e.to)) { other = e.to; }
      else if (e.to === selectedId && !seen.has(e.from)) { other = e.from; }
      if (!other) continue;
      const n = nodesById.get(other);
      if (!n) continue;
      seen.add(other);
      out.push({ id: other, name: n.name, type: n.type, label });
    }
    return out;
  }, [selectedId, displayData, nodesById]);

  const relationshipCount = useMemo(() => {
    if (!selectedId) return 0;
    return displayData.edges.filter((e) => e.from === selectedId || e.to === selectedId).length;
  }, [selectedId, displayData]);

  const metadata = useMemo(() => {
    if (!selectedNode) return [];
    return Object.entries(selectedNode.properties || {})
      .filter(([k, v]) => !SKIP_PROPS.has(k) && v != null)
      .slice(0, 6);
  }, [selectedNode]);

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!search.trim()) {
      setSearchResults(null);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await knowledgeGraphApi.searchEntities(search.trim());
        setSearchResults(res.data?.data?.entities || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search]);

  // Progressive expansion of the selected entity's neighbours: only useful when
  // the base graph was truncated by the limit, otherwise everything is already
  // loaded. Rebuilds are server-side cached per request and deduped on merge.
  const expandedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedId || !truncated) return;
    if (expandedRef.current === selectedId) return;
    expandedRef.current = selectedId;
    let cancelled = false;
    knowledgeGraphApi
      .getEntityNeighbors(selectedId)
      .then((res) => {
        if (cancelled) return;
        const nd = res.data?.data;
        if (nd && nd.nodes.length) setExtra(nd);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedId, truncated]);

  // Clear progressive expansions whenever the base filters change
  useEffect(() => {
    setExtra({ nodes: [], edges: [] });
    expandedRef.current = null;
  }, [entityTypes, minConfidence, sources, limit]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (typeRef.current && !typeRef.current.contains(e.target as Node)) setTypeOpen(false);
      if (sourceRef.current && !sourceRef.current.contains(e.target as Node)) setSourceOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const toggleSource = (s: string) => {
    setSources((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const pickSearchResult = (id: string) => {
    handleSelectNode(id);
    setSearch('');
    setSearchResults(null);
  };

  const report = () =>
    navigate('/reports', {
      state: {
        dashboardType: 'Knowledge Graph',
        filters: {
          entityTypes: entityTypes || undefined,
          sources: sources.size ? Array.from(sources) : undefined,
          minConfidence: minConfidence > 0 ? minConfidence : undefined,
          totalNodes,
          totalEdges,
        },
        metrics: {
          nodes: totalNodes,
          edges: totalEdges,
        },
      },
    });

  return (
    <div className="flex h-[calc(100dvh-3rem)] min-h-[540px] flex-col gap-3 p-3 sm:gap-4 sm:p-4 lg:p-5">
      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl gradient-brand-soft text-primary shadow-glow-sm">
            <Network className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[17px] font-semibold leading-tight tracking-tight text-foreground">
              Knowledge Graph
            </h1>
            <p className="hidden text-[12.5px] text-muted-foreground sm:block">
              Explore relationships between entities in your organization
            </p>
          </div>
        </div>
        <Button onClick={report} className="shrink-0">
          <BarChart3 className="h-4 w-4" />
          <span className="hidden sm:inline">Knowledge Graph Report</span>
          <span className="sm:hidden">Report</span>
        </Button>
      </div>

      {/* Search + filter + stats */}
      <div className="flex shrink-0 flex-wrap items-center gap-2.5">
        <div
          className={cn(
            'group relative flex min-w-0 flex-1 basis-56 items-center rounded-xl border bg-card/50 backdrop-blur transition-all duration-200 sm:max-w-xs',
            searchFocus
              ? 'border-primary/40 shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]'
              : 'border-border hover:border-primary/25'
          )}
        >
          <Search className="ml-3 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocus(true)}
            onBlur={() => {
              setSearchFocus(false);
              setTimeout(() => setSearchResults(null), 160);
            }}
            placeholder="Search entities..."
            className="h-9 w-full bg-transparent px-2.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {searchLoading && <Loader2 className="mr-2.5 h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
          {!searchLoading && search && (
            <button onClick={() => { setSearch(''); setSearchResults(null); }} aria-label="Clear search" className="mr-2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {searchResults !== null && search.trim() && (
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-xl border border-border bg-popover/95 shadow-pop backdrop-blur-xl">
              {searchResults.length === 0 ? (
                <p className="px-3.5 py-3 text-xs text-muted-foreground">No entities match “{search}”.</p>
              ) : (
                <ul className="max-h-64 overflow-y-auto py-1">
                  {searchResults.slice(0, 12).map((n) => {
                    const c = NODE_COLORS[n.type] || '#6b7280';
                    return (
                      <li key={n.id}>
                        <button
                          onClick={() => pickSearchResult(n.id)}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-secondary"
                        >
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c, boxShadow: `0 0 8px ${c}66` }} />
                          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{n.name}</span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{typeLabel(n.type)}</span>
                          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        <div ref={typeRef} className="relative">
          <button
            onClick={() => setTypeOpen((v) => !v)}
            className={cn(
              'flex h-9 items-center gap-2 rounded-xl border bg-card/50 px-3 text-[13px] font-medium text-foreground backdrop-blur transition-all duration-150',
              typeOpen ? 'border-primary/40' : 'border-border hover:border-primary/25'
            )}
          >
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                entityTypes ? 'shadow-[0_0_6px]' : 'bg-muted-foreground'
              )}
              style={entityTypes ? { background: NODE_COLORS[entityTypes] || '#6b7280', color: NODE_COLORS[entityTypes] || '#6b7280' } : undefined}
            />
            {entityTypes ? typeLabel(entityTypes) : 'All entity types'}
            <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform duration-150', typeOpen && 'rotate-180')} />
          </button>

          {typeOpen && (
            <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-52 overflow-hidden rounded-xl border border-border bg-popover/95 shadow-pop backdrop-blur-xl">
              <ul className="max-h-72 overflow-y-auto py-1">
                <li>
                  <button
                    onClick={() => { setEntityTypes(''); setTypeOpen(false); }}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors hover:bg-secondary',
                      entityTypes === '' ? 'text-primary' : 'text-foreground'
                    )}
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-primary to-accent" />
                    All entity types
                  </button>
                </li>
                {ENTITY_ORDER.map((t) => (
                  <li key={t}>
                    <button
                      onClick={() => { setEntityTypes(t); setTypeOpen(false); }}
                      className={cn(
                        'flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] capitalize transition-colors hover:bg-secondary',
                        entityTypes === t ? 'text-primary' : 'text-foreground'
                      )}
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: NODE_COLORS[t] || '#6b7280' }} />
                      {plural(t)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div ref={sourceRef} className="relative">
          <button
            onClick={() => setSourceOpen((v) => !v)}
            title="Filter by data source"
            className={cn(
              'flex h-9 items-center gap-2 rounded-xl border bg-card/50 px-3 text-[13px] font-medium text-foreground backdrop-blur transition-all duration-150',
              sourceOpen || sources.size ? 'border-primary/40' : 'border-border hover:border-primary/25'
            )}
          >
            <Database className="h-4 w-4 text-muted-foreground" />
            <span>{sources.size ? `${sources.size} source${sources.size > 1 ? 's' : ''}` : 'All sources'}</span>
            <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform duration-150', sourceOpen && 'rotate-180')} />
          </button>

          {sourceOpen && (
            <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-60 overflow-hidden rounded-xl border border-border bg-popover/95 shadow-pop backdrop-blur-xl">
              <ul className="max-h-72 overflow-y-auto py-1">
                {SOURCE_ORDER.map((s) => {
                  const on = sources.has(s);
                  return (
                    <li key={s}>
                      <button
                        onClick={() => toggleSource(s)}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors hover:bg-secondary"
                      >
                        <span
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                            on ? 'border-primary bg-primary text-white' : 'border-border'
                          )}
                        >
                          {on && <Check className="h-3 w-3" />}
                        </span>
                        <span className={on ? 'text-foreground' : 'text-muted-foreground'}>{SOURCE_LABELS[s]}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <div title="Minimum confidence" className="flex h-9 shrink-0 items-center gap-2 rounded-xl border border-border bg-card/50 px-3 backdrop-blur">
          <Gauge className="h-4 w-4 text-muted-foreground" />
          <label className="hidden text-[12px] font-medium text-muted-foreground sm:inline">
            Confidence ≥ {Math.round(minConfidence * 100)}%
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(minConfidence * 100)}
            onChange={(e) => setMinConfidence(Number(e.target.value) / 100)}
            className="h-1 w-20 cursor-pointer accent-current text-primary"
          />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="rounded-lg border border-border bg-card/40 px-3 py-1.5 backdrop-blur-sm">
            <p className="font-mono text-[15px] font-semibold leading-none tabular text-foreground">
              {isFetching ? '…' : totalNodes}
            </p>
            <p className="mt-0.5 text-[9.5px] font-medium uppercase tracking-wider text-muted-foreground">Nodes</p>
          </div>
          <div className="rounded-lg border border-border bg-card/40 px-3 py-1.5 backdrop-blur-sm">
            <p className="font-mono text-[15px] font-semibold leading-none tabular text-foreground">
              {isFetching ? '…' : totalEdges}
            </p>
            <p className="mt-0.5 text-[9.5px] font-medium uppercase tracking-wider text-muted-foreground">Relationships</p>
          </div>
          {truncated && (
            <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + DEFAULT_LIMIT)} disabled={isFetching}>
              {isFetching ? 'Loading…' : `Load more (${graphData.nodes.length}/${totalNodes})`}
            </Button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-1 gap-y-1.5">
        {ENTITY_ORDER.map((t) => {
          const c = NODE_COLORS[t] || '#6b7280';
          return (
            <button
              key={t}
              onClick={() => setEntityTypes((cur) => (cur === t ? '' : t))}
              title={entityTypes === t ? `Show all entities (currently filtered to ${typeLabel(t)})` : `Filter to ${typeLabel(t).toLowerCase()}s`}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all duration-150',
                entityTypes === t
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border/70 bg-card/30 text-muted-foreground hover:border-primary/25 hover:text-foreground'
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${c}55` }} />
              <span className="capitalize">{t}</span>
            </button>
          );
        })}
      </div>

      {/* Graph */}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-border shadow-card">
        {isLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl gradient-brand shadow-glow-sm">
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            </div>
            <p className="text-xs text-muted-foreground">Arranging relationships…</p>
          </div>
        ) : displayData.nodes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card/40 text-muted-foreground">
              <Inbox className="h-6 w-6" />
            </div>
            <div className="max-w-sm px-6">
              <p className="text-[15px] font-semibold text-foreground">Your knowledge graph is empty</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                Connect data sources or create entities to begin building your enterprise knowledge graph.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/documents')}>
              Go to Documents
            </Button>
          </div>
        ) : (
          <GraphCanvas
            data={displayData}
            theme={theme}
            selectedId={selectedId}
            onSelect={handleSelectNode}
            selectedEdgeId={selectedEdge?.id ?? null}
            onEdgeSelect={handleSelectEdge}
          />
        )}

        {/* Relationship detail panel */}
        {selectedEdge ? (
          <div className="glass-strong animate-fade-in absolute bottom-3 right-3 z-20 w-[300px] max-w-[calc(100%-24px)] overflow-hidden rounded-2xl border border-border/70 shadow-pop">
            <div className="flex items-start gap-3 border-b border-border/60 p-3.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <ArrowUpRight className="h-4 w-4 text-primary" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="truncate text-[14px] font-semibold leading-tight text-foreground">Relationship</h2>
                  <button
                    onClick={() => { setSelectedEdge(null); setSelectedId(null); }}
                    aria-label="Close details"
                    className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-0.5 text-[11.5px] capitalize text-muted-foreground">
                  {edgeLabel(selectedEdge)}
                </p>
                {selectedEdge.source && (
                  <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-border/70 bg-secondary/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    <Database className="h-2.5 w-2.5" />
                    {sourceLabel(selectedEdge.source)}
                  </span>
                )}
              </div>
            </div>

            <div className="max-h-[38vh] overflow-y-auto p-3.5">
              {selectedEdge.confidence != null && (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/40 px-2.5 py-1.5 text-[11px]">
                  <Gauge className="h-3.5 w-3.5 text-primary" />
                  <span className="text-muted-foreground">Confidence</span>
                  <span className="ml-auto font-semibold tabular text-foreground">
                    {Math.round(selectedEdge.confidence * 100)}%
                  </span>
                  {selectedEdge.timestamp && (
                    <span className="ml-2 border-l border-border/60 pl-2 tabular text-muted-foreground">
                      {new Date(selectedEdge.timestamp).toLocaleDateString()}
                    </span>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <button
                  onClick={() => selFrom && handleSelectNode(selFrom.id)}
                  className="flex w-full items-center gap-2 rounded-lg border border-border/60 bg-secondary/40 px-2.5 py-2 text-left transition-colors hover:bg-secondary"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: selFrom ? NODE_COLORS[selFrom.type] || '#6b7280' : '#6b7280' }} />
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-semibold text-foreground">{selFrom?.name ?? selectedEdge.from}</span>
                    <span className="block text-[10.5px] capitalize text-muted-foreground">{selFrom ? typeLabel(selFrom.type) : 'Source'}</span>
                  </span>
                </button>

                <div className="flex items-center gap-2 px-2 text-[11px] text-muted-foreground">
                  <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
                  <span className="min-w-0 flex-1 truncate font-medium capitalize text-primary">
                    {edgeLabel(selectedEdge)}
                  </span>
                </div>

                <button
                  onClick={() => selTo && handleSelectNode(selTo.id)}
                  className="flex w-full items-center gap-2 rounded-lg border border-border/60 bg-secondary/40 px-2.5 py-2 text-left transition-colors hover:bg-secondary"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: selTo ? NODE_COLORS[selTo.type] || '#6b7280' : '#6b7280' }} />
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-semibold text-foreground">{selTo?.name ?? selectedEdge.to}</span>
                    <span className="block text-[10.5px] capitalize text-muted-foreground">{selTo ? typeLabel(selTo.type) : 'Target'}</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : selectedNode ? (
          <div className="glass-strong animate-fade-in absolute bottom-3 right-3 z-20 w-[300px] max-w-[calc(100%-24px)] overflow-hidden rounded-2xl border border-border/70 shadow-pop">
            <div className="flex items-start gap-3 border-b border-border/60 p-3.5">
              <span
                className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full"
                style={{ background: NODE_COLORS[selectedNode.type] || '#6b7280', boxShadow: `0 0 12px ${NODE_COLORS[selectedNode.type] || '#6b7280'}88` }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="truncate text-[14px] font-semibold leading-tight text-foreground">
                    {selectedNode.name}
                  </h2>
                  <button
                    onClick={() => handleSelectNode(null)}
                    aria-label="Close details"
                    className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-0.5 text-[11.5px] capitalize text-muted-foreground">{typeLabel(selectedNode.type)}</p>
                {selectedNode.source && (
                  <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-border/70 bg-secondary/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    <Database className="h-2.5 w-2.5" />
                    {sourceLabel(selectedNode.source)}
                  </span>
                )}
              </div>
            </div>

            <div className="max-h-[38vh] overflow-y-auto p-3.5">
              {selectedNode.confidence != null && (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/40 px-2.5 py-1.5 text-[11px]">
                  <Gauge className="h-3.5 w-3.5 text-primary" />
                  <span className="text-muted-foreground">Confidence</span>
                  <span className="ml-auto font-semibold tabular text-foreground">
                    {Math.round(selectedNode.confidence * 100)}%
                  </span>
                  {selectedNode.timestamp && (
                    <span className="ml-2 border-l border-border/60 pl-2 tabular text-muted-foreground">
                      {new Date(selectedNode.timestamp).toLocaleDateString()}
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="font-medium uppercase tracking-wider">Connections</span>
                <span className="tabular">{relationshipCount} relationships</span>
              </div>

              {related.length === 0 ? (
                <p className="mt-2 text-[12px] text-muted-foreground">No relationships for this entity yet.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {related.slice(0, 8).map((r) => (
                    <li key={r.id}>
                      <button
                        onClick={() => handleSelectNode(r.id)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-secondary"
                      >
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: NODE_COLORS[r.type] || '#6b7280' }} />
                        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-foreground">{r.name}</span>
                        <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] capitalize text-primary">
                          {r.label.replace(/_/g, ' ')}
                        </span>
                      </button>
                    </li>
                  ))}
                  {related.length > 8 && (
                    <li className="px-2 pt-1 text-[11px] text-muted-foreground">
                      +{related.length - 8} more relationships…
                    </li>
                  )}
                </ul>
              )}

              {metadata.length > 0 && (
                <>
                  <div className="mt-4 mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Details
                  </div>
                  <dl className="space-y-1.5">
                    {metadata.map(([k, v]) => (
                      <div key={k} className="flex items-baseline justify-between gap-3 text-[12px]">
                        <dt className="shrink-0 capitalize text-muted-foreground">{k.replace(/_/g, ' ')}</dt>
                        <dd className="min-w-0 truncate text-right font-medium tabular text-foreground">{formatProp(v)}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              )}
            </div>
          </div>
        ) : null}

        <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-1.5 text-[10.5px] text-muted-foreground/70">
          <span>Drag to pan</span>
          <span>·</span>
          <span>Scroll to zoom</span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">Click a node or edge for details</span>
        </div>
      </div>
    </div>
  );
}