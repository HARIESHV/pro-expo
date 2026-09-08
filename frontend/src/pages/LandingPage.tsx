import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import {
  Zap,
  MessageSquare,
  Search,
  FileText,
  Brain,
  ShieldCheck,
  ArrowRight,
  Check,
  Scale,
  Sparkles,
  Globe,
  Database,
  Network,
  LineChart,
  Star,
  Quote,
  ChevronDown,
  Bot,
  Command,
  Sun,
  Moon,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Kbd } from '../components/ui/misc';
import { Reveal, CountUp } from '../components/motion';
import { AmbientBackground } from '../components/AmbientBackground';
import { useTheme } from '../hooks/useTheme';
import { cn } from '../utils/cn';

/* ------------------------------------------------------------------ */
/* Content                                                              */
/* ------------------------------------------------------------------ */

const PRODUCTS = [
  {
    icon: MessageSquare,
    title: 'AI Chat',
    desc: 'Ask questions in plain language. Multiple agents collaborate and return evidence-backed answers with sources.',
    points: ['Multi-agent orchestration', 'Markdown, tables & code', 'Citations & confidence scores'],
  },
  {
    icon: Search,
    title: 'Universal Search',
    desc: 'One search across documents, databases, the knowledge graph, and the public web — with grouped, filterable results.',
    points: ['Enterprise & public web modes', 'Live evidence & relevance scores', 'Open anywhere with ⌘K'],
  },
  {
    icon: FileText,
    title: 'Documents',
    desc: 'Upload PDFs, spreadsheets, CSV, and text. Content is automatically chunked and becomes part of your knowledge base.',
    points: ['Drag-and-drop uploads', 'Automatic chunking & tagging', 'Processing status tracking'],
  },
  {
    icon: Scale,
    title: 'Decision Intelligence',
    desc: 'Simulate strategic decisions against department data, budgets, and risk tolerance to surface opportunities and risks.',
    points: ['Scenario evaluation', 'Opportunity / risk balance', 'A clear recommendation'],
  },
];

const STEPS = [
  {
    icon: Bot,
    title: 'Ingest & index',
    desc: 'Upload documents, connect data sources, and map relationships into a secure knowledge graph.',
  },
  {
    icon: Sparkles,
    title: 'Orchestrate agents',
    desc: 'Your question is routed to the right specialists — RAG, finance, sales, risk, web — working in parallel.',
  },
  {
    icon: ShieldCheck,
    title: 'Synthesize with evidence',
    desc: 'Agents merge findings into one answer with sources, confidence scores, and recommended next actions.',
  },
];

const HIGHLIGHTS = [
  'Answers with citations you can verify, every time',
  'Global ⌘K palette to open anything in two keystrokes',
  'Role-based permissions and full audit logging',
  'Works on any screen — phone, tablet, or desktop',
];

const TESTIMONIALS = [
  {
    quote:
      'Enterprise Intelligence Platform replaced three tools for our team. Instead of digging through spreadsheets, we ask a question and get a sourced answer in seconds.',
    name: 'Priya Raghavan',
    role: 'VP Operations, Meridian Logistics',
    initials: 'PR',
  },
  {
    quote:
      'The decision intelligence module is the killer feature. We stress-tested three strategic options in an afternoon — something that used to take weeks.',
    name: 'Daniel Okafor',
    role: 'Head of Strategy, Northwind Retail',
    initials: 'DO',
  },
  {
    quote:
      'Answers come back with real citations, so I trust what I read. It cut the time our analysts spend on research by nearly half.',
    name: 'Sofia Marino',
    role: 'Director of Finance, Atlas Energy',
    initials: 'SM',
  },
];

