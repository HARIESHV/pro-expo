import { Request, Response } from 'express';
import { searchCompanies, resolveCompanyEntity, findCompanyById } from '../services/companySearchService';
import { ApiResponse } from '../types';

/** Clean a company record for the response (strip internals, cap fields). */
function serializeCompany(company: any) {
  return {
    id: String(company._id),
    legalName: company.legalName,
    displayName: company.displayName,
    aliases: company.aliases || [],
    category: company.category,
    ownership: company.ownership,
    industry: company.industry,
    subIndustry: company.subIndustry,
    description: company.description,
    foundedYear: company.foundedYear,
    founders: (company.founders || []).map((f: any) => ({ name: f.name, role: f.role })),
    headquarters: company.headquarters,
    countries: company.countries || [],
    website: company.website,
    officialDomains: company.officialDomains || [],
    parentCompanyName: company.parentCompanyName,
    subsidiaries: (company.subsidiaries || []).map((s: any) => s.name),
    brands: company.brands || [],
    competitors: company.competitors || [],
    employeeRange: company.employeeRange,
    revenue: company.revenue,
    marketCap: company.marketCap,
    stockTicker: company.stockTicker,
    stockExchange: company.stockExchange,
    products: (company.products || []).map((p: any) => p.name),
    services: company.services || [],
    technologies: company.technologies || [],
    leadership: (company.leadership || []).map((l: any) => ({ name: l.name, role: l.role })),
    careersUrl: company.careersUrl,
    dataConfidence: company.dataConfidence,
    status: company.status,
    lastVerifiedAt: company.lastVerifiedAt,
  };
}

export const companyController = {
  /** Search the universal company knowledge store (read-only). */
  async search(req: Request, res: Response): Promise<void> {
    const q = ((req.query.q as string) || '').trim();
    if (!q) {
      res.json({ success: true, data: { query: q, results: [], total: 0 } } as ApiResponse);
      return;
    }
    if (q.length > 200) {
      res.status(400).json({ success: false, message: 'Search query is too long (max 200 characters).' } as ApiResponse);
      return;
    }
    const limit = req.query.limit ? Math.min(Math.max(parseInt(String(req.query.limit), 10) || 10, 1), 20) : 10;
    const hits = await searchCompanies(q, { limit });
    res.json({
      success: true,
      data: {
        query: q,
        results: hits.map((h) => ({ matchedBy: h.matchedBy, company: serializeCompany(h.company) })),
        total: hits.length,
      },
    } as ApiResponse);
  },

  /** Resolve an entity name to its canonical company record (read-only). */
  async resolve(req: Request, res: Response): Promise<void> {
    const q = ((req.query.q as string) || '').trim();
    if (!q) {
      res.json({ success: true, data: { resolved: null } } as ApiResponse);
      return;
    }
    const resolved = await resolveCompanyEntity(q);
    res.json({ success: true, data: { resolved: resolved ? serializeCompany(resolved) : null } } as ApiResponse);
  },

  /** Get a single company by id (read-only). */
  async getById(req: Request, res: Response): Promise<void> {
    const company = await findCompanyById(req.params.id);
    if (!company) {
      res.status(404).json({ success: false, message: 'Company not found' } as ApiResponse);
      return;
    }
    res.json({ success: true, data: { company: serializeCompany(company) } } as ApiResponse);
  },
};