import mongoose from 'mongoose';
import { Query } from '../../models/Query';
import { RiskSignal } from '../types';

/**
 * AI Analysis risk analyzer.
 * Surfaces risks that were surfaced by the platform's AI analytics across
 * recent queries — reading the stored AI-generated risk statements and key
 * findings (no extra LLM call on every dashboard view). Signals are tagged
 * `ai_analysis` and carry evidence of why the AI believed the risk exists.
 */
export async function analyzeAiRisk(orgId: string, limit = 40): Promise<RiskSignal[]> {
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

  const seen = new Set<string>();
  queries.forEach((q) => {
    const result = (q.result as Record<string, unknown>) || {};
    const risks: string[] = Array.isArray(result.risks) ? result.risks as string[] : [];
    const keyFindings: string[] = Array.isArray(result.keyFindings) ? result.keyFindings as string[] : [];
    const recommendations: string[] = Array.isArray(result.recommendations) ? result.recommendations as string[] : [];

    const pool = [...risks, ...keyFindings].filter((s) => typeof s === 'string');
    pool.forEach((statement) => {
      const title = classifyAiRisk(statement);
      if (!title || seen.has(title)) return;
      seen.add(title);
      signals.push({
        sourceType: 'ai_analysis',
        sourceId: `ai::${q._id}`,
        signalType: 'ai_analysis',
        title,
        description: `AI analysis surfaced this risk: "${statement}".`,
        category: categoryForTitle(title),
        evidence: [
          { label: 'AI Analysis', detail: `"${statement}" (from query: "${(q.originalQuery || '').slice(0, 90)}")`, sourceId: q._id.toString(), sourceType: 'ai_analysis' },
        ],
        confidence: 0.5,
        probability: 45,
        impact: 60,
      });
    });

    // Also surface risk-related recommendations as potential strategic signals
    recommendations.forEach((rec) => {
      if (!/risk|concern|mitigat|vulnerab/i.test(rec)) return;
      const title = 'AI-flagged Strategic Risk';
      if (seen.has(title)) return;
      seen.add(title);
      signals.push({
        sourceType: 'ai_analysis',
        sourceId: `ai::rec::${q._id}`,
        signalType: 'ai_analysis',
        title,
        description: `AI flagged a strategic concern: "${rec}".`,
        category: 'Strategic',
        evidence: [
          { label: 'AI Analysis', detail: `Recommendation flag: "${rec}"`, sourceId: q._id.toString(), sourceType: 'ai_analysis' },
        ],
        confidence: 0.45,
        probability: 40,
        impact: 55,
      });
    });
  });

  return signals;
}

function classifyAiRisk(text: string): string | null {
  if (/revenue.*(declin|drop|miss|risk|target)/.test(text)) return 'Revenue Performance Risk';
  if (/churn|retention|customer.*(risk|leav|loss|concentrat)/.test(text)) return 'Customer Churn Risk';
  if (/competit|market\s*share/.test(text)) return 'Competitive Risk';
  if (/security|breach|vulnerab/.test(text)) return 'Security Risk';
  if (/compliance|regulat|legal/.test(text)) return 'Compliance Risk';
  if (/cash\s*flow|liquidity|profitab|cost\s*overrun/.test(text)) return 'Financial Risk';
  if (/operational|deliver|bottleneck|delay/.test(text)) return 'Operational Delivery Risk';
  if (/dependenc|supplier|vendor|third.party/.test(text)) return 'Supplier Dependency Risk';
  if (/resource|staffing|talent|skill|attrition/.test(text)) return 'Resource Risk';
  return null;
}

function categoryForTitle(title: string): string {
  if (/Revenue|Financial/.test(title)) return 'Financial';
  if (/Churn|Concentration|Satisfaction/.test(title)) return 'Customer';
  if (/Competitive/.test(title)) return 'Competitive';
  if (/Security/.test(title)) return 'Security';
  if (/Compliance/.test(title)) return 'Compliance';
  if (/Dependency|Supplier/.test(title)) return 'Dependency';
  if (/Resource/.test(title)) return 'Resource';
  return 'Operational';
}