const FAQS = [
  {
    q: 'What can I actually ask the AI?',
    a: 'Anything grounded in your knowledge base — “Why did Q2 sales dip in the south?” or “Summarize our top ten contracts by revenue.” Agents return answers with sources and confidence scores so you can verify every claim.',
  },
  {
    q: 'What document types are supported?',
    a: 'PDF, spreadsheets, CSV, and plain text. Uploads are chunked, embedded, and indexed automatically, then appear in search and chat within seconds.',
  },
  {
    q: 'How does universal search decide what to show?',
    a: 'It queries your enterprise data, the knowledge graph, and the public web simultaneously, then groups results by type — documents, entities, meetings, web pages — with relevance and evidence indicators.',
  },
  {
    q: 'Is my data secure?',
    a: 'Role-based access control, audit logging, and isolated infrastructure keep your data yours. Every answer is backed by evidence you can verify, and admins control exactly who can see what.',
  },
  {
    q: 'How long does it take to get started?',
    a: 'Create an account, upload a few documents, and you can run your first chat or search in under five minutes — no ML expertise or configuration required.',
  },
  {
    q: 'Can I try it before committing?',
    a: 'Yes. Register for a free account and explore the full workspace — chat, search, documents, and decision intelligence — before you decide.',
  },
];

const BARS = [34, 42, 38, 55, 48, 66, 62, 74, 70, 82, 78, 90];
const COMPANIES = ['Meridian Logistics', 'Northwind Retail', 'Atlas Energy', 'Cobalt Health', 'Pioneer Bank'];

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-foreground">
      {children}
    </span>
  );
}

function SectionHeading({ kicker, title, sub }: {
  kicker: string; title: React.ReactNode; sub?: React.ReactNode
}) {
  return (
    <Reveal className="mx-auto mb-12 flex max-w-2xl flex-col items-center text-center">
      <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
        <span className="h-1 w-1 rounded-full bg-gradient-to-r from-primary to-accent" />
        {kicker}
        <span className="h-1 w-1 rounded-full bg-gradient-to-r from-primary to-accent" />
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em] text-foreground sm:text-4xl">{title}</h2>
      {sub && <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">{sub}</p>}
    </Reveal>
  );
}

