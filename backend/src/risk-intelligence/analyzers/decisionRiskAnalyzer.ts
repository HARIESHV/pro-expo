import mongoose from 'mongoose';
import { Query } from '../../models/Query';
import { RiskSignal } from '../types';

/**
 * Decision Intelligence risk analyzer.
 * Evaluates persisted decision evaluations (from `/api/ai/evaluate-decision`)
 * and converts decision-specific risks (budget, staffing, implementation,
 * financial, timeline) into risk signals with deterministic probability/impact.
 * If a decision is re-evaluated, the new result supersedes the old one via the
 * risk engine's upsert-by-fingerprint.
 */
export async function analyzeDecisionRisk(orgId: string, limit = 20): Promise<RiskSignal[]> {
  const signals: RiskSignal[] = [];
  const oid = new mongoose.Types.ObjectId(orgId);

  let queries;
  try {
    queries = await Query.find({
      organizationId: oid,
      status: 'completed',
      $or: [
        { originalQuery: /^Evaluate decision:/i },
        { agentsUsed: 'executive' },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  } catch {
    return signals;
  }

  if (queries.length === 0) return signals;

  const seenTitle = new Set<string>();
  queries.forEach((q) => {
    const result = (q.result as Record<string, unknown>) || {};
    const decisionText = (q.originalQuery || '')
      .replace(/^Evaluate decision:\s*"/i, '')
      .replace(/"\s*\(Dept:.*$/i, '')
      .trim();

    const aiRisks: string[] = Array.isArray(result.risks) ? result.risks as string[] : [];
    const aiConfidence = typeof result.confidence === 'number' ? result.confidence : 0.4;
    const expectedImpact = typeof result.expectedImpact === 'string' ? result.expectedImpact : '';
    const budgetMatch = /budget[\s\S]{0,40}?(\$[\d,]+|\d+\s*[kmb]?)/i.test(expectedImpact);

    if (!decisionText) return;

    // ── Hiring/budget cost overrun risk ───────────────────────────────────
    if (/hire|recruit|staff|headcount|budget|invest/i.test(decisionText)) {
      // Derive probability from AI confidence + explicit budget mention
      const prob = Math.round(35 + aiConfidence * 25 + (budgetMatch ? 15 : 0));
      if (!seenTitle.has('Hiring Cost Overrun')) {
        seenTitle.add('Hiring Cost Overrun');
        signals.push({
          sourceType: 'decision_intelligence',
          sourceId: `decision::${q._id}`,
          signalType: 'decision_budget',
          title: 'Hiring Cost Overrun',
          description: `Decision "${decisionText}" involves hiring/staffing and may exceed budget. ${expectedImpact}`,
          category: 'Financial',
          evidence: [
            { label: 'Decision Intelligence evaluation', detail: `Decision: "${decisionText}". AI confidence ${Math.round(aiConfidence * 100)}%.`, sourceId: q._id.toString(), sourceType: 'decision_intelligence' },
          ],
          confidence: 0.5,
          probability: prob,
          impact: 68,
          recommendation: 'Run a detailed budget model and phase the hiring to control cost.',
          mitigation: 'Set a hard budget cap, approve hires in stages, and track spend monthly.',
        });
      }
      if (!seenTitle.has('Implementation Risk')) {
        seenTitle.add('Implementation Risk');
        signals.push({
          sourceType: 'decision_intelligence',
          sourceId: `decision::impl::${q._id}`,
          signalType: 'decision_implementation',
          title: 'Implementation Risk',
          description: `Executing decision "${decisionText}" carries implementation/timeline uncertainty. ${expectedImpact}`,
          category: 'Operational',
          evidence: [
            { label: 'Decision Intelligence evaluation', detail: `Decision "${decisionText}" — implementation risk.`, sourceId: q._id.toString(), sourceType: 'decision_intelligence' },
          ],
          confidence: 0.5,
          probability: 42,
          impact: 55,
          recommendation: 'Define a phased implementation plan with clear milestones and owners.',
        });
      }
    }

    // ── General decision risk derived from AI risk statements ─────────────
    aiRisks.forEach((r) => {
      const base = aiRiskTitle(r);
      if (!base || seenTitle.has(base)) return;
      seenTitle.add(base);
      signals.push({
        sourceType: 'decision_intelligence',
        sourceId: `decision::risk::${q._id}`,
        signalType: 'decision_ai',
        title: base,
        description: `Decision Intelligence flagged: "${r}".`,
        category: 'Strategic',
        evidence: [
          { label: 'Decision Intelligence evaluation', detail: `"${r}" (decision: "${decisionText}")`, sourceId: q._id.toString(), sourceType: 'decision_intelligence' },
        ],
        confidence: 0.45,
        probability: 40,
        impact: 60,
      });
    });
  });

  return signals;
}

function aiRiskTitle(text: string): string | null {
  if (/budget|cost|costly|expend/i.test(text)) return 'Decision Budget Risk';
  if (/timeline|delay|schedule|deadline/i.test(text)) return 'Decision Timeline Risk';
  if (/fail|risk|uncertain|volatile/i.test(text)) return 'Decision Execution Risk';
  return null;
}
