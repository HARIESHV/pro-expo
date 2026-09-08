import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  FileText,
  Globe,
  Database,
  Network,
  Bot,
  Users,
  BookOpen,
  Brain,
  TrendingUp,
  AlertTriangle,
  Clock,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Building2,
} from 'lucide-react';
import { searchApi } from '../../api/search';
import { cn } from '../../utils/cn';
import {
  SearchResult,
  SearchResultType,
  UniversalSearchResponse,
  SEARCH_CATEGORY_LABEL,
  SEARCH_CATEGORY_ORDER,
} from '../../types';
import { Badge } from '../../components/ui/badge';
import { IconButton } from '../../components/ui/button';
import { Skeleton, EmptyState } from '../../components/ui/states';
import { useAuth } from '../../auth/useAuth';

const TYPE_ICON: Record<SearchResultType, React.ElementType> = {
  document: FileText,
  chat: Bot,
  knowledge: Network,
  user: Users,
  dashboard: TrendingUp,
  decision: Brain,
  report: BookOpen,
  analytics: Database,
  company: Building2,
};

const TYPE_ACCENT: Record<SearchResultType, string> = {
  document: 'text-amber-500',
  chat: 'text-violet-500',
  knowledge: 'text-cyan-500',
  user: 'text-emerald-500',
  dashboard: 'text-blue-500',
  decision: 'text-fuchsia-500',
  report: 'text-rose-500',
  analytics: 'text-teal-500',
  company: 'text-indigo-500',
};

const TYPE_BG: Record<SearchResultType, string> = {
  document: 'bg-amber-500/10',
  chat: 'bg-violet-500/10',
  knowledge: 'bg-cyan-500/10',
  user: 'bg-emerald-500/10',
  dashboard: 'bg-blue-500/10',
  decision: 'bg-fuchsia-500/10',
  report: 'bg-rose-500/10',
  analytics: 'bg-teal-500/10',
  company: 'bg-indigo-500/10',
};

// Map the granular backend categories onto one of the display types so
// new categories never render an undefined icon (fallbacks are safe).
const CATEGORY_TYPE: Record<string, SearchResultType> = {
  document: 'document',
  knowledge_entity: 'knowledge',
  conversation: 'chat',
  user: 'user',
  report: 'report',
  analytics: 'analytics',
  decision: 'decision',
  company: 'company',
  project: 'dashboard',
  department: 'knowledge',
  customer: 'analytics',
  support_ticket: 'dashboard',
  sales_record: 'analytics',
  risk: 'decision',
};

function displayType(category: string): SearchResultType {
  return CATEGORY_TYPE[category] || ('dashboard' as SearchResultType);
}

function formatDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function typeLabel(t: string): string {
  return SEARCH_CATEGORY_LABEL[t as SearchResultType] || t.replace(/_/g, ' ');
}

