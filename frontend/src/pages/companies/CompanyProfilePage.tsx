import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Globe,
  MapPin,
  CalendarDays,
  Users as UsersIcon,
  TrendingUp,
  Layers,
  Boxes,
  Wrench,
  Link2,
  ShieldCheck,
  Ruler,
  Search,
} from 'lucide-react';
import { companyApi } from '../../api/companies';
import { CompanyProfile } from '../../types';
import { cn } from '../../utils/cn';
import { IconButton } from '../../components/ui/button';
import { Skeleton, EmptyState } from '../../components/ui/states';

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (!value || value === '') return null;
  return (
    <div>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">{label}</p>
      <p className="mt-0.5 text-[13px] text-secondary-foreground">{value}</p>
    </div>
  );
}

function formatMoney(
  v?: { amount?: number; currency?: string; year?: number; note?: string },
  fallback = ''
): string {
  if (!v) return fallback;
  if (v.amount == null) return v.note || fallback;
  const cur = v.currency || 'USD';
  const amt = Number(v.amount).toLocaleString('en-US', { maximumFractionDigits: 0 });
  return `${cur} ${amt}${v.year ? ` (${v.year})` : ''}`;
}

export default function CompanyProfilePage() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    companyApi
      .getById(companyId || '')
      .then((res) => {
        if (active && res.data.data) setCompany(res.data.data.company);
      })
      .catch((err) => {
        if (active) {
          const anyErr = err as { response?: { data?: { message?: string } }; message?: string };
          setError(anyErr.response?.data?.message || anyErr.message || 'Failed to load company');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [companyId]);

  const handleSearch = () => {
    const q = query.trim();
    if (!q) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6">
        <Skeleton className="h-6 w-56" />
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-6">
        <EmptyState
          icon={<Search className="h-4 w-4" />}
          title="Company not found"
          description={error || 'This company record is unavailable.'}
          action={
            <button
              onClick={() => navigate('/search-home')}
              className="mt-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Back to search
            </button>
          }
        />
      </div>
    );
  }

  const c = company;
  const hq = [c.headquarters?.city, c.headquarters?.state, c.headquarters?.country]
    .filter(Boolean)
    .join(', ');

  const sections: Array<{ label: string; value: string }> = [];
  if (c.industry) {
    sections.push({ label: 'Industry', value: c.subIndustry ? `${c.industry} / ${c.subIndustry}` : c.industry });
  }
  if (c.category) sections.push({ label: 'Category', value: c.category.replace(/_/g, ' ') });
  if (c.ownership) sections.push({ label: 'Ownership', value: c.ownership });
  if (c.foundedYear) sections.push({ label: 'Founded', value: String(c.foundedYear) });
  if (c.founders?.length) sections.push({ label: 'Founders', value: c.founders.map((f) => f.name).join(', ') });
  if (c.employeeRange) {
    const e = c.employeeRange;
    sections.push({
      label: 'Employees',
      value: e.approx || (e.min && e.max ? `${e.min}-${e.max}` : e.approx || ''),
    });
  }
  if (c.revenue) {
    const r = c.revenue;
    sections.push({ label: 'Revenue', value: formatMoney({ amount: r.amount, currency: r.currency, year: r.year, note: r.note }) });
  }
  if (c.marketCap?.amount) {
    sections.push({ label: 'Market cap', value: formatMoney(c.marketCap, '—') });
  }
  if (c.stockTicker) sections.push({ label: 'Stock', value: c.stockExchange ? `${c.stockTicker} (${c.stockExchange})` : c.stockTicker });
  if (c.parentCompanyName) sections.push({ label: 'Parent', value: c.parentCompanyName });
  if (c.status) sections.push({ label: 'Status', value: c.status });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      {/* Header bar */}
      <div className="mb-6 flex items-center gap-2">
        <IconButton variant="ghost" aria-label="Back" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </IconButton>
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-2 shadow-card focus-within:ring-2 focus-within:ring-ring/30">
          <Search className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search another company…"
            className="h-9 min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            onClick={handleSearch}
            disabled={!query.trim()}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:bg-primary/90 disabled:opacity-50"
          >
            Search
          </button>
        </div>
      </div>

      {/* Company header card */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card animate-fade-in-up">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
            <Building2 className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
              <span className="truncate">{c.displayName}</span>
              {c.legalName && c.legalName !== c.displayName && (
                <span className="text-[12.5px] font-normal text-muted-foreground">({c.legalName})</span>
              )}
            </h1>
            {c.aliases && c.aliases.length > 0 && (
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">Also known as: {c.aliases.join(', ')}</p>
            )}
            {c.description && (
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{c.description}</p>
            )}
          </div>
          {c.website && (
            <a
              href={c.website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              <Globe className="h-3.5 w-3.5" />
              Visit website
            </a>
          )}
        </div>

        {/* Quick facts */}
        <div className="grid grid-cols-1 gap-4 border-t border-border px-5 py-5 sm:grid-cols-2">
          {hq && (
            <div className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Headquarters</p>
                <p className="mt-0.5 text-[13px] text-secondary-foreground">{hq}</p>
              </div>
            </div>
          )}
          {c.headquarters?.region && (
            <div className="flex items-start gap-2.5">
              <UsersIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Region</p>
                <p className="mt-0.5 text-[13px] text-secondary-foreground">{c.headquarters.region}</p>
              </div>
            </div>
          )}
          {!hq && !c.headquarters?.region && (
            <div className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Countries</p>
                <p className="mt-0.5 text-[13px] text-secondary-foreground">{(c.countries || []).join(', ') || '—'}</p>
              </div>
            </div>
          )}
          {c.foundedYear ? (
            <div className="flex items-start gap-2.5">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Founded</p>
                <p className="mt-0.5 text-[13px] text-secondary-foreground">{c.foundedYear}</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Field grid */}
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 border-t border-border px-5 py-5 sm:grid-cols-2">
          {sections.map((s) => (
            <Field key={s.label} label={s.label} value={s.value} />
          ))}
          {sections.length === 0 && (
            <p className="text-[12.5px] text-muted-foreground">
              I couldn't find reliable information for additional fields.
            </p>
          )}
        </div>
      </div>

      {/* Products / services / tech */}
      {(c.products.length > 0 || c.services.length > 0 || c.technologies.length > 0) && (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3 animate-fade-in-up">
          {c.products.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="mb-2 flex items-center gap-2">
                <Boxes className="h-4 w-4 text-indigo-500" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Products</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {c.products.map((p) => (
                  <span key={p} className="rounded-full bg-secondary px-2 py-1 text-[11.5px] text-secondary-foreground">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}
          {c.services.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="mb-2 flex items-center gap-2">
                <Wrench className="h-4 w-4 text-teal-500" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Services</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {c.services.map((s) => (
                  <span key={s} className="rounded-full bg-secondary px-2 py-1 text-[11.5px] text-secondary-foreground">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {c.technologies.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="mb-2 flex items-center gap-2">
                <Ruler className="h-4 w-4 text-cyan-500" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Technologies</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {c.technologies.map((t) => (
                  <span key={t} className="rounded-full bg-secondary px-2 py-1 text-[11.5px] text-secondary-foreground">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Relationships */}
      {(c.brands.length > 0 || c.subsidiaries.length > 0 || c.competitors.length > 0 || c.leadership.length > 0) && (
        <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-card animate-fade-in-up">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {c.subsidiaries.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  <Layers className="h-3.5 w-3.5" /> Subsidiaries
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {c.subsidiaries.map((s) => (
                    <span key={s} className="rounded-full bg-secondary px-2 py-1 text-[11.5px] text-secondary-foreground">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {c.brands.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  <Boxes className="h-3.5 w-3.5" /> Brands
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {c.brands.map((b) => (
                    <span key={b} className="rounded-full bg-secondary px-2 py-1 text-[11.5px] text-secondary-foreground">{b}</span>
                  ))}
                </div>
              </div>
            )}
            {c.competitors.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" /> Competitors
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {c.competitors.map((x) => (
                    <span key={x} className="rounded-full bg-secondary px-2 py-1 text-[11.5px] text-secondary-foreground">{x}</span>
                  ))}
                </div>
              </div>
            )}
            {c.leadership.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  <UsersIcon className="h-3.5 w-3.5" /> Leadership
                </p>
                <ul className="space-y-1">
                  {c.leadership.map((l) => (
                    <li key={l.name} className="text-[13px] text-secondary-foreground">
                      {l.name}
                      {l.role ? <span className="text-muted-foreground"> · {l.role}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Provenance */}
      {c.careersUrl || c.dataConfidence ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-card animate-fade-in-up">
          <div className="flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground">
            {c.careersUrl && (
              <span className="inline-flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" />
                <a href={c.careersUrl} target="_blank" rel="noreferrer" className="underline decoration-muted-foreground/40 underline-offset-2 hover:text-foreground">
                  Careers
                </a>
              </span>
            )}
            {c.dataConfidence != null && (
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                Data confidence {Math.round(c.dataConfidence * 100)}%
              </span>
            )}
            {c.lastVerifiedAt && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                Last verified {new Date(c.lastVerifiedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}