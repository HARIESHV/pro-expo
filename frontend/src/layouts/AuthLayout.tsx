import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Network, Bot, Search, BarChart3, ShieldCheck, ArrowRight, Sparkles, Sun, Moon } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { Button } from '../components/ui/button';
import { AmbientBackground } from '../components/AmbientBackground';
import { cn } from '../utils/cn';

const FEATURES = [
  { icon: Bot, label: 'Multi-agent AI', desc: '11 specialized agents collaborate' },
  { icon: Search, label: 'Advanced RAG', desc: 'Vector + keyword hybrid retrieval' },
  { icon: BarChart3, label: 'Business intelligence', desc: 'Real-time analytics' },
  { icon: ShieldCheck, label: 'Enterprise security', desc: 'RBAC & audit logging' },
];

export function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();

  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div className="relative flex min-h-screen overflow-hidden">
      <AmbientBackground tone="auth" />

      {/* Left brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 lg:flex">
        <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-[560px] -translate-x-1/2">
          <div
            className="h-full w-full"
            style={{ background: 'radial-gradient(closest-side, hsl(var(--glow-a) / 0.25), transparent 70%)' }}
          />
        </div>

        <div className="relative z-10 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-brand shadow-glow-sm">
            <Network className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="block text-[15px] font-semibold tracking-tight text-foreground">Enterprise</span>
            <span className="block text-[15px] font-semibold tracking-tight text-foreground">Intelligence Platform</span>
            <span className="block text-[10.5px] text-muted-foreground">Enterprise Workspace</span>
          </div>
        </div>

        <div className="relative z-10 max-w-lg">
          <span className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-foreground">
            <Sparkles className="h-3 w-3 text-primary" /> Welcome to your workspace
          </span>
          <h1 className="mt-5 text-3xl font-semibold leading-[1.15] tracking-[-0.02em] text-foreground">
            Turn company knowledge into <span className="gradient-text">confident decisions</span>
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            Chat with your knowledge, search across documents and the web, and simulate decisions — every answer backed by evidence.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3">
            {FEATURES.map((f, i) => (
              <div
                key={f.label}
                className={cn(
                  'glass rounded-xl px-4 py-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card',
                  i === 0 && 'sm:translate-x-1',
                  i === 2 && 'sm:-translate-x-1'
                )}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-brand-soft text-primary">
                  <f.icon className="h-3.5 w-3.5" />
                </div>
                <p className="mt-2.5 text-[13px] font-medium text-foreground">{f.label}</p>
                <p className="text-[11px] text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <span className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5">
            <ArrowRight className="h-3.5 w-3.5 text-primary" /> Answers include sources & evidence
          </span>
        </div>
      </div>

      {/* Auth panel */}
      <div className="relative z-10 flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2.5 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-brand shadow-glow-sm">
                <Network className="h-4 w-4 text-white" />
              </div>
              <span className="text-[15px] font-semibold tracking-tight text-foreground">Enterprise Intelligence Platform</span>
            </div>
            <div className="ml-auto">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="rounded-full text-muted-foreground hover:text-foreground"
                aria-label="Toggle appearance"
                title="Toggle appearance"
              >
                {theme === 'dark' ? (
                  <Sun className="h-4 w-4 text-amber-400" />
                ) : (
                  <Moon className="h-4 w-4 text-indigo-400" />
                )}
              </Button>
            </div>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}