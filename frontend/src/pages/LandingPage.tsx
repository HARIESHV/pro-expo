import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import {
  ArrowRight, Check, ChevronDown, Command, Database, MessageSquare,
  Network, Play, Quote, Search, ShieldCheck, Sparkles, Star,
  BarChart3, Gauge, Brain, LayoutDashboard, Activity, Lock, FileText, Globe, Zap,
  Menu, X,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Kbd } from '../components/ui/misc';
import { Reveal, CountUp } from '../components/motion';
import { cn } from '../utils/cn';

/* ------------------------------------------------------------------ */
/* Content                                                              */
/* ------------------------------------------------------------------ */

const NAV_LINKS = [
  ['#home', 'Home', false],
  ['#features', 'Features', false],
  ['#about', 'About', false],
  ['/contact', 'Contact', true],
] as const;

const FEATURES = [
  {
    icon: Database,
    title: 'Data Integration',
    desc: 'Connect documents, spreadsheets, databases, and knowledge graphs in minutes — everything lands in one queryable workspace.',
    to: '/documents',
  },
  {
    icon: BarChart3,
    title: 'Advanced Analytics',
    desc: 'Revenue, sales, risk, and customer insights backed by real-time calculations and period-over-period comparisons.',
    to: '/analytics',
  },
  {
    icon: Brain,
    title: 'AI Insights',
    desc: 'Multi-agent AI answers plain-language questions with evidence, sources, and confidence scores you can verify.',
    to: '/chat',
  },
  {
    icon: LayoutDashboard,
    title: 'Custom Dashboards',
    desc: 'Executive, risk, and business-intelligence dashboards shaped around the metrics you care about most.',
    to: '/dashboard',
  },
  {
    icon: Activity,
    title: 'Real-Time Monitoring',
    desc: 'Live queries, indexing progress, and risk signals keep your team moving on the freshest possible data.',
    to: '/reports',
  },
  {
    icon: Lock,
    title: 'Enterprise Security',
    desc: 'Role-based access control, audit logging, and isolated infrastructure keep your data yours at all times.',
    to: '#about',
  },
];

const STEPS = [
  {
    icon: Sparkles,
    title: 'Sign Up',
    desc: 'Create your free account and get instant access to the Enterprise Intelligence workspace.',
    to: '/register',
  },
  {
    icon: Database,
    title: 'Connect Data',
    desc: 'Upload documents or connect data sources — chunked, embedded, and indexed automatically.',
    to: '/documents',
  },
  {
    icon: BarChart3,
    title: 'Analyze & Explore',
    desc: 'Ask questions, search everything, and explore dashboards backed by real, evidence-based answers.',
    to: '/analytics',
  },
  {
    icon: Zap,
    title: 'Make Better Decisions',
    desc: 'Turn insight into confident action with reports and business intelligence you can trust.',
    to: '/business-intelligence',
  },
];

const TESTIMONIALS = [
  {
    quote: 'Enterprise Intelligence replaced three tools for our team. Instead of digging through spreadsheets, we ask a question and get a sourced answer in seconds.',
    name: 'Priya Raghavan',
    role: 'VP Operations, Meridian Logistics',
    initials: 'PR',
  },
  {
    quote: 'Answers come back with real citations, so I trust what I read. It cut the time our analysts spend on research by nearly half.',
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
    q: 'Is my data secure?',
    a: 'Role-based access control, audit logging, and isolated infrastructure keep your data yours. Every answer is backed by evidence you can verify, and admins control exactly who can see what.',
  },
  {
    q: 'How long does it take to get started?',
    a: 'Create an account, upload a few documents, and you can run your first chat or search in under five minutes — no ML expertise or configuration required.',
  },
  {
    q: 'Can I try it before committing?',
    a: 'Yes. Register for a free account and explore the full workspace — chat, search, and dashboards — before you decide.',
  },
];

const COMPANIES = ['Meridian Logistics', 'Northwind Retail', 'Atlas Energy', 'Cobalt Health', 'Pioneer Bank'];

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-2xl border border-border bg-white px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-200 open:shadow-[0_8px_24px_-12px_rgba(16,24,40,0.14)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14.5px] font-semibold text-[#0b2545] marker:hidden">
        {q}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <p className="mt-3 text-[13.5px] leading-relaxed text-[#52637a]">{a}</p>
    </details>
  );
}

