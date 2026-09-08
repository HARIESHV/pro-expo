import mongoose from 'mongoose';
import { Query } from '../../models/Query';
import { RiskSignal } from '../types';

/**
 * AI Chat risk analyzer.
 * Extracts risk signals from AI Chat conversations. User questions that probe
 * risk themes are treated as potential (not confirmed) risks; AI-generated
 * risk statements in assistant results are classified as observed/confirmed.
 * The original chat context is preserved via the query/conversation reference.
 */
export async function analyzeChatRisk(orgId: string, limit = 50): Promise<RiskSignal[]> {
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

  if (queries.length === 0) return signals;

  // ── Signals mined from user queries probing risk themes ────────────────
  const probeRules: Array<{
    re: RegExp;
    title: string;
    category: string;
    sourceId: string;
    sourceType: RiskSignal['sourceType'];
  }> = [
    { re: /charity|leaving|churn|retention|satisfaction|complaint/i, title: 'Customer Satisfaction Risk', category: 'Customer', sourceId: 'chat::customer', sourceType: 'chat' },
    { re: /operational|delayed?|behind|bottleneck|efficiency/i, title: 'Operational Delivery Risk', category: 'Operational', sourceId: 'chat::operational', sourceType: 'chat' },
    { re: /revenue\s*target|miss.*revenue|financial\s*(risk|problem)/i, title: 'Revenue Performance Risk', category: 'Financial', sourceId: 'chat::revenue', sourceType: 'chat' },
    { re: /competitor|pricing|market\s*(share|pressure)/i, title: 'Competitive Risk', category: 'Competitive', sourceId: 'chat::competitive', sourceType: 'chat' },
    { re: /cash\s*flow|liquidity|profitab|budget\s*overrun/i, title: 'Financial Risk', category: 'Financial', sourceId: 'chat::financial', sourceType: 'chat' },
    { re: /employee|staff|turnover|attrition|talent/i, title: 'Workforce Risk', category: 'Resource', sourceId: 'chat::workforce', sourceType: 'chat' },
    { re: /security|breach|compliance|regulat/i, title: 'Compliance & Security Risk', category: 'Security', sourceId: 'chat::security', sourceType: 'chat' },
    { re: /supplier|vendor|third.party|dependency/i, title: 'Supplier Dependency Risk', category: 'Dependency', sourceId: 'chat::dependency', sourceType: 'chat' },
  ];

  const seenProbes = new Set<string>();
  queries.forEach((q) => {
    const text = (q.originalQuery || '').trim();
    if (!text) return;
    for (const rule of probeRules) {
      if (rule.re.test(text)) {
        if (seenProbes.has(rule.title)) continue;
        seenProbes.add(rule.title);
        signals.push({
          sourceType: 'chat',
          sourceId: `${rule.sourceId}::${q._id}`,
          signalType: 'chat_potential',
          title: rule.title,
          description: `Users are probing "${rule.title.replace(/\sRisk$/, '').toLowerCase()}" in AI Chat (classified as potential, not confirmed). Query: "${text}".`,
          category: rule.category,
          evidence: [
            { label: 'AI Chat', detail: `Conversation query: "${text}"`, sourceId: q._id.toString(), sourceType: 'chat' },
          ],
          confidence: 0.45,
          probability: 40,
          impact: 55,
        });
        break;
      }
    }
  });

  // ── Signals from AI-provided risk statements in query results ──────────
  const seenAi = new Set<string>();
  queries.forEach((q) => {
    const result = (q.result as Record<string, unknown>) || {};
    const risks: string[] = Array.isArray(result.risks)
      ? result.risks as string[]
      : ((result.recommendations as string[]) || []).filter((r) => /risk|concern|mitigat|vulnerab/i.test(r));

    risks.forEach((r) => {
      const norm = r.toLowerCase();
      const title = classifyRiskStatement(norm);
      if (!title || seenAi.has(title)) return;
      seenAi.add(title);
      signals.push({
        sourceType: 'chat',
        sourceId: `chat::ai::${q._id}`,
        signalType: 'ai_chat_observed',
        title,
        description: `AI Chat analysis identified: "${r}". Classified as observed risk signal.`,
        category: categoryForTitle(title),
        evidence: [
          { label: 'AI Chat analysis', detail: `"${r}"`, sourceId: q._id.toString(), sourceType: 'chat' },
        ],
        confidence: 0.55,
        probability: 45,
        impact: 60,
      });
    });
  });

  return signals;
}

function classifyRiskStatement(text: string): string | null {
  if (/revenue.*(declin|drop|miss|risk)|financial.*(declin|risk)/.test(text)) return 'Revenue Performance Risk';
  if (/churn|retention|customer.*(risk|leav|loss)/.test(text)) return 'Customer Churn Risk';
  if (/concentration|depend.*(customer|client)/.test(text)) return 'Customer Concentration Risk';
  if (/competitor|market.*(share|risk)/.test(text)) return 'Competitive Risk';
  if (/security|breach|vulnerab/.test(text)) return 'Security Risk';
  if (/compliance|regulat/.test(text)) return 'Compliance Risk';
  if (/operational|deliver|bottleneck|delay/.test(text)) return 'Operational Delivery Risk';
  if (/dependency|supplier|vendor|third.party/.test(text)) return 'Supplier Dependency Risk';
  if (/resource|staffing|talent|skill/.test(text)) return 'Resource Risk';
  return 'Operational Risk';
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
