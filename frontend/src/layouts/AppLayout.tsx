import React, { useEffect, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Menu, Search, Sun, Moon } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { Sidebar } from '../components/Sidebar';
import { CommandPalette } from '../components/CommandPalette';
import { Drawer } from '../components/ui/dialog';
import { IconButton } from '../components/ui/button';
import { Kbd } from '../components/ui/misc';
import { TooltipProvider } from '../components/ui/tooltip';
import { AmbientBackground } from '../components/AmbientBackground';
import { useTheme } from '../hooks/useTheme';
import { cn } from '../utils/cn';

const TITLES: Array<[RegExp, string]> = [
  [/^\/chat/, 'AI Chat'],
  [/^\/search-home/, 'Universal Search'],
  [/^\/search/, 'Search Results'],
  [/^\/companies/, 'Company Profile'],
  [/^\/documents/, 'Documents'],
  [/^\/decision-intelligence/, 'Decision Intelligence'],
  [/^\/dashboard/, 'Executive Dashboard'],
  [/^\/analytics/, 'Analytics'],
  [/^\/reports/, 'Reports'],
  [/^\/risks/, 'Risk Dashboard'],
  [/^\/agents/, 'AI Agents'],
  [/^\/query-history/, 'Query History'],
  [/^\/knowledge-graph/, 'Knowledge Graph'],
  [/^\/evaluate-graph/, 'Evaluate Graph'],
  [/^\/business-intelligence/, 'Business Intelligence'],
];

export function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toggleTheme, theme } = useTheme();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(
    () => localStorage.getItem('sidebar-collapsed') === '1'
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mainRef = React.useRef<HTMLElement>(null);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', sidebarCollapsed ? '1' : '0');
  }, [sidebarCollapsed]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  const title =
    TITLES.find(([re]) => re.test(location.pathname))?.[1] ?? 'Enterprise Intelligence Platform';

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-brand">
            <Search className="h-5 w-5" />
          </div>
          <p className="text-xs text-muted-foreground">Loading Enterprise Intelligence Platform…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="relative flex min-h-screen overflow-hidden text-foreground">
        <AmbientBackground tone="app" />
        {/* Desktop sidebar */}
        <aside
          className={cn(
            'relative hidden shrink-0 bg-sidebar-bg transition-[width] duration-200 lg:block',
            sidebarCollapsed ? 'w-[52px]' : 'w-[240px]'
          )}
        >
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((v) => !v)}
            onSearch={() => setPaletteOpen(true)}
          />
        </aside>

        {/* Mobile drawer */}
        <Drawer open={mobileOpen} onOpenChange={setMobileOpen} side="left" className="w-[272px] lg:hidden">
          <Sidebar collapsed={false} onToggle={() => {}} onSearch={() => setPaletteOpen(true)} onNavigate={() => setMobileOpen(false)} />
        </Drawer>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/70 bg-card/45 px-3 backdrop-blur-xl lg:px-4">
            <IconButton
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </IconButton>

            <p className="text-[13px] font-medium tracking-tight text-foreground">{title}</p>

            <div className="flex-1" />

            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden h-8 items-center gap-2 rounded-lg border border-border bg-card/60 px-2.5 text-xs text-muted-foreground transition-all hover:border-primary/25 hover:bg-card sm:flex"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Search workspace</span>
              <Kbd>⌘K</Kbd>
            </button>
            <IconButton
              className="sm:hidden"
              onClick={() => setPaletteOpen(true)}
              aria-label="Search workspace"
            >
              <Search className="h-4 w-4" />
            </IconButton>

            <IconButton
              onClick={toggleTheme}
              className="hidden lg:inline-flex"
              aria-label="Toggle appearance"
              title="Toggle appearance"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-indigo-400" />
              )}
            </IconButton>
          </header>

          {/* Content */}
          <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto">
            <div key={location.pathname} className="page-enter">
              <Outlet />
            </div>
          </main>
        </div>

        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </div>
    </TooltipProvider>
  );
}