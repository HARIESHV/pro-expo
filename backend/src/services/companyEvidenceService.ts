import { ICompany } from '../models/Company';
import { extractCompanyName, resolveCompanyEntityNL, searchCompanies } from './companySearchService';

// ---------------------------------------------------------------------------
// Company evidence retrieval (RAG for company knowledge).
//
// Policy: NEVER send the whole company database to the AI. For a query we
// resolve the target entity/entities, fetch ONLY the relevant top-K records,
// and produce a compact, evidence-ranked blob for the model.
//
// Source priority (Tier 1 official > Tier 2 financial/regulatory > Tier 3
// reference > Tier 4 user). Only verified fields are passed; missing fields
// are omitted so the AI never invents them.
// ---------------------------------------------------------------------------

export interface CompanyEvidence {
  companies: ICompany[];
  resolved: string[];
  text: string;
}

const SOURCE_PRIORITY: Record<string, number> = {
  official: 1,
  regulation: 2,
  registry: 2,
  financial: 2,
  news: 3,
  reference: 3,
  user: 4,
};

function bucketLine(label: string, value?: string | number | null): string | null {
  if (value === undefined || value === null || value === '') return null;
  return `- ${label}: ${String(value)}`;
}

function renderCompany(c: ICompany): string {
  const lines: string[] = [`## ${c.displayName}${c.legalName && c.legalName !== c.displayName ? ` (${c.legalName})` : ''}`];

  const add = (label: string, value?: string | number | null) => {
    const l = bucketLine(label, value);
    if (l) lines.push(l);
  };

  add('Aliases', c.aliases?.join(', '));
  add('Category', c.category);
  add('Ownership', c.ownership);
  add('Industry', c.industry && c.subIndustry ? `${c.industry} / ${c.subIndustry}` : (c.industry || c.subIndustry));
  add('Description', c.description);
  add('Founded', c.foundedYear);
  add('Founders', c.founders?.map((f) => f.name).join(', '));
  if (c.headquarters) add('Headquarters', [c.headquarters.city, c.headquarters.state, c.headquarters.country].filter(Boolean).join(', '));
  add('Countries', c.countries?.join(', '));
  if (c.employeeRange) add('Employees', c.employeeRange.approx || (c.employeeRange.min && c.employeeRange.max ? `${c.employeeRange.min}-${c.employeeRange.max}` : undefined));
  if (c.revenue?.amount != null) add('Revenue', `${c.revenue.currency || 'USD'} ${Number(c.revenue.amount).toLocaleString('en-US')}${c.revenue.year ? ` (${c.revenue.year})` : ''}`);
  else if (c.revenue?.note) add('Revenue', c.revenue.note);
  if (c.marketCap?.amount != null) add('Market cap', `${c.marketCap.currency || 'USD'} ${Number(c.marketCap.amount).toLocaleString('en-US')}`);
  add('Stock', c.stockTicker && c.stockExchange ? `${c.stockTicker} (${c.stockExchange})` : (c.stockTicker || c.stockExchange));
  add('Website', c.website);
  add('Parent', c.parentCompanyName);
  const sub = c.subsidiaries?.map((s) => s.name).join(', ') || (c.brands?.length ? c.brands.join(', ') : undefined);
  add('Subsidiaries', sub);
  add('Products', c.products?.map((p) => p.name).join(', '));
  add('Services', c.services?.join(', '));
  add('Technologies', c.technologies?.join(', '));
  add('Competitors', c.competitors?.join(', '));
  add('Leadership', c.leadership?.map((l) => `${l.name}${l.role ? ` (${l.role})` : ''}`).join(', '));
  add('Status', c.status);
  add('Careers', c.careersUrl);
  add('Contact email', c.contactEmail);

  // Sources — prioritize official/regulatory
  const sources = (c.dataSources || []).concat(c.officialSources || []);
  const ranked = [...new Map(sources.map((s) => [s.title + (s.url || ''), s])).values()].sort(
    (a, b) => (SOURCE_PRIORITY[a.kind] ?? 5) - (SOURCE_PRIORITY[b.kind] ?? 5)
  );
  const topSources = ranked.slice(0, 4).map((s) => `  - ${s.title}${s.url ? ` (${s.url})` : ''}`);
  if (topSources.length) {
    lines.push('Sources:');
    lines.push(...topSources);
  }
  lines.push(`Data confidence: ${Math.round((c.dataConfidence || 0) * 100)}%`);
  if (c.lastVerifiedAt) lines.push(`Last verified: ${c.lastVerifiedAt.toISOString().slice(0, 10)}`);

  return lines.join('\n');
}

/**
 * Build compact, grounded evidence for a company-related query.
 * Resolves up to a handful of companies (e.g. for comparisons) without
 * pulling the whole database.
 */
export async function buildCompanyEvidence(query: string, limit = 3): Promise<CompanyEvidence> {
  const hits = await searchCompanies(query, { limit });
  const companies = hits.map((h) => h.company).slice(0, limit);
  const resolved = companies.map((c) => c.displayName);

  if (companies.length === 0) {
    return { companies: [], resolved: [], text: '' };
  }

  const blocks = companies.map((c) => renderCompany(c));
  const text = blocks.join('\n\n=================================\n\n');

  return { companies, resolved, text };
}

/**
 * Like buildCompanyEvidence but always returns at least the exact-resolution
 * result (used when the query clearly names a company). Falls back to the
 * generic evidence builder.
 */
export async function buildCompanyEvidenceFromQuery(rawQuery: string, limit = 3): Promise<CompanyEvidence> {
  const exact = await resolveCompanyEntityNL(rawQuery);
  if (exact) {
    const one = { companies: [exact], resolved: [exact.displayName], text: renderCompany(exact) };
    if (limit <= 1) return one;
    // Augment with competitors / related entities for richer, compared context.
    const related = await buildRelatedContext(exact, limit);
    if (related) {
      const companies = [exact, ...related.companies];
      const resolved = companies.map((c) => c.displayName);
      return { companies, resolved, text: companies.map(renderCompany).join('\n\n=================================\n\n') };
    }
    return one;
  }
  // No exact resolution. If the user clearly *named* a specific entity (mixed-
  // case tokens like "Contoso Rocketworks") that we couldn't resolve, return an
  // honest empty evidence so the agent says it can't confirm rather than
  // answering with an unrelated company's details. Lowercase intent queries
  // ("best crm companies") still get the generic top-match evidence.
  const name = extractCompanyName(rawQuery);
  const looksNamed = /\b[A-Z][a-z]+/.test(name || rawQuery);
  if (looksNamed) {
    return { companies: [], resolved: [], text: '' };
  }
  return buildCompanyEvidence(rawQuery, limit);
}

/** Optionally pull competitor / subsidiary records for comparison context. */
async function buildRelatedContext(exact: ICompany, limit: number): Promise<CompanyEvidence | null> {
  if (limit <= 1) return null;
  const names = (exact.competitors || [])
    .concat((exact.parentCompanyName ? [exact.parentCompanyName] : []))
    .concat((exact.subsidiaries || []).map((s: { name: string }) => s.name))
    .filter(Boolean);
  const extras: ICompany[] = [];
  for (const name of names.slice(0, limit - 1)) {
    if (extras.length >= limit - 1) break;
    const rel = await resolveCompanyEntityNL(name);
    if (rel && !extras.some((e) => String(e._id) === String(rel._id))) extras.push(rel);
  }
  if (extras.length === 0) return null;
  return { companies: extras, resolved: extras.map((c) => c.displayName), text: '' };
}
