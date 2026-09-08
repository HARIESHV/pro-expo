import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Search,
  FileText,
  MessageSquare,
  Brain,
  Send,
  ArrowRight,
  FileUp,
  Sun,
  Moon,
  CornerDownLeft,
  MessageSquarePlus,
} from 'lucide-react';
import { searchApi } from '../api/search';
import { SearchResult } from '../types';
import { cn } from '../utils/cn';
import { Spinner } from './ui/misc';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../auth/useAuth';

interface PaletteOption {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  group: string;
  onSelect: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const { toggleTheme, theme } = useTheme();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeGroup, setActiveGroup] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const searchSeq = useRef(0);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSearchResults([]);
    setLoadingDocs(false);
    setSelectedIndex(0);
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const navigateOptions = useMemo<PaletteOption[]>(() => {
    const go = (to: string) => {
      onOpenChange(false);
      navigate(to);
    };
    return [
      { id: 'nav-chat', label: 'AI Chat', description: 'Talk to your knowledge agents', icon: MessageSquare, group: 'Navigate', onSelect: () => go('/chat') },
      { id: 'nav-search', label: 'Universal Search', description: 'Search across documents and data', icon: Search, group: 'Navigate', onSelect: () => go('/search-home') },
      { id: 'nav-documents', label: 'Documents', description: 'Browse and manage documents', icon: FileText, group: 'Navigate', onSelect: () => go('/documents') },
      { id: 'nav-di', label: 'Decision Intelligence', description: 'Evaluate strategic decisions', icon: Brain, group: 'Navigate', onSelect: () => go('/decision-intelligence') },
      { id: 'nav-dashboard', label: 'Executive Dashboard', description: 'Key metrics overview', icon: Brain, group: 'Navigate', onSelect: () => go('/dashboard') },
    ];
  }, [navigate, onOpenChange]);

  useEffect(() => {
    if (!open || !query.trim()) {
      setSearchResults([]);
      setLoadingDocs(false);
      return;
    }
    const seq = ++searchSeq.current;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoadingDocs(true);
      try {
        const res = await searchApi.universalSearch(query.trim());
        if (seq !== searchSeq.current) return;
        setSearchResults(res.data?.data?.results?.slice(0, 8) ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        if (seq === searchSeq.current) setLoadingDocs(false);
      }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, open]);

  const actions: PaletteOption[] = useMemo(() => {
    const close = () => onOpenChange(false);
    return [
      {
        id: 'action-new-chat',
        label: 'Start a new chat',
        description: 'Open AI Chat',
        icon: MessageSquarePlus,
        group: 'Actions',
        onSelect: () => {
          close();
          navigate('/chat');
        },
      },
      {
        id: 'action-upload',
        label: 'Upload a document',
        description: 'Go to Documents',
        icon: FileUp,
        group: 'Actions',
        onSelect: () => {
          close();
          navigate('/documents');
        },
      },
      {
        id: 'action-theme',
        label: 'Toggle appearance',
        description: 'Toggle appearance',
        icon: theme === 'dark' ? Sun : Moon,
        group: 'Actions',
        onSelect: () => {
          toggleTheme();
          close();
        },
      },
    ];
  }, [navigate, onOpenChange, theme, toggleTheme]);

  const resultOptions: PaletteOption[] = useMemo(
    () =>
      searchResults.map((r) => ({
        id: `result-${r.type}-${r.id}`,
        label: r.title,
        description: r.source,
        icon: FileText,
        group: 'Results',
        onSelect: () => {
          onOpenChange(false);
          navigate(r.url);
        },
      })),
    [searchResults, navigate, onOpenChange]
  );

  const options = useMemo(() => {
    const all = [...navigateOptions, ...actions, ...resultOptions];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.description ?? '').toLowerCase().includes(q)
    );
  }, [navigateOptions, actions, resultOptions, query]);

  const groups = useMemo(() => {
    const order: Record<string, number> = { Navigate: 0, Actions: 1, Results: 2 };
    const map = new Map<string, PaletteOption[]>();
    for (const o of options) {
      const arr = map.get(o.group) ?? [];
      arr.push(o);
      map.set(o.group, arr);
    }
    return Array.from(map.entries()).sort(
      (a, b) => (order[a[0]] ?? 9) - (order[b[0]] ?? 9)
    );
  }, [options]);

  const flattened = useMemo(() => options, [options]);

  useEffect(() => {
    setSelectedIndex(0);
    setActiveGroup(groups[0]?.[0] ?? '');
  }, [query, groups]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flattened.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = flattened[selectedIndex];
      if (opt) opt.onSelect();
    }
  };

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const selected = el.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`);
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const showBranding = query.trim() === '' && searchResults.length === 0;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="z-[60] bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[12vh] z-[61] w-[calc(100vw-2rem)] max-w-[600px] -translate-x-1/2 overflow-hidden rounded-3xl border border-border bg-card shadow-pop data-[state=open]:animate-zoom-in"
          onKeyDown={handleKeyDown}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documents, navigate…"
              className="h-6 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            <Spinner className={cn('h-3.5 w-3.5 text-muted-foreground transition-opacity', loadingDocs ? 'opacity-100' : 'opacity-0')} />
          </div>

          <div ref={listRef} className="max-h-[380px] overflow-y-auto p-2">
            {options.length === 0 && !loadingDocs && (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                {query.trim() ? `No results for “${query}”` : 'Type to search'}
              </p>
            )}

            {groups.map(([group, groupOptions]) => {
              const groupStart = options.indexOf(groupOptions[0]);
              const activeInGroup =
                selectedIndex >= groupStart && selectedIndex < groupStart + groupOptions.length;
              return (
                <div key={group} className="mb-1">
                  <p
                    className={cn(
                      'px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]',
                      activeInGroup ? 'text-primary' : 'text-muted-foreground/70'
                    )}
                  >
                    {group}
                  </p>
                  {groupOptions.map((opt, i) => {
                    const index = options.indexOf(opt);
                    const active = index === selectedIndex;
                    return (
                      <button
                        key={opt.id}
                        data-index={index}
                        onMouseMove={() => setSelectedIndex(index)}
                        onClick={() => opt.onSelect()}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                          active ? 'bg-secondary text-foreground' : 'text-secondary-foreground'
                        )}
                      >
                        <opt.icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium">{opt.label}</p>
                          {opt.description && (
                            <p className="truncate text-[11px] text-muted-foreground">{opt.description}</p>
                          )}
                        </div>
                        {active && (
                          <span className="text-muted-foreground">
                            <CornerDownLeft className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {showBranding && (
            <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                {user ? (
                  <>
                    <Send className="h-3 w-3" />
                    {user.firstName || user.email}
                  </>
                ) : null}
              </span>
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <ArrowRight className="h-3 w-3" /> navigate
                </span>
                <span>Esc to close</span>
              </span>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}