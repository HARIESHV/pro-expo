import mongoose from 'mongoose';
import { Query } from '../../models/Query';
import { RiskSignal } from '../types';

/**
 * Universal Search risk analyzer.
 * Analyzes enterprise searches for risk-relevant topics. A search only becomes
 * a risk signal when (a) the query is risk-relevant AND (b) the search returned
 * matching evidence (i.e. there is something found to be concerned about).
 * Every signal is classified as evidence, not a confirmed risk.
 */
export async function analyzeSearchRisk(orgId: string, limit = 40): Promise<RiskSignal[]> {
  const signals: RiskSignal[] = [];
  const oid = new mongoose.Types.ObjectId(orgId);

  let queries;
  try {
    queries = await Query.find({ organizationId: oid, status: 'completed' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  } catch {
    return signals;
  }

  const probeRules: Array<{
    re: RegExp;
    title: string;
    category: string;
  }> = [
    { re: /customer\s*complaint|complaint|dissatisf/i, title: 'Customer Satisfaction Risk', category: 'Customer' },
    { re: /delayed?\s*project|project\s*(delay|behind)|missed\s*deadline/i, title: 'Operational Delivery Risk', category: 'Operational' },
    { re: /competitor\s*pricing|competit|pricing\s*change/i, title: 'Competitive Risk', category: 'Competitive' },
    { re: /revenue\s*(decline|target|risk)|sales\s*(decline|drop)|churn|retention/i, title: 'Revenue Performance Risk', category: 'Financial' },
    { re: /dependenc|supplier|vendor|third.party/i, title: 'Supplier Dependency Risk', category: 'Dependency' },
    { re: /security|breach|vulnerab|compliance|regulat/i, title: 'Compliance & Security Risk', category: 'Security' },
  ];

  const seen = new Set<string>();
  queries.forEach((q) => {
    const text = (q.originalQuery || '').trim();
    if (!text) return;

    for (const rule of probeRules) {
      if (!rule.re.test(text)) continue;
      // Only treat as a signal if there were results (evidence exists), so we
      // don't turn every search into a risk.
      const result = (q.result as Record<string, unknown>) || {};
      const sourceCount = Array.isArray(result.sources) ? result.sources.length : 0;
      if (sourceCount === 0) continue;
      if (seen.has(rule.title)) continue;
      seen.add(rule.title);

      signals.push({
        sourceType: 'universal_search',
        sourceId: `search::${q._id}`,
        signalType: 'search_evidence',
        title: rule.title,
        description: `Universal search for "${text}" returned ${sourceCount} matching result(s) relevant to ${rule.title.replace(/\sRisk$/, '').toLowerCase()}, suggesting underlying concern.`,
        category: rule.category,
        evidence: [
          { label: 'Universal Search', detail: `Query "${text}" returned ${sourceCount} relevant result(s).`, sourceId: q._id.toString(), sourceType: 'universal_search' },
        ],
        confidence: 0.5,
        probability: 40,
        impact: 55,
      });
      break;
    }
  });

  return signals;
}
