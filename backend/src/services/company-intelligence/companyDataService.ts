import { Company, ICompany } from '../../models/Company';
import { resolveCompanyEntityNL } from '../companySearchService';
import { toNameKey } from '../../models/Company';
import { CompanyProfileLite, CompanyResolution } from '../../types/businessIntelligence';

// ===========================================================================
// companyDataService — resolves user-supplied company names against the
// connected company knowledge base and extracts ONLY real profile facts.
//
// This is the "Company Validation" + "Real-world Data Retrieval" step of the
// BI workflow. Nothing here is generated; everything returned is sourced from
// the stored Company records (real-world profiles curated with explicit data
// confidence + provenance).
// ===========================================================================

export function resolutionFor(query: string, company: ICompany | null): CompanyResolution {
  const clean = (query || '').trim();
  if (!company) {
    return {
      id: null,
      query: clean,
      nameKey: toNameKey(clean) || null,
      displayName: clean || 'Unknown',
      resolved: false,
      match: 'none',
    };
  }
  const signals = [company.displayName, company.legalName, company.stockTicker]
    .concat(company.aliases || [], company.officialDomains || [])
    .filter(Boolean)
    .join(' ');
  const lc = clean.toLowerCase();
  let match: CompanyResolution['match'] = 'text';
  if (toNameKey(company.displayName) === toNameKey(clean)) match = 'exact';
  else if ((company.aliases || []).some((a) => a.toLowerCase() === lc)) match = 'alias';
  else if ((company.officialDomains || []).some((d) => clean.includes(d))) match = 'domain';
  else if (company.stockTicker && company.stockTicker.toLowerCase() === lc) match = 'ticker';
  else if (signals.toLowerCase().includes(lc)) match = 'text';

  return {
    id: String(company._id),
    query: clean,
    nameKey: company.nameKey,
    displayName: company.displayName,
    legalName: company.legalName,
    resolved: true,
    match,
  };
}

function extractProfile(company: ICompany): CompanyProfileLite {
  return {
    displayName: company.displayName,
    legalName: company.legalName,
    aliases: company.aliases || [],
    industry: company.industry,
    subIndustry: company.subIndustry,
    description: company.description,
    foundedYear: company.foundedYear,
    founders: (company.founders || []).map((f) => ({ name: f.name, role: f.role })),
    headquarters: company.headquarters,
    countries: company.countries || [],
    region: company.headquarters?.region,
    website: company.website,
    parentCompanyName: company.parentCompanyName,
    subsidiaries: (company.subsidiaries || []).map((s) => s.name),
    brands: company.brands || [],
    competitors: company.competitors || [],
    employeeRange: company.employeeRange,
    stockTicker: company.stockTicker,
    stockExchange: company.stockExchange,
    products: (company.products || []).map((p) => ({ name: p.name, category: p.category })),
    services: company.services || [],
    technologies: company.technologies || [],
    leadership: (company.leadership || []).map((l) => ({ name: l.name, role: l.role })),
    dataConfidence: company.dataConfidence,
    status: company.status,
    revenue: company.revenue,
    marketCap: company.marketCap,
  };
}

export interface ResolvedCompany {
  resolution: CompanyResolution;
  company: ICompany | null;
  profile: CompanyProfileLite;
}

/**
 * Resolve a company name to its canonical knowledge-base record (real data).
 */
export async function resolveCompany(query: string): Promise<ResolvedCompany> {
  const clean = (query || '').trim();
  const company = await resolveCompanyEntityNL(clean);
  const resolution = resolutionFor(clean, company);
  return {
    resolution,
    company,
    profile: company ? extractProfile(company) : emptyProfile(clean),
  };
}

/** Profile used when a company is not in the connected knowledge base. */
function emptyProfile(displayName: string): CompanyProfileLite {
  return {
    displayName,
    aliases: [],
    founders: [],
    subsidiaries: [],
    brands: [],
    competitors: [],
    countries: [],
    products: [],
    services: [],
    technologies: [],
    leadership: [],
  };
}

export { Company };