function GradientIcon({ icon: Icon, className }: { icon: React.ElementType; className?: string }) {
  return (
    <div
      className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl gradient-brand-soft text-primary shadow-glow-sm',
        className
      )}
    >
      <Icon className="h-5 w-5" />
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group glass rounded-2xl px-5 py-4 transition-all duration-200 open:shadow-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14.5px] font-medium text-foreground marker:hidden">
        {q}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">{a}</p>
    </details>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const primary = isAuthenticated
    ? { label: 'Open workspace', to: '/dashboard' }
    : { label: 'Get started free', to: '/register' };

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden font-sans text-foreground">
      <AmbientBackground tone="hero" />

      {/* ============ Floating nav ============ */}
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
        <div
          className={cn(
            'glass-strong mx-auto flex h-12 max-w-5xl items-center gap-3 rounded-full px-3 pl-4 transition-shadow duration-300 sm:px-4',
            scrolled ? 'shadow-pop' : 'shadow-card'
          )}
        >
          <button onClick={() => navigate('/')} className="flex items-center gap-2.5" aria-label="Enterprise Intelligence Platform home">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-brand">
              <Network className="h-3.5 w-3.5" />
            </div>
            <span className="hidden text-[15px] font-semibold tracking-tight sm:block">Enterprise Intelligence Platform</span>
            <span className="text-[15px] font-semibold tracking-tight sm:hidden">EIP</span>
          </button>

          <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Product">
            {[
              ['Product', '#product'],
              ['How it works', '#how-it-works'],
              ['Customers', '#testimonials'],
              ['FAQ', '#faq'],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="rounded-full px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex-1" />

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="hidden rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground sm:flex"
            aria-label="Toggle appearance"
            title="Toggle appearance"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-indigo-400" />
            )}
          </Button>

          {isAuthenticated ? (
            <Button size="sm" onClick={() => navigate('/dashboard')}>
              {primary.label} <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate('/login')} className="hidden sm:inline-flex">
                Sign in
              </Button>
              <Button size="sm" onClick={() => navigate('/register')}>
                {primary.label} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </header>

      {/* ============ Hero ============ */}
      <section className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-16 pt-32 text-center sm:px-6 sm:pt-40">
        {/* Local hero glow */}
        <div className="pointer-events-none absolute left-1/2 top-8 h-[540px] w-[820px] -translate-x-1/2">
          <div
            className="glow-pulse h-full w-full rounded-full"
            style={{
              background:
                'radial-gradient(closest-side, hsl(var(--glow-a) / 0.28), hsl(var(--glow-b) / 0.12) 55%, transparent)',
            }}
          />
        </div>

        <Reveal>
          <Eyebrow>
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute h-full w-full animate-ping rounded-full bg-success opacity-70" />
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            The AI workspace for your business
          </Eyebrow>
        </Reveal>

        <Reveal delay={80}>
          <h1 className="mt-7 max-w-3xl text-[42px] font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-6xl">
            Every answer your team needs,
            <br className="hidden sm:block" />{' '}
            <span className="gradient-text">backed by evidence</span>
          </h1>
        </Reveal>

        <Reveal delay={160}>
          <p className="mt-6 max-w-xl text-[15.5px] leading-relaxed text-muted-foreground sm:text-base">
            Ask in plain language, search everything your company knows, and simulate decisions before you commit. Enterprise Intelligence Platform connects documents, data, and your knowledge graph to a team of AI agents.
          </p>
        </Reveal>

        <Reveal delay={240}>
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
            <Button size="lg" onClick={() => navigate(primary.to)}>
              {primary.label} <ArrowRight className="h-4 w-4" />
            </Button>
            {!isAuthenticated && (
              <Button size="lg" variant="outline" onClick={() => navigate('/login')}>
                Try the live demo
              </Button>
            )}
            {isAuthenticated && (
              <Button size="lg" variant="outline" onClick={() => navigate('/search-home')}>
                Run a search
              </Button>
            )}
          </div>
          <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            Press <Kbd>⌘K</Kbd> anywhere inside the workspace for instant search
          </p>
        </Reveal>

        {/* Product mockup */}
        <Reveal delay={320} className="relative mt-16 w-full max-w-5xl">
          <div className="border-gradient relative rounded-3xl shadow-pop">
            <div className="rounded-[calc(1.5rem-1px)] bg-card/70">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 rounded-t-[calc(1.5rem-1px)] border-b border-border bg-card/40 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--destructive)/0.7)]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--warning)/0.8)]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--success)/0.8)]" />
                <div className="mx-auto flex h-6 w-64 max-w-full items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-[11px] text-muted-foreground">
                  <ShieldCheck className="h-3 w-3 text-success" /> app.proexpo.io/dashboard
                </div>
                <div className="hidden items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground sm:flex">
                  <Search className="h-3 w-3" /> Search <Kbd>⌘K</Kbd>
                </div>
              </div>

              {/* Mock dashboard */}
              <div className="grid grid-cols-1 text-left md:grid-cols-[150px_1fr]">
                <div className="hidden flex-col gap-4 border-r border-border bg-card/35 p-4 md:flex">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md gradient-brand">
                      <Network className="h-3 w-3" />
                    </div>
                    <span className="text-xs font-semibold">EIP</span>
                  </div>
                  {[
                    ['Home', true],
                    ['AI Chat', false],
                    ['Search', false],
                    ['Documents', false],
                    ['Risks', false],
                    ['Agents', false],
                  ].map(([label, active]) => (
                    <div
                      key={label as string}
                      className={cn(
                        'flex h-7 items-center gap-2 rounded-md pl-2 pr-3 text-[11px]',
                        active
                          ? 'sidebar-item active'
                          : 'text-muted-foreground'
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-primary' : 'bg-border')} />
                      {label}
                    </div>
                  ))}
                  <div className="mt-auto flex items-center gap-2 rounded-xl glass p-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full gradient-brand-soft text-[10px] font-semibold text-primary">
                      AR
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-medium text-foreground">Alex Rivera</p>
                      <p className="text-[9px] text-muted-foreground">Admin</p>
                    </div>
                  </div>
                </div>

                <div className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Thursday, August 29
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-foreground">Good day, Alex</p>
                    </div>
                    <div className="glass flex h-8 items-center gap-2 rounded-lg px-2.5 text-[11px] text-muted-foreground">
                      <MessageSquare className="h-3.5 w-3.5 text-primary" /> Ask the workspace
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {(
                      [
                        ['Q3 revenue', '$2.4M', '+12.4%', 'text-success'],
                        ['Active customers', '128', '+3.2%', 'text-success'],
                        ['At-risk accounts', '9', '-0.8%', 'text-warning'],
                        ['AI queries', '4,812', '+28%', 'text-success'],
                      ] as const
                    ).map(([label, val, change, tone]) => (
                      <div key={label} className="glass rounded-xl p-3">
                        <p className="text-[10px] text-muted-foreground">{label}</p>
                        <p className="mt-1 font-mono text-sm font-semibold tabular text-foreground">{val}</p>
                        <p className={cn('text-[10px] font-medium tabular', tone)}>{change}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-[1.2fr_1fr]">
                    <div className="glass rounded-xl p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-medium text-foreground">Revenue trend</p>
                        <p className="flex items-center gap-1 text-[10px] font-medium text-success">
                          <LineChart className="h-3 w-3" /> +18%
                        </p>
                      </div>
                      <div className="mt-3 flex h-24 items-end gap-1.5">
                        {BARS.map((h, i) => (
                          <div
                            key={i}
                            className="flex-1 rounded-t-[3px] bg-primary/15"
                            style={{ height: `${h}%` }}
                          >
                            <div
                              className={
                                i === BARS.length - 1
                                  ? 'h-full w-full rounded-t-[3px] gradient-brand'
                                  : 'h-full w-full rounded-t-[3px] bg-primary/40'
                              }
                            />
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex justify-between text-[9px] text-muted-foreground">
                        <span>Q2 '24</span><span>Q4 '24</span><span>Q2 '25</span><span>Q2 '26</span>
                      </div>
                    </div>

                    <div className="glass rounded-xl p-3">
                      <p className="text-[11px] font-medium text-foreground">AI chat</p>
                      <div className="mt-3 space-y-2">
                        <div className="ml-auto w-fit max-w-[85%] rounded-lg rounded-br-sm gradient-brand px-2.5 py-1.5 text-[10.5px]">
                          Which accounts are most at risk?
                        </div>
                        <div>
                          <div className="w-fit max-w-[92%] rounded-lg rounded-bl-sm border border-border bg-card px-2.5 py-1.5 text-[10.5px] leading-relaxed text-secondary-foreground">
                            3 accounts have churn risk &gt; 70%: Northwind, Meridian, and Atlas…
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-full border border-success/25 bg-success/10 px-2 py-0.5 text-[9px] font-medium text-success">
                              Confidence 84%
                            </span>
                            <span className="glass inline-flex items-center rounded-full px-2 py-0.5 text-[9px] text-muted-foreground">
                              6 sources
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating cards */}
          <div className="animate-float-y absolute -right-4 -top-8 hidden w-56 rounded-2xl glass-strong p-3.5 shadow-pop lg:block" style={{ animationDelay: '0.6s' }}>
            <div className="flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5 text-primary" />
              <p className="text-[11px] font-semibold text-foreground">Intelligence</p>
              <span className="ml-auto text-[10px] font-medium text-success">live</span>
            </div>
            <div className="mt-2.5 space-y-1.5">
              {['Risk signal: churn cluster', 'New doc indexed: strategy.pdf', '2 agents completed'].map((item, i) => (
                <p key={item} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="h-1 w-1 shrink-0 rounded-full gradient-brand" style={{ opacity: 1 - i * 0.25 }} />
                  {item}
                </p>
              ))}
            </div>
          </div>

          <div className="animate-float-y absolute -left-6 bottom-10 hidden w-44 rounded-2xl glass-strong p-3.5 shadow-pop lg:block" style={{ animationDelay: '1.4s' }}>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Query routed
            </p>
            <div className="mt-2.5 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>RAG agent</span><span className="font-medium text-success">done</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Risk agent</span><span className="font-medium text-success">done</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Web agent</span><span className="font-medium text-primary">working…</span>
            </div>
          </div>
        </Reveal>

        {/* Trust strip */}
        <Reveal delay={100} className="mt-16 w-full">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Trusted by teams that move on insight
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {COMPANIES.map((company) => (
              <span
                key={company}
                className="glass rounded-full px-4 py-1.5 text-[12.5px] font-semibold tracking-tight text-secondary-foreground"
              >
                {company}
              </span>
            ))}
          </div>
        </Reveal>

        {/* Stats band */}
        <div className="mt-12 grid w-full max-w-4xl grid-cols-2 gap-y-8 rounded-3xl glass-strong px-6 py-9 shadow-card sm:grid-cols-4 sm:py-10">
          {[
            { value: 4, suffix: '', label: 'product pillars' },
            { value: 11, suffix: '', label: 'specialist agents' },
            { value: 3, suffix: '', label: 'search modes' },
            { value: 2, suffix: 's', prefix: '<', label: 'to first answers' },
          ].map((stat, i) => (
            <div key={stat.label} className={cn('text-center', i > 0 && 'sm:border-l sm:border-border/60')}>
              <p className="font-mono text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                <span className="gradient-text">
                  {stat.prefix}
                  <CountUp value={stat.value} format={(n) => Math.round(n).toString()} />
                  {stat.suffix}
                </span>
              </p>
              <p className="mt-1.5 text-[11.5px] text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ Product: bento ============ */}
      <section id="product" className="relative">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <SectionHeading
            kicker="The platform"
            title={<>Four superpowers, <span className="gradient-text">one workspace</span></>}
            sub="Everything a modern team needs to turn internal knowledge into confident action."
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
            {/* AI Chat — large */}
            <Reveal className="md:col-span-4" delay={40}>
              <div className="group glass relative h-full overflow-hidden rounded-3xl p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-pop">
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl transition-opacity duration-300 group-hover:bg-primary/20" />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <GradientIcon icon={MessageSquare} />
                    <h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground">AI Chat</h3>
                    <p className="mt-1.5 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
                      Ask anything in plain language. Specialist agents collaborate in parallel and return one evidence-backed answer with sources you can verify.
                    </p>
                  </div>
                  <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">/01</Badge>
                </div>
                <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {['Multi-agent orchestration', 'Markdown, tables & code', 'Citations & confidence', 'Streaming answers'].map((pt) => (
                    <p key={pt} className="flex items-center gap-2 rounded-lg border border-border bg-card/40 px-3 py-2 text-[12.5px] text-secondary-foreground">
                      <Check className="h-3.5 w-3.5 shrink-0 text-success" /> {pt}
                    </p>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* Documents — small */}
            <Reveal className="md:col-span-2" delay={120}>
              <div className="group glass relative h-full overflow-hidden rounded-3xl p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-pop md:space-y-0">
                <GradientIcon icon={FileText} />
                <h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground">Documents</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
                  Upload PDFs, spreadsheets, CSV, and text — automatically chunked and indexed.
                </p>
                <div className="mt-5 flex items-center justify-between rounded-xl glass px-3 py-2.5">
                  <span className="text-[12px] text-muted-foreground">strategy.pdf</span>
                  <span className="flex items-center gap-1 text-[11px] font-medium text-success">
                    <Check className="h-3 w-3" /> indexed
                  </span>
                </div>
              </div>
            </Reveal>

            {/* Search — small */}
            <Reveal className="md:col-span-2" delay={40}>
              <div className="group glass relative h-full overflow-hidden rounded-3xl p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-pop">
                <GradientIcon icon={Search} />
                <h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground">Universal Search</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
                  One search across docs, data, the knowledge graph, and the web.
                </p>
                <div className="mt-5 flex items-center gap-2 rounded-xl border border-border bg-card/40 px-3 py-2.5">
                  <Search className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[12px] text-muted-foreground">impact summary for acme…</span>
                </div>
              </div>
            </Reveal>

            {/* Decision — large */}
            <Reveal className="md:col-span-4" delay={120}>
              <div className="group glass relative h-full overflow-hidden rounded-3xl p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-pop">
                <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl transition-opacity duration-300 group-hover:bg-accent/20" />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <GradientIcon icon={Scale} />
                    <h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground">Decision Intelligence</h3>
                    <p className="mt-1.5 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
                      Simulate strategic moves against budgets, department data, and risk tolerance — with a clear recommendation.
                    </p>
                  </div>
                  <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">/04</Badge>
                </div>
                <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {[
                    ['Opportunities', '2', 'text-success'],
                    ['Risks', '1', 'text-warning'],
                    ['Reward ratio', '3.2×', 'text-primary'],
                  ].map(([label, val, tone]) => (
                    <div key={label} className="rounded-xl border border-border bg-card/40 px-3.5 py-2.5">
                      <p className="text-[11px] text-muted-foreground">{label}</p>
                      <p className={cn('font-mono text-lg font-semibold tabular', tone)}>{val}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============ Highlights ============ */}
      <section className="relative">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2">
          <Reveal>
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Why teams choose Enterprise Intelligence Platform
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em] text-foreground sm:text-4xl">
              Built for the way teams actually work
            </h2>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
              Deep search is a convenience. Enterprise Intelligence Platform makes it the default — turning scattered spreadsheets, documents, and meetings into a single, queryable workspace.
            </p>
            <ul className="mt-7 space-y-3">
              {HIGHLIGHTS.map((h, i) => (
                <Reveal key={h} as="li" delay={i * 80}>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full gradient-brand">
                      <Check className="h-3 w-3" />
                    </span>
                    <span className="text-[14px] text-secondary-foreground">{h}</span>
                  </div>
                </Reveal>
              ))}
            </ul>
            <div className="mt-9">
              {isAuthenticated ? (
                <Button size="lg" onClick={() => navigate('/search-home')}>
                  Explore your workspace <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button size="lg" onClick={() => navigate('/register')}>
                  Get started free <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </Reveal>

          {/* Floating stack of product cards */}
          <div className="relative hidden lg:block">
            <div className="relative mx-auto flex h-[440px] max-w-md flex-col justify-center gap-4">
              <Reveal delay={40}>
                <div className="glass-strong ml-auto w-[85%] -rotate-1 rounded-2xl p-4 shadow-pop transition-transform duration-300 hover:rotate-0">
                  <p className="text-[12px] font-semibold text-foreground">“Which accounts are most at risk?”</p>
                  <div className="mt-3 rounded-xl border border-border bg-card/50 p-3">
                    <p className="text-[12px] leading-relaxed text-secondary-foreground">
                      3 accounts have churn risk &gt; 70% <span className="text-primary">·</span> 6 sources
                    </p>
                    <div className="mt-2 h-1.5 rounded-full bg-secondary">
                      <div className="confidence-bar w-[84%]" />
                    </div>
                  </div>
                </div>
              </Reveal>
              <Reveal delay={120}>
                <div className="glass-strong mr-auto w-[85%] rotate-1 rounded-2xl p-4 shadow-pop transition-transform duration-300 hover:rotate-0">
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
                    <Database className="h-3.5 w-3.5 text-primary" /> Entity · Acme Corporation
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[
                      ['Revenue', '$2.4M'],
                      ['Contracts', '3'],
                      ['Meetings', '4'],
                      ['Confidence', '94%'],
                    ].map(([label, val]) => (
                      <div key={label} className="rounded-lg border border-border bg-card/50 px-2.5 py-1.5">
                        <p className="text-[9.5px] uppercase tracking-wide text-muted-foreground">{label}</p>
                        <p className="font-mono text-[13px] font-medium tabular text-foreground">{val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
              <Reveal delay={200}>
                <div className="glass-strong mx-auto w-[80%] rounded-2xl p-4 shadow-pop">
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
                    <Scale className="h-3.5 w-3.5 text-primary" /> Decision · Expand south
                  </p>
                  <div className="mt-3 space-y-2">
                    {[['Opportunity score', 78], ['Risk exposure', 34]].map(([label, pct]) => (
                      <div key={label as string}>
                        <div className="flex justify-between text-[10.5px] text-muted-foreground">
                          <span>{label}</span><span className="tabular">{pct}%</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-secondary">
                          <div className="confidence-bar" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ============ How it works ============ */}
      <section id="how-it-works" className="relative">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <SectionHeading
            kicker="How it works"
            title={<>From question to decision, <span className="gradient-text">in seconds</span></>}
          />

          <div className="relative grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6">
            {/* Connector line */}
            <div className="pointer-events-none absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-primary/30 via-accent/30 to-primary/30 md:block" />
            <div className="pointer-events-none absolute bottom-0 left-8 top-8 w-px bg-gradient-to-b from-primary/30 via-accent/30 to-primary/30 md:hidden" />

            {STEPS.map((step, i) => (
              <Reveal key={step.title} delay={i * 120}>
                <div className="group relative h-full rounded-3xl glass p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-pop">
                  <div className="relative z-10 flex h-11 w-11 items-center justify-center rounded-2xl gradient-brand shadow-glow-sm">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-[16px] font-semibold tracking-tight text-foreground">{step.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{step.desc}</p>
                  <span className="absolute right-5 top-5 font-mono text-[11px] text-muted-foreground">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Testimonials ============ */}
      <section id="testimonials" className="relative">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <SectionHeading
            kicker="Customers"
            title={<>Loved by teams that <span className="gradient-text">move fast</span></>}
            sub="From strategy to operations, teams are getting answers in seconds instead of days."
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 110}>
                <figure className="group relative flex h-full flex-col rounded-3xl glass p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-pop">
                  <Quote className="h-6 w-6 text-primary/50" />
                  <blockquote className="mt-4 flex-1 text-[13.5px] leading-relaxed text-secondary-foreground">
                    “{t.quote}”
                  </blockquote>
                  <figcaption className="mt-6 flex items-center gap-3 border-t border-border/60 pt-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full gradient-brand text-[12px] font-semibold">
                      {t.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold text-foreground">{t.name}</p>
                      <p className="truncate text-[11.5px] text-muted-foreground">{t.role}</p>
                    </div>
                    <span className="flex gap-0.5 text-primary">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Star key={j} className="h-3 w-3 fill-current" />
                      ))}
                    </span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Security ============ */}
      <section id="security" className="relative">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2">
          <Reveal>
            <Badge variant="primary" className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Security & governance
            </Badge>
            <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-4xl">
              Enterprise-grade security, <span className="gradient-text">by design</span>
            </h2>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
              Role-based access control, audit logging, and isolated model execution keep your data yours. Every answer you get is backed by evidence you can verify.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {([
                ['RBAC & permissions', ShieldCheck],
                ['Audit logging', FileText],
                ['Evidence-based answers', Check],
                ['Isolated infrastructure', Globe],
              ] as Array<[string, React.ElementType]>).map(([label, Icon]) => (
                <span key={label} className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] text-secondary-foreground">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                  {label}
                </span>
              ))}
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="border-gradient rounded-3xl shadow-pop">
              <div className="rounded-[calc(1.5rem-1px)] bg-card/70 p-6">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  <Globe className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Universal search</p>
                  <Badge variant="muted" className="ml-auto">Acme Corporation</Badge>
                </div>
                <div className="mt-4 space-y-2.5">
                  <div className="flex items-center justify-between rounded-xl glass px-3.5 py-2.5">
                    <div>
                      <p className="text-[13px] font-medium text-foreground">Impact summary</p>
                      <p className="text-[11px] text-muted-foreground">Revenue · contracts · contacts · meetings</p>
                    </div>
                    <Database className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Revenue', val: '$2.4M' },
                      { label: 'Contracts', val: '3' },
                      { label: 'Meetings', val: '4' },
                      { label: 'Confidence', val: '94%' },
                    ].map((k) => (
                      <div key={k.label} className="glass rounded-lg px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{k.label}</p>
                        <p className="mt-0.5 font-mono text-sm font-medium text-foreground tabular">{k.val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className="relative">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
          <SectionHeading
            kicker="FAQ"
            title="Common questions"
            sub={
              <>
                Can't find what you're looking for?{' '}
                <Link to="/register" className="gradient-text font-medium hover:underline">Talk to us</Link>.
              </>
            }
          />
          <div className="space-y-2.5">
            {FAQS.map((f, i) => (
              <Reveal key={f.q} delay={i * 40}>
                <FaqItem {...f} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CTA panel ============ */}
      <section className="relative mx-auto max-w-6xl px-4 pb-24 pt-4 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-[28px] p-[1px]">
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(135deg, hsl(245 90% 60%), hsl(190 96% 52%))',
              }}
            />
            <div className="relative overflow-hidden rounded-[27px] bg-card/90 px-6 py-16 text-center sm:px-16 sm:py-20">
              {/* Inner atmosphere */}
              <div
                className="pointer-events-none absolute left-1/2 top-0 h-72 w-[560px] -translate-x-1/2 opacity-60"
                style={{
                  background:
                    'radial-gradient(closest-side, hsl(var(--glow-a) / 0.35), transparent 70%)',
                }}
              />
              <div className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-accent/20 blur-[80px]" />
              <div className="pointer-events-none absolute -bottom-24 -right-10 h-56 w-56 rounded-full bg-primary/20 blur-[80px]" />

              <div className="relative">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl gradient-brand shadow-glow-sm">
                  <Zap className="h-6 w-6" />
                </div>
                <h2 className="mx-auto mt-6 max-w-xl text-3xl font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-4xl">
                  Turn company knowledge into <span className="gradient-text">confident decisions</span>
                </h2>
                <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">
                  {isAuthenticated
                    ? 'Your workspace is ready — pick up right where you left off.'
                    : 'Create an account and get your first evidence-backed answer in minutes.'}
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Button size="lg" onClick={() => navigate(primary.to)}>
                    {primary.label} <ArrowRight className="h-4 w-4" />
                  </Button>
                  {!isAuthenticated && (
                    <Button size="lg" variant="outline" onClick={() => navigate('/login')}>
                      Sign in
                    </Button>
                  )}
                </div>
                {!isAuthenticated && (
                  <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <Command className="h-3.5 w-3.5" /> No credit card required · Set up in minutes
                  </p>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ============ Footer ============ */}
      <footer className="relative border-t border-border/70">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-6 px-4 py-10 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-brand">
              <Network className="h-3.5 w-3.5" />
            </div>
            <div>
              <span className="block text-[14px] font-semibold tracking-tight text-foreground">Enterprise Intelligence Platform</span>
              <span className="block text-[10.5px] text-muted-foreground">Enterprise Workspace</span>
            </div>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12.5px] text-muted-foreground" aria-label="Footer">
            <a href="#product" className="transition-colors hover:text-foreground">Product</a>
            <a href="#how-it-works" className="transition-colors hover:text-foreground">How it works</a>
            <a href="#testimonials" className="transition-colors hover:text-foreground">Customers</a>
            <a href="#faq" className="transition-colors hover:text-foreground">FAQ</a>
            <Link to="/register" className="transition-colors hover:text-foreground">Getting started</Link>
          </nav>

          <p className="text-[11.5px] text-muted-foreground">
            © {new Date().getFullYear()} Enterprise Intelligence Platform. Built for teams that move fast.
          </p>
        </div>
      </footer>
    </div>
  );
}