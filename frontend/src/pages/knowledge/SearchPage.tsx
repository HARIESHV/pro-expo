import React, { useState } from 'react';
import { Search as SearchIcon, FileText, Loader2 } from 'lucide-react';
import api from '../../api/axios';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<unknown[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const res = await api.get('/knowledge-graph/search', { params: { q: query } });
      setResults(res.data?.data?.entities || []);
    } catch {}
    setIsSearching(false);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-base font-semibold tracking-tight text-foreground">Knowledge Search</h1>
        <p className="text-xs text-muted-foreground">Search across your entire enterprise knowledge base</p>
      </div>
      <div className="flex gap-3 mb-8 animate-fade-in">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            id="knowledge-search"
            type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search documents, entities, relationships..."
            className="w-full pl-12 pr-4 py-4 rounded-2xl bg-secondary border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm"
          />
        </div>
        <button onClick={handleSearch} disabled={isSearching}
          className="px-6 py-4 rounded-2xl gradient-brand text-white font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2">
          {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <SearchIcon className="w-4 h-4" />}
          Search
        </button>
      </div>
      {results.length > 0 && (
        <div className="space-y-3 animate-fade-in">
          {(results as Array<{ id: string; name: string; type: string }>).map((r) => (
            <div key={r.id} className="glass rounded-xl p-4 card-glow">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-primary" />
                <div>
                  <p className="font-medium text-foreground">{r.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{r.type}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
