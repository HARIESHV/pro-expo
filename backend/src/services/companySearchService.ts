import { Company, ICompany, toNameKey } from '../models/Company';

export interface CompanySearchOptions {
  limit?: number;
}

export interface CompanySearchHit {
  company: ICompany;
  matchedBy: 'name' | 'alias' | 'domain' | 'ticker' | 'product' | 'industry' | 'text';
}

const MAX_RESULTS = 10;

/**
 * Resolve a raw query string to a company entity.
 *
 * Entity resolution order (cheap -> expensive, all index-backed, no full scan):
 *   1. Exact legal/display name match (nameKey)
 *   2. Exact alias match (aliases array)
 *   3. Official domain match (e.g. "google.com" -> Google)
 *   4. Stock ticker match (e.g. "TSLA" -> Tesla)
 *   5. Fuzzy/partial text match (search index)
 *
 * This keeps parent companies, subsidiaries, and brands distinct — e.g.
 * "Google" resolves to Google LLC, not Alphabet — while "Alphabet" resolves
 * to Alphabet Inc.
 */
export async function resolveCompanyEntity(rawQuery: string): Promise<ICompany | null> {
  const q = (rawQuery || '').trim();
  if (!q) return null;
  const key = toNameKey(q);
  if (!key) return null;

  // 1) Display / legal name
  const byName = await Company.findOne({ nameKey: key }).lean<ICompany>();
  if (byName) return byName;

  // 2) Alias
  const byAlias = await Company.findOne({ aliases: { $in: [q] } }).lean<ICompany>();
  if (byAlias) return byAlias;

  // 3) Official domain
  const domain = extractDomain(q);
  if (domain) {
    const byDomain = await Company.findOne({ officialDomains: domain }).lean<ICompany>();
    if (byDomain) return byDomain;
  }

  // 4) Stock ticker (uppercase 1-6 letters)
  const ticker = extractTicker(q);
  if (ticker) {
    const byTicker = await Company.findOne({ stockTicker: ticker }).lean<ICompany>();
    if (byTicker) return byTicker;
  }

  // 5) Partial text match — accept only a hit whose name-signals (display name,
  //    aliases, domains, ticker) share a distinctive token with the query. This
  //    prevents hallucinating an entity from a description-only keyword match
  //    (e.g. an unknown name resolving to Amazon because its description
  //    mentions "company" + "made").
  const tokens = q.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  if (tokens.length > 0) {
    const textMatch = await Company.find({ $text: { $search: q } })
      .sort({ dataConfidence: -1 })
      .limit(4)
      .lean() as unknown as Array<ICompany>;
    for (const c of textMatch) {
      const signals = [c.displayName, c.nameKey, c.stockTicker]
        .concat(c.aliases || [], c.officialDomains || [])
        .join(' ')
        .toLowerCase();
      if (tokens.some((t) => signals.includes(t))) return c;
    }
  }
  return null;
}

/**
 * Search the universal company store, returning ranked hits with the field
 * that matched. Used by the search endpoint and to disambiguate a query that
 * may refer to company + product/industry topics.
 */
export async function searchCompanies(query: string, opts: CompanySearchOptions = {}): Promise<CompanySearchHit[]> {
  const q = (query || '').trim();
  if (!q) return [];
  const limit = opts.limit || MAX_RESULTS;
  const key = toNameKey(q);
  const domain = extractDomain(q);
  const ticker = extractTicker(q);

  const results: ICompany[] = [];
  const add = async (finder: Promise<ICompany[]>) => {
    if (results.length >= limit) return;
    const arr = await finder;
    for (const c of arr) {
      if (results.length >= limit) return;
      if (!results.some((r) => String(r._id) === String(c._id))) results.push(c);
    }
  };

  // Ranked, deterministic passes
  if (key) await add(Company.find({ nameKey: key }).limit(limit).lean() as unknown as Promise<ICompany[]>); // exact rubric "name"
  if (domain) await add(Company.find({ officialDomains: domain }).limit(limit).lean() as unknown as Promise<ICompany[]>);
  if (ticker) await add(Company.find({ stockTicker: ticker }).limit(limit).lean() as unknown as Promise<ICompany[]>);
  if (q) await add(Company.find({ aliases: { $in: [q] } }).limit(limit).lean() as unknown as Promise<ICompany[]>);

  // Text search for partial / product / industry matches
  if (results.length < limit && q) {
    const text = await Company.find({ $text: { $search: q } })
      .sort({ dataConfidence: -1 })
      .limit(limit)
      .lean() as unknown as Array<ICompany>;
    for (const c of text) {
      if (results.length >= limit) break;
      if (!results.some((r) => String(r._id) === String(c._id))) results.push(c);
    }
  }

  // Natural-language priority: the raw text search is noisy for questions
  // ("who founded Google" tokenizes to stopwords/verbs). Pin the exact
  // extracted-entity match to the front whenever the query reads like a
  // question, so the precise company becomes the top hit.
  const name = extractCompanyName(q);
  if (name && name !== q) {
    const k = toNameKey(name);
    const exact = await Company.findOne({ nameKey: k }).lean<ICompany>();
    if (exact) {
      const exId = String(exact._id);
      const idx = results.findIndex((r) => String(r._id) === exId);
      if (idx > 0) results.splice(idx, 1);
      if (idx !== 0) results.unshift(exact);
    }
  }

  const hits: CompanySearchHit[] = results.map((company) => ({ company, matchedBy: 'text' }));
  // Assign the strongest matcher per hit. For natural-language queries the pin
  // source is the extracted entity name, not the raw question, so match that too.
  const nlName = (() => {
    const n = extractCompanyName(q);
    return n && n !== q ? n : null;
  })();
  const nlKey = nlName ? toNameKey(nlName) : null;
  for (const hit of hits) {
    const c = hit.company;
    const hitKey = toNameKey(c.displayName);
    if (key && hitKey === key) hit.matchedBy = 'name';
    else if (nlKey && hitKey === nlKey) hit.matchedBy = 'name';
    else if (domain && (c.officialDomains || []).includes(domain)) hit.matchedBy = 'domain';
    else if (ticker && c.stockTicker === ticker) hit.matchedBy = 'ticker';
    else if ((c.aliases || []).some((a) => a.toLowerCase() === q.toLowerCase())) hit.matchedBy = 'alias';
    else if (nlName && (c.aliases || []).some((a) => a.toLowerCase() === nlName.toLowerCase())) hit.matchedBy = 'alias';
  }
  return hits;
}