export default function SearchResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';
  const urlMode = searchParams.get('mode') || '';
  const urlCategory = searchParams.get('category') || '';
  const urlPage = Math.max(0, parseInt(searchParams.get('page') || '0', 10) || 0);
  const [input, setInput] = useState(query);
  const { user } = useAuth();

  // Map the search mode tab (e.g. "company") onto a backend category filter.
  const modeCategory = urlMode === 'company' ? 'company' : urlMode === 'web' || urlMode === 'enterprise' ? '' : urlCategory;

  const [loading, setLoading] = useState<boolean>(!!query);
  const [data, setData] = useState<UniversalSearchResponse | null>(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(urlPage);
  const [category, setCategory] = useState(urlCategory);
  const abortRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(
    async (q: string, p: number, cat: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (!q.trim()) {
        setLoading(false);
        setData(null);
        setError('');
        return;
      }

      setLoading(true);
      setError('');
      try {
        const res = await searchApi.universalSearch(
          q,
          { page: p, limit: 25, category: cat || undefined },
          controller.signal
        );
        if (res.data.data) setData(res.data.data);
      } catch (err) {
        if (controller.signal.aborted) return;
        const anyErr = err as { response?: { data?: { message?: string; error?: string } }; message?: string };
        const msg =
          anyErr.response?.data?.message ||
          anyErr.response?.data?.error ||
          anyErr.message ||
          'Failed to search';
        // Distinguish auth/authorization vs generic failures for the UI
        const status = (err as { response?: { status?: number } }).response?.status;
        setError(status ? `${msg} (Status ${status})` : msg);
        setData(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    []
  );

  // Refetch whenever the URL parameters change (from a new search / suggestion)
  useEffect(() => {
    setInput(query);
    setPage(urlPage);
    setCategory(urlCategory);
    runSearch(query, urlPage, modeCategory);
    return () => abortRef.current?.abort();
  }, [query, urlPage, urlCategory, modeCategory, runSearch]);

  const results = data?.results || [];
  const grouped = React.useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    for (const r of results) {
      const key = r.category || r.type;
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    const order = SEARCH_CATEGORY_ORDER.filter((t) => map.has(t));
    const extra = Array.from(map.keys()).filter((k) => !SEARCH_CATEGORY_ORDER.includes(k as SearchResultType));
    return [...order.map((t) => ({ type: t, items: map.get(t)! })), ...extra.map((k) => ({ type: k as SearchResultType, items: map.get(k)! }))];
  }, [results]);

  const handleCategoryFilter = (cat: string) => {
    const next = new URLSearchParams(searchParams);
    if (cat) next.set('category', cat);
    else next.delete('category');
    next.delete('page');
    setSearchParams(next);
  };

  const handleSetPage = (p: number) => {
    if (p < 0 || (data && p >= data.totalPages)) return;
    const next = new URLSearchParams(searchParams);
    next.set('page', String(p));
    setSearchParams(next);
  };

  const handleSearchAgain = () => {
    if (!input.trim()) return;
    navigate(`/search?q=${encodeURIComponent(input.trim())}`);
  };

  const goToResult = (r: SearchResult) => {
    navigate(r.url);
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      {/* Search header */}
      <div className="mb-6 flex items-center gap-2">
        <IconButton variant="ghost" aria-label="Back to search" onClick={() => navigate('/search-home')}>
          <ArrowLeft className="h-4 w-4" />
        </IconButton>
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-2 shadow-card focus-within:ring-2 focus-within:ring-ring/30">
          <Search className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearchAgain();
            }}
            placeholder="Search again…"
            className="h-9 min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <Badge variant="muted" className="uppercase tracking-wide">Universal Search</Badge>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-4 animate-fade-in">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-brand">
                <Search className="h-4 w-4 text-white" />
              </div>
              <p className="animate-pulse text-sm font-medium text-foreground">Searching “{query}”…</p>
            </div>
            <div className="space-y-2.5">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-[92%]" />
              <Skeleton className="h-3 w-[85%]" />
              <Skeleton className="h-3 w-[70%]" />
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 px-6 py-12 text-center animate-fade-in">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-destructive/25 bg-destructive/10 text-destructive">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Search failed</p>
            <p className="mt-1 max-w-md text-[13px] text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {/* No-results state */}
      {!loading && !error && query && results.length === 0 && (
        <EmptyState
          icon={<Search className="h-4 w-4" />}
          title={`No results for “${query}”`}
          description="Try different keywords, a document filename, an entity name, or a broader phrase."
        />
      )}

      {/* Results grouped by category */}
      {!loading && !error && results.length > 0 && (
        <div className="space-y-6 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-muted-foreground">
              <span className="font-semibold text-foreground">{data?.total}</span> result
              {data?.total === 1 ? '' : 's'} for “<span className="text-foreground">{query}</span>”
            </p>
          </div>

          {/* Category filters */}
          {data && data.categories.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => handleCategoryFilter('')}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                  !category ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/70'
                )}
              >
                All
              </button>
              {data.categories.map((c) => (
                <button
                  key={c}
                  onClick={() => handleCategoryFilter(c)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[11px] font-medium capitalize transition-colors',
                    category === c ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/70'
                  )}
                >
                  {c.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          )}

          {grouped.map(({ type, items }) => {
            const dt = displayType(type);
            const Icon = TYPE_ICON[dt];
            const accent = TYPE_ACCENT[dt];
            const bg = TYPE_BG[dt];
            return (
              <div key={type}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded-md', bg)}>
                    <Icon className={cn('h-3.5 w-3.5', accent)} />
                  </span>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {typeLabel(type)}
                  </p>
                  <span className="rounded-full bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((r) => {
                    const RowIcon = TYPE_ICON[displayType(r.category || r.type)];
                    const date = formatDate(r.timestamp);
                    return (
                      <button
                        key={`${r.type}-${r.id}`}
                        onClick={() => goToResult(r)}
                        className="group flex w-full items-start gap-3 rounded-xl border border-border bg-card p-3 text-left shadow-card transition-colors hover:border-primary/30 hover:bg-secondary/40"
                      >
                        <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', TYPE_BG[displayType(r.category || r.type)])}>
                          <RowIcon className={cn('h-4 w-4', TYPE_ACCENT[displayType(r.category || r.type)])} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-[13.5px] font-semibold text-foreground">{r.title || 'Untitled'}</span>
                            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                          </span>
                          {r.snippet && (
                            <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted-foreground">{r.snippet}</span>
                          )}
                          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1 font-medium text-primary/80">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'currentColor' }} />
                              {Math.round((r.relevance || 0) * 100)}%
                            </span>
                            <span>{r.source}</span>
                            {date && (
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {date}
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <IconButton
                variant="outline"
                aria-label="Previous page"
                disabled={page <= 0}
                onClick={() => handleSetPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </IconButton>
              <span className="text-[12px] tabular-nums text-muted-foreground">
                Page{' '}
                <span className="font-medium text-foreground">{page + 1}</span> of {data.totalPages}
              </span>
              <IconButton
                variant="outline"
                aria-label="Next page"
                disabled={page >= data.totalPages - 1}
                onClick={() => handleSetPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </IconButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
