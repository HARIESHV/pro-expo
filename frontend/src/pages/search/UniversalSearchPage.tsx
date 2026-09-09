import React, { useEffect, useRef, useState } from 'react';
import {
  Search as SearchIcon,
  Globe,
  Database,
  LayoutGrid,
  ArrowRight,
  FileText,
  Sparkles,
  Bot,
  Building2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { Kbd } from '../../components/ui/misc';
import { useAuth } from '../../auth/useAuth';
import { isAdminRole } from '../../types';

type SearchMode = 'all' | 'enterprise' | 'web' | 'company';

const ADMIN_MODES: Array<{ id: SearchMode; label: string; icon: React.ElementType; hint: string }> = [
  { id: 'all', label: 'All', icon: LayoutGrid, hint: 'Everything' },
  { id: 'enterprise', label: 'Enterprise', icon: Database, hint: 'Databases, docs, KG' },
  { id: 'company', label: 'Companies', icon: Building2, hint: 'Universal company knowledge' },
  { id: 'web', label: 'Web', icon: Globe, hint: 'Public sources' },
];

const ADMIN_SUGGESTIONS = [
  { icon: Database, text: 'Why did our sales decrease in Q2?' },
  { icon: FileText, text: 'Find all documents related to Project Alpha' },
  { icon: Building2, text: 'What does NVIDIA do?' },
  { icon: Building2, text: 'Who founded Zoho?' },
  { icon: Globe, text: 'What does OpenAI do?' },
  { icon: Globe, text: "What are Google's latest AI products?" },
];

const USER_SUGGESTIONS = [
  { icon: FileText, text: 'Find documents about revenue analysis' },
  { icon: Bot, text: 'Show my AI chat conversations about product roadmap' },
  { icon: FileText, text: 'Search uploaded reports from last quarter' },
];

export default function UniversalSearchPage() {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchMode>('all');
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const isAdmin = isAdminRole(user?.roles);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = (q: string = query, mode: SearchMode = activeTab) => {
    if (!q.trim()) return;
    navigate(`/search?q=${encodeURIComponent(q)}&mode=${mode}`);
  };

  const suggestions = isAdmin ? ADMIN_SUGGESTIONS : USER_SUGGESTIONS;

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-2xl flex-col items-center animate-fade-in-up">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 shadow-card">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Universal Search</h1>
          <p className="mt-1 max-w-md text-[13px] leading-relaxed text-muted-foreground">
            Search across authorized <span className="font-medium text-foreground">Documents</span>,{' '}
            <span className="font-medium text-foreground">Knowledge Graph</span>,{' '}
            <span className="font-medium text-foreground">Companies</span>, and{' '}
            <span className="font-medium text-foreground">AI Chat</span>.
          </p>
        </div>

        {/* Search box */}
        <div className="w-full">
          <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-card p-2 shadow-card transition-all focus-within:border-input focus-within:ring-2 focus-within:ring-ring/30">
            <SearchIcon className="ml-1.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search or ask a question across enterprise knowledge…"
              className="h-9 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <button
              onClick={() => handleSearch()}
              disabled={!query.trim()}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-orange-500 px-3.5 text-sm font-medium text-white transition-opacity hover:bg-orange-600 disabled:opacity-50"
            >
              Search <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between px-1">
            {/* Search mode tabs */}
            <div className="flex items-center gap-2">
              {ADMIN_MODES.map((mode) => {
                const Icon = mode.icon;
                return (
                  <button
                    key={mode.id}
                    onClick={() => setActiveTab(mode.id)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-colors',
                      activeTab === mode.id
                        ? 'bg-secondary text-foreground'
                        : 'text-muted-foreground hover:bg-secondary/70 hover:text-secondary-foreground'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {mode.label}
                  </button>
                );
              })}
            </div>
            <span className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex">
              <Kbd>↵</Kbd> to search
            </span>
          </div>
        </div>

        {/* Suggestions */}
        <div className="mt-10 w-full">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
            Try asking about
          </p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSearch(s.text, 'all')}
                className="group flex items-start gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3 text-left transition-colors hover:bg-secondary"
              >
                <s.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-orange-500" />
                <span className="text-[13px] leading-snug text-secondary-foreground">{s.text}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