function extractDomain(q: string): string | null {
  const cleaned = q.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (/\.[a-z]{2,}$/.test(cleaned) && !cleaned.includes(' ')) {
    return cleaned.startsWith('www.') ? cleaned.slice(4) : cleaned;
  }
  return null;
}

function extractTicker(q: string): string | null {
  const cleaned = q.trim().toUpperCase().replace(/\.NS$|\.BSE$|\.KS$|\.HK$|\.F$|\.L$/, '');
  if (/^[A-Z]{1,6}$/.test(cleaned) && cleaned.length >= 2) return cleaned;
  return null;
}

export async function findCompanyById(id: string): Promise<ICompany | null> {
  if (!id) return null;
  return Company.findById(id).lean<ICompany>();
}

// Strip common natural-language question scaffolding so "who founded Google",
// "what does NVIDIA do", "tell me about Zoho" resolve to the entity name.
// Includes role words ("CEO of Microsoft" -> "Microsoft") and generic subjects.
const NL_STOP =
  /^(who|what|which|where|when|why|how|is|are|was|were|does|do|did|will|can|tell|me|about|of|on|the|a|an|give|info(rmation)?|all|many|their|its|created|founded|started|founded\s+by|led\s+by|run\s+by|ceo|ceos|founder|founders|co-?founder|co-?founders|president|presidents|chairman|chairperson|head|heads|chief|officer|officers|executive|executives|director|directors|board|management|leader|leaders|boss)\s+/i;

/** Reduce a raw user query to the most likely company name for resolution. */
export function extractCompanyName(rawQuery: string): string {
  let q = (rawQuery || '').trim();
  // Iteratively strip leading question/verb words.
  let prev = '';
  while (q !== prev) {
    prev = q;
    q = q.replace(NL_STOP, ' ').replace(/\s+/g, ' ').trim();
  }
  // Strip trailing verb/noun scaffolding ("do", "make", "company", "Inc", ...)
  q = q.replace(
    /(\s+(do|does|did|is|are|was|were|make|makes|making|company|organization|startup|firm|business|corporation|inc|llc|ltd|gmbh|sa|plc))$/i,
    ''
  ).trim();
  q = q.replace(/\?+$/, '').replace(/^[,:;\-–—]+/, '').replace(/\s*['’]s$/i, '').trim();
  return q;
}

/**
 * Resolve a raw, possibly natural-language query to a company. When the query
 * reads like a question ("who is the CEO of OpenAI"), resolve the clean
 * extracted entity name FIRST — the raw-text fallback on the full question is
 * noisy (Microsoft scores higher than OpenAI when both contain "CEO" + "OpenAI").
 * Plain "Google" queries resolve directly.
 */
export async function resolveCompanyEntityNL(rawQuery: string): Promise<ICompany | null> {
  const q = (rawQuery || '').trim();
  if (!q) return null;
  const name = extractCompanyName(q);

  // 1) NL detected: resolve the clean entity name first.
  if (name && name !== q) {
    const strict = await resolveCompanyEntity(name);
    if (strict) return strict;
  }

  // 2) Non-NL queries (or NL whose extraction didn't resolve) use the raw text.
  return resolveCompanyEntity(q);
}
