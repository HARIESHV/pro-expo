import { NormalizedRisk, RiskSignal, RiskSeverity } from './types';
import { calcRiskScore, severityFromScore, clamp } from './ruleEngine';

/**
 * Produce a stable fingerprint for a risk signal so the same underlying issue
 * detected by several sources can be recognized as one risk.
 *
 * The fingerprint is derived from a normalized category + a normalized title
 * (stop-words removed) so e.g. "Revenue Decline Risk", "Revenue Risk",
 * "Low Revenue Risk" collapse to the same key when they share a category.
 */
const STOP_WORDS = new Set([
  'risk', 'the', 'a', 'an', 'of', 'for', 'in', 'on', 'to', 'and', 'or', 'is', 'are',
  'potential', 'possible', 'detected', 'observed', 'increasing', 'decreasing',
]);

export function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .sort()
    .join(' ');
}

export function fingerprintFor(category: string, title: string): string {
  const cat = (category || '').toLowerCase().trim();
  const norm = normalizeText(title);
  return `${cat}::${norm || 'unknown'}`;
}

/**
 * Merge a batch of signals into a single normalized risk.
 * Combines evidence, sources, and re-derives deterministic scores.
 */
export function mergeSignals(
  signals: RiskSignal[],
  category: string,
  title: string,
  confidence: number,
  impact: number,
  probability: number
): NormalizedRisk {
  const sources = [...new Set(signals.map((s) => s.sourceType))];
  const evidence = [...new Map(
    signals
      .flatMap((s) => s.evidence)
      .filter((e) => e && e.detail)
      .map((e) => [`${e.label}::${e.detail}`, e])
  ).values()];

  const mitigation = signals.map((s) => s.mitigation).find(Boolean) || defaultMitigation(category);
  const recommendations = [
    ...new Set(
      signals
        .flatMap((s) => (s.recommendation ? [s.recommendation] : []))
        .filter(Boolean)
    ),
  ];

  const p = clamp(probability, 1, 100);
  const i = clamp(impact, 1, 100);

  return {
    title,
    description:
      signals.map((s) => s.description).find(Boolean) ||
      `Potential ${category.toLowerCase()} risk detected from ${sources.join(', ')}.`,
    category,
    severity: severityFromScore(calcRiskScore(p, i)),
    probability: p,
    impact: i,
    riskScore: calcRiskScore(p, i),
    confidence,
    status: 'open',
    sources,
    evidence,
    mitigation,
    recommendations,
    fingerprint: fingerprintFor(category, title),
    detectedAt: new Date().toISOString(),
  };
}

export function severityFromOutput(impact: number, probability: number): RiskSeverity {
  return severityFromScore(calcRiskScore(probability, impact));
}

/**
 * Map an arbitrary (e.g. LLM-generated) risk title to a stable canonical title.
 * Free-form AI titles such as "Product X release delay affecting sales pipeline",
 * "Google is going to delay the release", or "Revenue declined 41.5% in Q2" all
 * collapse to the same canonical name so the SAME underlying issue produces the
 * SAME fingerprint across recalculation runs — guaranteeing dedup even when the
 * AI words things slightly differently each time.
 */
export function canonicalizeDocumentRiskTitle(raw: string): string {
  const t = (raw || '').toLowerCase().replace(/[^a-z0-9$.% ]/g, ' ');
  const has = (s: string | RegExp) => (s instanceof RegExp ? s.test(t) : t.includes(s));

  if (has('revenue') && has(/declin|drop|shortfall|miss|fall|decreas/)) return 'Revenue Decline Risk';
  if (has(/churn|retention/)) return 'Customer Churn Risk';
  if (has(/satisfaction/)) return 'Customer Satisfaction Risk';
  if (has(/loss\s+of\s+\$/) && has(/contract/)) return 'Competitive Risk';
  if (has(/competitor|competitiv|market\s*share/)) return 'Competitive Risk';
  if (has(/security|breach|unauthor|malware|ransom/)) return 'Security Risk';
  if (has(/personal\s*(data|identif)|pii|perjury|false\s*statement|liabil|expos/)) return 'Security Risk';
  if (has(/compliance|regulat|audit|legal/)) return 'Compliance Risk';
  if (has(/cash.?flow|liquidit|profitab|cost\s*overrun|financ/)) return 'Financial Risk';
  if (has(/integration/)) return 'Integration Risk';
  if (has(/delay|late|behind\s*schedule|milestone/)) return 'Product/Release Delay Risk';
  if (has(/sla|resolution|ticket/)) return 'Service Delivery Risk';
  if (has(/single\s*(point|employee|person|owner)/)) return 'Key-Person Dependency Risk';
  if (has(/dependenc|supplier|vendor|third.?party/)) return 'Third-Party Dependency Risk';
  if (has(/resource|staffing|capacity|talent|attrition/)) return 'Resource Risk';
  return 'Operational Risk';
}

const CANONICAL_CATEGORY: Record<string, string> = {
  'Revenue Decline Risk': 'Financial',
  'Customer Churn Risk': 'Customer',
  'Customer Satisfaction Risk': 'Customer',
  'Competitive Risk': 'Competitive',
  'Security Risk': 'Security',
  'Compliance Risk': 'Compliance',
  'Financial Risk': 'Financial',
  'Integration Risk': 'Operational',
  'Product/Release Delay Risk': 'Operational',
  'Service Delivery Risk': 'Operational',
  'Key-Person Dependency Risk': 'Dependency',
  'Third-Party Dependency Risk': 'Dependency',
  'Resource Risk': 'Resource',
  'Operational Risk': 'Operational',
};

export function categoryForCanonicalTitle(canonical: string): string {
  return CANONICAL_CATEGORY[canonical] || 'Operational';
}

export function defaultMitigation(category: string): string {
  const map: Record<string, string> = {
    Financial: 'Strengthen financial controls, review budgets, and set up periodic revenue monitoring.',
    Operational: 'Document operational workflows, add checkpoints, and assign owners to critical activities.',
    Strategic: 'Revalidate strategy assumptions and put in place a review cadence with stakeholders.',
    Compliance: 'Engage compliance/legal to review obligations and maintain an audit trail.',
    Customer: 'Proactively reach out to at-risk accounts and track satisfaction metrics.',
    Competitive: 'Monitor competitor activity and adapt positioning accordingly.',
    'Knowledge Graph': 'Review knowledge graph extraction quality and re-validate relationships.',
    'Data Quality': 'Review source coverage and confidence of extracted knowledge entities.',
    Security: 'Review access controls and apply security best practices.',
    Resource: 'Review resource allocation and capacity planning.',
    Dependency: 'Map dependencies and establish fallback suppliers or owners.',
    Technology: 'Review the technology stack for obsolescence and maintenance risk.',
  };
  return map[category] || 'Assign an owner and set up regular monitoring and review of this risk.';
}