function SectionHeading({ kicker, title, sub }: { kicker: string; title: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#ff6b00]">
        <span className="h-1 w-1 rounded-full bg-[#ff6b00]" />
        {kicker}
        <span className="h-1 w-1 rounded-full bg-[#ff6b00]" />
      </p>
      <h2 className="mt-3 text-3xl font-bold tracking-[-0.02em] text-[#0b2545] sm:text-4xl">{title}</h2>
      {sub && <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[#52637a]">{sub}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const primary = isAuthenticated
    ? { label: 'Open workspace', to: '/dashboard' }
    : { label: 'Get started free', to: '/register' };

  return (
    <div className="landing-theme relative min-h-screen overflow-x-hidden bg-background font-sans text-foreground">
      {/* Decorative gradient washes */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] bg-gradient-to-b from-blue-50/70 via-white to-white" />
      <div className="pointer-events-none absolute -left-40 top-24 -z-10 h-96 w-96 rounded-full bg-orange-100/50 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-56 -z-10 h-96 w-96 rounded-full bg-blue-100/60 blur-3xl" />

      {/* ============ Floating nav ============ */}
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
        <div
          className={cn(
            'mx-auto flex h-12 max-w-6xl items-center gap-3 rounded-full border border-[#e6edf3] bg-white/85 px-3 pl-4 backdrop-blur-xl transition-shadow duration-300 sm:px-4',
            scrolled ? 'shadow-[0_16px_40px_-16px_rgba(11,37,69,0.22)]' : 'shadow-[0_1px_2px_rgba(16,24,40,0.04)]'
          )}
        >
          <button onClick={() => { window.scrollTo({ top: 0 }); navigate('/'); }} className="flex items-center gap-2.5" aria-label="Enterprise Intelligence Platform home">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ff6b00] shadow-[0_8px_16px_-8px_rgba(255,107,0,0.7)]">
              <Network className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="hidden text-[15px] font-bold tracking-tight text-[#0b2545] sm:block">Enterprise Intelligence</span>
            <span className="text-[15px] font-bold tracking-tight text-[#0b2545] sm:hidden">EIP</span>
          </button>

          <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Landing page">
            {NAV_LINKS.map(([href, label, isRoute]) =>
              isRoute ? (
                <Link
                  key={href}
                  to={href}
                  className="rounded-full px-3 py-1.5 text-[13px] font-medium text-[#52637a] transition-colors hover:bg-orange-50 hover:text-[#0b2545]"
                >
                  {label}
                </Link>
              ) : (
                <a
                  key={href}
                  href={href}
                  className="rounded-full px-3 py-1.5 text-[13px] font-medium text-[#52637a] transition-colors hover:bg-orange-50 hover:text-[#0b2545]"
                >
                  {label}
                </a>
              )
            )}
          </nav>

          <div className="flex-1" />

          {isAuthenticated ? (
            <Button size="sm" onClick={() => navigate('/dashboard')} className="hidden sm:inline-flex">
              {primary.label} <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate('/login')} className="hidden sm:inline-flex">
                Login
              </Button>
              <Button size="sm" onClick={() => navigate('/register')} className="hidden sm:inline-flex">
                Sign Up <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </>
          )}

          <button
            type="button"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e6edf3] bg-white text-[#0b2545] shadow-sm lg:hidden"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
        {mobileOpen && (
          <div className="mx-auto mt-2 max-w-6xl rounded-2xl border border-[#e6edf3] bg-white p-2 shadow-[0_16px_40px_-16px_rgba(11,37,69,0.22)] lg:hidden">
            <nav className="flex flex-col gap-1 p-1" aria-label="Mobile">
              {NAV_LINKS.map(([href, label, isRoute]) =>
                isRoute ? (
                  <Link
                    key={href}
                    to={href}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-xl px-3 py-2.5 text-[14px] font-medium text-[#0b2545] hover:bg-orange-50"
                  >
                    {label}
                  </Link>
                ) : (
                  <a
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-xl px-3 py-2.5 text-[14px] font-medium text-[#0b2545] hover:bg-orange-50"
                  >
                    {label}
                  </a>
                )
              )}
              <div className="my-1 border-t border-[#eef2f6]" />
              {isAuthenticated ? (
                <Button onClick={() => navigate('/dashboard')} className="w-full justify-center">
                  Open workspace <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => navigate('/login')} className="flex-1">
                    Login
                  </Button>
                  <Button onClick={() => navigate('/register')} className="flex-1">
                    Sign Up <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* ============ Hero ============ */}
      <section id="home" className="relative mx-auto flex w-full max-w-7xl flex-col items-center px-4 pb-20 pt-32 sm:px-6 lg:flex-row lg:items-center lg:gap-16 lg:pt-40">
        {/* Left: copy */}
        <div className="w-full max-w-2xl text-center lg:flex-1 lg:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200/70 bg-orange-50/70 px-3 py-1 text-xs font-medium text-[#c2410c]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute h-full w-full animate-ping rounded-full bg-[#ff6b00] opacity-60" />
              <span className="h-1.5 w-1.5 rounded-full bg-[#ff6b00]" />
            </span>
            The enterprise intelligence platform
          </div>

          <h1 className="mt-6 text-4xl font-bold leading-[1.06] tracking-[-0.03em] text-[#0b2545] sm:text-5xl lg:text-[54px]">
            Turn Your Data into{' '}
            <span className="bg-gradient-to-r from-[#ff6b00] to-[#ff9d45] bg-clip-text text-transparent">Real Insights</span>
          </h1>

          <p className="mx-auto mt-5 max-w-lg text-[16px] leading-relaxed text-[#52637a] lg:mx-0">
            Powerful analytics and real-time insights to help you grow, optimize, and lead. Ask questions,
            explore dashboards, and make data-driven decisions with confidence — everything backed by evidence.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
            <Button size="lg" onClick={() => navigate(primary.to)} className="px-6">
              {primary.label} <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('#demo')} className="px-6">
              <Play className="h-4 w-4 text-[#ff6b00]" /> Watch Demo
            </Button>
          </div>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-[#718096] lg:justify-start">
            No credit card required <span className="h-1 w-1 rounded-full bg-[#d3dce6]" />
            <Kbd>⌘K</Kbd> anywhere inside the workspace for instant search
          </p>
        </div>

        {/* Right: illustration */}
        <div id="demo" className="mt-16 w-full scroll-mt-28 lg:mt-0 lg:flex-1">
          <div className="relative mx-auto w-full max-w-[560px]">
            <div className="absolute -inset-8 rounded-[40px] bg-gradient-to-tr from-orange-100/70 via-transparent to-blue-100/70 blur-2xl" />
            <img
              src="/laptop.png"
              alt="Enterprise Intelligence Platform — laptop, cloud, analytics, and database illustration"
              className="relative w-full rounded-2xl shadow-[0_24px_60px_-24px_rgba(11,37,69,0.28)]"
            />
          </div>
        </div>
      </section>

      {/* ============ Trust strip + stats ============ */}
      <section className="border-y border-[#eef2f6] bg-white/60">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a99ac]">
            Trusted by teams that move on insight
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {COMPANIES.map((company) => (
              <span
                key={company}
                className="rounded-full border border-[#e6edf3] bg-white px-4 py-1.5 text-[12.5px] font-semibold tracking-tight text-[#40536e]"
              >
                {company}
              </span>
            ))}
          </div>
          <div className="mt-8 grid grid-cols-2 gap-y-8 py-2 sm:grid-cols-4">
            {[
              { value: 3, suffix: '', label: 'product pillars' },
              { value: 11, suffix: '', label: 'specialist agents' },
              { value: 3, suffix: '', label: 'search modes' },
              { value: 2, suffix: 's', prefix: '<', label: 'to first answers' },
            ].map((stat, i) => (
              <div key={stat.label} className={cn('text-center', i > 0 && 'sm:border-l sm:border-[#eef2f6]')}>
                <p className="font-mono text-3xl font-bold tracking-tight text-[#0b2545] sm:text-4xl">
                  <span className="bg-gradient-to-r from-[#ff6b00] to-[#ffb347] bg-clip-text text-transparent">
                    {stat.prefix}
                    <CountUp value={stat.value} format={(n) => Math.round(n).toString()} />
                    {stat.suffix}
                  </span>
                </p>
                <p className="mt-1.5 text-[11.5px] text-[#6b7d94]">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Features ============ */}
      <section id="features" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <SectionHeading
            kicker="Features"
            title={<>Everything you need to <span className="bg-gradient-to-r from-[#ff6b00] to-[#ff9d45] bg-clip-text text-transparent">lead with data</span></>}
            sub="Six pillars that turn raw enterprise data into decisions your whole team can trust."
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, i) => (
              <Reveal key={feature.title} delay={i * 60}>
                <div className="group flex h-full flex-col rounded-2xl border border-[#e6edf3] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-orange-200/80 hover:shadow-[0_20px_40px_-20px_rgba(11,37,69,0.24)]">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-400 text-white shadow-[0_10px_20px_-10px_rgba(255,107,0,0.7)] transition-transform duration-300 group-hover:scale-105">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-[16px] font-bold tracking-tight text-[#0b2545]">{feature.title}</h3>
                  <p className="mt-1.5 flex-1 text-[13.5px] leading-relaxed text-[#52637a]">{feature.desc}</p>
                  <a
                    href={feature.to}
                    onClick={(e) => {
                      if (feature.to.startsWith('#')) {
                        e.preventDefault();
                        document.querySelector(feature.to)?.scrollIntoView({ behavior: 'smooth' });
                        return;
                      }
                      navigate(feature.to);
                    }}
                    className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#ff6b00] hover:text-[#d95700]"
                  >
                    Explore {feature.title.split(' ')[0].toLowerCase()} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </a>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ How it works ============ */}
      <section id="how-it-works" className="scroll-mt-20 bg-gradient-to-b from-blue-50/50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <SectionHeading
            kicker="How it works"
            title={<>From sign up to <span className="bg-gradient-to-r from-[#ff6b00] to-[#ff9d45] bg-clip-text text-transparent">better decisions</span></>}
            sub="Four simple steps to start turning your data into real insights."
          />

          <div className="relative grid grid-cols-1 gap-6 md:grid-cols-4 md:gap-4">
            <div className="pointer-events-none absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-transparent via-orange-300 to-transparent md:block" />
            {STEPS.map((step, i) => (
              <Reveal key={step.title} delay={i * 120}>
                <button
                  onClick={() => navigate(step.to)}
                  className="group relative flex h-full w-full flex-col items-start rounded-2xl border border-[#e6edf3] bg-white p-6 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-blue-200/80 hover:shadow-[0_20px_40px_-20px_rgba(11,37,69,0.24)]"
                >
                  <div className="relative z-10 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-[0_10px_20px_-10px_rgba(37,99,235,0.7)]">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <span className="absolute right-5 top-5 font-mono text-[11px] font-bold text-[#b6c2cf]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-5 text-[15.5px] font-bold tracking-tight text-[#0b2545]">{step.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#52637a]">{step.desc}</p>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ About ============ */}
      <section id="about" className="scroll-mt-20 bg-gradient-to-b from-white to-blue-50/40">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2">
          <Reveal>
            <Badge variant="primary" className="gap-1.5 bg-orange-50 text-orange-600">
              <Globe className="h-3.5 w-3.5" /> About Enterprise Intelligence
            </Badge>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.02em] text-[#0b2545] sm:text-4xl">
              Purpose-built for the way teams make decisions today
            </h2>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-[#52637a]">
              Enterprise Intelligence connects your documents, data sources, and knowledge graph into one
              secure workspace. Ask questions in plain language, explore live dashboards, and back every
              decision with evidence you can verify.
            </p>
            <ul className="mt-7 space-y-3">
              {[
                'Answers with citations you can verify, every time',
                'Global ⌘K palette to open anything in two keystrokes',
                'Role-based permissions and full audit logging',
                'Works on any screen — phone, tablet, or desktop',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white">
                    <Check className="h-3 w-3" />
                  </span>
                  <span className="text-[14px] text-[#40536e]">{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              {isAuthenticated ? (
                <Button size="lg" onClick={() => navigate('/dashboard')}>
                  Explore your workspace <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button size="lg" onClick={() => navigate('/register')}>
                  Get started free <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              <Button size="lg" variant="outline" onClick={() => navigate('/login')}>
                Login
              </Button>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 130} className={cn(i === 0 && 'sm:-translate-y-3')}>
                <figure className="flex h-full flex-col rounded-2xl border border-[#e6edf3] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                  <Quote className="h-5 w-5 text-orange-400" />
                  <blockquote className="mt-3 flex-1 text-[13.5px] leading-relaxed text-[#40536e]">“{t.quote}”</blockquote>
                  <figcaption className="mt-5 flex items-center gap-3 border-t border-[#eef2f6] pt-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-400 text-[11px] font-bold text-white">
                      {t.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-[#0b2545]">{t.name}</p>
                      <p className="truncate text-[11px] text-[#718096]">{t.role}</p>
                    </div>
                    <span className="flex gap-0.5 text-[#ffb020]">
                      {Array.from({ length: 5 }).map((_, j) => <Star key={j} className="h-3 w-3 fill-current" />)}
                    </span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className="scroll-mt-20">
        <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
          <SectionHeading kicker="FAQ" title="Common questions" />
          <div className="space-y-2.5">
            {FAQS.map((f, i) => (
              <Reveal key={f.q} delay={i * 40}>
                <FaqItem {...f} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Contact / final CTA ============ */}
      <section id="contact" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <Reveal>
            <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0b2545] to-[#123a6b] px-6 py-16 text-center shadow-[0_30px_70px_-30px_rgba(11,37,69,0.6)] sm:px-16 sm:py-20">
              <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-orange-500/20 blur-[90px]" />
              <div className="pointer-events-none absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-blue-500/20 blur-[90px]" />
              <div className="relative">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ff6b00] shadow-[0_10px_20px_-8px_rgba(255,107,0,0.8)]">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <h2 className="mx-auto mt-6 max-w-xl text-3xl font-bold leading-tight tracking-[-0.02em] text-white sm:text-4xl">
                  Turn Your Data into Real Insights
                </h2>
                <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-blue-100/80">
                  {isAuthenticated
                    ? 'Your workspace is ready — pick up right where you left off.'
                    : 'Create an account and get your first evidence-backed answer in minutes.'}
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Button size="lg" className="bg-[#ff6b00] hover:bg-[#e85f00]" onClick={() => navigate(primary.to)}>
                    {primary.label} <ArrowRight className="h-4 w-4" />
                  </Button>
                  {!isAuthenticated && (
                    <Button size="lg" variant="outline" className="border-blue-300/40 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => navigate('/login')}>
                      Login
                    </Button>
                  )}
                </div>
                {!isAuthenticated && (
                  <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-blue-100/70">
                    <Command className="h-3.5 w-3.5" /> No credit card required · Set up in minutes
                  </p>
                )}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ Footer ============ */}
      <footer className="border-t border-[#eef2f6] bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ff6b00]">
                  <Network className="h-4 w-4 text-white" />
                </div>
                <div>
                  <span className="block text-[14px] font-bold tracking-tight text-[#0b2545]">Enterprise Intelligence</span>
                  <span className="block text-[10.5px] text-[#718096]">Data-Driven Decisions</span>
                </div>
              </div>
              <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-[#6b7d94]">
                Powerful analytics and real-time insights to help you grow, optimize, and lead — everything backed by evidence.
              </p>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0b2545]">Platform</p>
              <nav className="mt-3 flex flex-col items-start gap-2 text-[13px] text-[#52637a]" aria-label="Platform">
                <button onClick={() => navigate('/dashboard')} className="transition-colors hover:text-[#ff6b00]">Home Dashboard</button>
                <button onClick={() => navigate('/business-intelligence')} className="transition-colors hover:text-[#ff6b00]">Business Intelligence</button>
                <button onClick={() => navigate('/analytics')} className="transition-colors hover:text-[#ff6b00]">Analytics</button>
                <button onClick={() => navigate('/reports')} className="transition-colors hover:text-[#ff6b00]">Reports</button>
              </nav>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0b2545]">Resources</p>
              <nav className="mt-3 flex flex-col items-start gap-2 text-[13px] text-[#52637a]" aria-label="Resources">
                <button onClick={() => navigate('/documents')} className="transition-colors hover:text-[#ff6b00]">Data Sources</button>
                <button onClick={() => navigate('/chat')} className="transition-colors hover:text-[#ff6b00]">AI Insights</button>
                <a href="#features" className="transition-colors hover:text-[#ff6b00]">Features</a>
              </nav>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-[#eef2f6] pt-6 sm:flex-row">
            <p className="text-[11.5px] text-[#8a99ac]">
              © {new Date().getFullYear()} Enterprise Intelligence Platform. Built for teams that move fast.
            </p>
            <div className="flex items-center gap-4 text-[11.5px] text-[#8a99ac]">
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Enterprise secure</span>
              <span className="flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5 text-blue-500" /> 99.9% uptime</span>
              <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5 text-orange-500" /> Support</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}