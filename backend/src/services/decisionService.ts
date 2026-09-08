import mongoose from 'mongoose';
import { Decision, IDecision, IDecisionMetric, IDecisionRelatedEntity } from '../models/Decision';
import { Query } from '../models/Query';
import { SalesRecord } from '../models/SalesRecord';
import { Risk } from '../models/Risk';
import { DocumentModel } from '../models/Document';
import { Department } from '../models/Department';
import { unifiedKnowledgeGraphService } from '../knowledge-graph/unifiedGraphService';
import { hybridRetrieval } from '../retrieval/hybridRetrieval';
import { openai, AI_MODEL } from '../config/openai';
import { logger } from '../config/logger';
import { AccessLevel } from '../types';

export interface DecisionEvaluationInput {
  decision: string;
  department?: string;
  budget?: string;
  riskTolerance?: 'Low' | 'Medium' | 'High';
}

export interface DecisionEvaluationResult {
  summary: string;
  opportunities: string[];
  risks: string[];
  expectedImpact: string;
  recommendation: string;
  confidence: number;
  rewardRatio: 'High' | 'Medium' | 'Low';
}

export interface DecisionListOptions {
  status?: string;
  department?: string;
  page?: number;
  limit?: number;
}

export interface DecisionInsightsOptions {
  from?: string;
  to?: string;
  department?: string;
}

export interface DecisionTrendPoint {
  year: number;
  month: number;
  label: string;
  revenue: number;
  count: number;
}

export interface DecisionForecast {
  points: Array<{ label: string; value: number }>;
  direction: 'up' | 'down' | 'flat';
  note: string;
}

export interface DecisionContextSnapshot {
  metrics: { label: string; value: string | number; _id?: string }[];
  risks: { title: string; level: string; _id?: string }[];
  documents: { documentId?: string; title: string; source?: string }[];
  relatedEntities: IDecisionRelatedEntity[];
}

const FALLBACK_RESULT = (input: DecisionEvaluationInput): DecisionEvaluationResult => ({
  summary:
    `We evaluated the proposed decision "${input.decision}" against available business context. ` +
    `No AI analysis could be completed at this time, so a cautious, conservative recommendation is provided. ` +
    `Re-run the simulator once the analytics service is available for a richer, data-grounded assessment.`,
  opportunities: ['Re-run with live analytics to surface specific opportunities related to this decision.'],
  risks: [
    `Proceeding without a validated analysis may expose the organization to unmitigated risk in ${input.department || 'the affected department'}.`,
  ],
  expectedImpact: `Budget considered: ${input.budget || 'not specified'}. Risk tolerance: ${input.riskTolerance || 'Medium'}. Impact could not be automatically quantified.`,
  recommendation: 'Insufficient data for a confident recommendation. Pilot the decision on a small scale and re-evaluate.',
  confidence: 0.35,
  rewardRatio: 'Medium',
});

/**
 * Gather the enterprise context a decision evaluation is grounded on. Every
 * source is defensive — a failure in any one degrades the context, never the
 * evaluation itself.
 */
export async function gatherDecisionContext(
  organizationId: string,
  decision: string,
  accessLevels: AccessLevel[],
  userId?: string,
  roles: string[] = ['analyst']
): Promise<DecisionContextSnapshot> {
  const snapshot: DecisionContextSnapshot = { metrics: [], risks: [], documents: [], relatedEntities: [] };

  try {
    const sales = await SalesRecord.aggregate([
      { $match: { organizationId: new mongoose.Types.ObjectId(organizationId) } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
    if (sales[0]?.total != null) {
      snapshot.metrics.push({ label: 'Total historic revenue', value: `$${Math.round(sales[0].total).toLocaleString()}` });
      snapshot.metrics.push({ label: 'Sales records', value: sales[0].count ?? 0 });
    }

    const activeRisks = await Risk.find({ organizationId, status: { $ne: 'resolved' } }).limit(5).lean();
    snapshot.risks = activeRisks.map((r) => ({ title: r.title, level: r.level, _id: String(r._id) }));
  } catch (e) {
    logger.warn('[DecisionService] Risk/metrics context error:', e);
  }

  try {
    const retrieval = await hybridRetrieval({
      organizationId,
      query: decision,
      accessLevels,
      topK: 3,
    });
    const seen = new Set<string>();
    snapshot.documents = retrieval.chunks
      .map((c) => ({
        documentId: c.metadata.documentId,
        title: c.metadata.source || 'Retrieved evidence',
        source: c.metadata.source,
      }))
      .filter((d) => {
        if (!d.documentId || seen.has(d.documentId)) return false;
        seen.add(d.documentId);
        return true;
      });
  } catch (e) {
    logger.warn('[DecisionService] Retrieval error:', e);
  }

  // Map any context risks into related knowledge-graph entities by title match.
  try {
    const graph = await unifiedKnowledgeGraphService.getGraph(organizationId, {
      userId: userId || 'system',
      roles,
      limit: 500,
    });
    const nodes = graph.data.nodes || [];
    const known = new Set(snapshot.risks.map((r) => r.title.toLowerCase()));
    for (const node of nodes) {
      if ((node.name || '').toLowerCase().split(' ').some((w) => w.length > 3 && known.has(w))) {
        snapshot.relatedEntities.push({ name: node.name, type: node.type, entityId: String(node.id || '') });
        if (snapshot.relatedEntities.length >= 4) break;
      }
    }
  } catch (e) {
    logger.warn('[DecisionService] Graph context error:', e);
  }

  return snapshot;
}

function buildContextPrompt(decision: string, department: string | undefined, budget: string | undefined, riskTolerance: string | undefined, snapshot: DecisionContextSnapshot): string {
  const metrics = snapshot.metrics.length
    ? snapshot.metrics.map((m) => `- ${m.label}: ${m.value}`).join('\n')
    : 'No business metrics available.';
  const risks = snapshot.risks.length
    ? snapshot.risks.map((r) => `- ${r.title} (${r.level})`).join('\n')
    : 'No active risks found.';
  const docs = snapshot.documents.length
    ? snapshot.documents.map((d) => `- ${d.title}`).join('\n')
    : 'No relevant documents found.';

  return `You are a strategic Decision Intelligence Agent. Evaluate the proposed business decision using the provided enterprise context.

Proposed Decision: "${decision}"
Associated Department: ${department || 'General'}
Estimated Budget Impact: ${budget || 'Not specified'}
Risk Tolerance Level: ${riskTolerance || 'Medium'}

--- ENTERPRISE CONTEXT ---
Document Evidence:
${docs}

Business Metrics:
${metrics}

Active Operational Risks:
${risks}
-------------------------

Analyze the proposal and respond ONLY with valid JSON matching this schema:
{
  "summary": "A concise strategic overview of the decision and its trade-offs.",
  "opportunities": ["Opportunity/pro 1", "Opportunity/pro 2", "Opportunity/pro 3"],
  "risks": ["Risk/cons 1", "Risk/cons 2", "Risk/cons 3"],
  "expectedImpact": "Short paragraph describing the estimated operational and financial impact, referencing the budget.",
  "recommendation": "A clear recommendation (Proceed / Modify / Reject) with one-line justification.",
  "confidence": 0.85,
  "rewardRatio": "High|Medium|Low"
}`;
}

function normalizeResult(raw: Record<string, unknown>, fallback: DecisionEvaluationResult): DecisionEvaluationResult {
  return {
    summary: typeof raw.summary === 'string' ? raw.summary : fallback.summary,
    opportunities: Array.isArray(raw.opportunities) ? (raw.opportunities as string[]) : [],
    risks: Array.isArray(raw.risks) ? (raw.risks as string[]) : [],
    expectedImpact: typeof raw.expectedImpact === 'string' ? raw.expectedImpact : fallback.expectedImpact,
    recommendation: typeof raw.recommendation === 'string' ? raw.recommendation : fallback.recommendation,
    confidence: Math.min(Math.max(Number(raw.confidence) || 0, 0), 1),
    rewardRatio: ['High', 'Medium', 'Low'].includes(raw.rewardRatio as string)
      ? (raw.rewardRatio as DecisionEvaluationResult['rewardRatio'])
      : (fallback.rewardRatio as 'High' | 'Medium' | 'Low'),
  };
}

/**
 * Evaluate a proposed decision against live enterprise context (documents,
 * metrics, risks) and persist both an AI Query record and a Decision entry.
 * Always returns a normalized result — AI failure degrades to a conservative
 * fallback, never a crash.
 */
export async function evaluateDecision(
  orgId: string,
  userId: string,
  input: DecisionEvaluationInput,
  opts: { accessLevels?: AccessLevel[]; roles?: string[] } = {}
): Promise<DecisionEvaluationResult> {
  const fallback = FALLBACK_RESULT(input);
  let result: DecisionEvaluationResult = fallback;
  const snapshot = await gatherDecisionContext(
    orgId,
    input.decision,
    opts.accessLevels || (['public', 'internal', 'confidential'] as AccessLevel[]),
    userId,
    opts.roles || ['analyst']
  );

  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: 'You are an executive board strategic advisor.' },
        {
          role: 'user',
          content: buildContextPrompt(input.decision, input.department, input.budget, input.riskTolerance, snapshot),
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_completion_tokens: 900,
    });
    const raw = JSON.parse(response.choices[0].message.content || '{}') as Record<string, unknown>;
    result = normalizeResult(raw, fallback);
  } catch (err) {
    logger.error('[DecisionService] AI evaluation failed, using deterministic fallback:', err);
    result = fallback;
  }

  const title = input.decision.length > 96 ? `${input.decision.slice(0, 96).trim()}…` : input.decision.trim();

  const supportingMetrics: IDecisionMetric[] = snapshot.metrics.map((m) => ({
    label: m.label,
    value: typeof m.value === 'number' && !Number.isInteger(m.value) ? Number(m.value.toFixed(2)) : m.value,
  }));

  const decisionDoc = await Decision.create({
    organizationId: new mongoose.Types.ObjectId(orgId),
    createdBy: new mongoose.Types.ObjectId(userId),
    title,
    decision: input.decision.trim(),
    category: 'strategy',
    department: input.department,
    budget: input.budget,
    riskTolerance: input.riskTolerance,
    status: 'evaluated',
    priority: result.confidence >= 0.7 ? 'high' : result.confidence >= 0.45 ? 'medium' : 'low',
    summary: result.summary,
    opportunities: result.opportunities,
    risks: result.risks,
    expectedImpact: result.expectedImpact,
    recommendation: result.recommendation,
    confidence: result.confidence,
    rewardRatio: result.rewardRatio,
    supportingMetrics,
    supportingDocuments: snapshot.documents,
    relatedEntities: snapshot.relatedEntities,
    scenarios: [],
    evaluatedAt: new Date(),
    tags: ['evaluated', input.department || 'general'],
  });

  try {
    await Query.create({
      conversationId: new mongoose.Types.ObjectId(),
      userId: new mongoose.Types.ObjectId(userId),
      organizationId: new mongoose.Types.ObjectId(orgId),
      originalQuery: `Evaluate decision: "${input.decision}" (Dept: ${input.department || 'General'}, Budget: ${input.budget || 'N/A'}, Risk: ${input.riskTolerance || 'Medium'})`,
      status: 'completed',
      agentsUsed: ['executive'],
      result: { ...result, decisionId: String(decisionDoc._id) },
    });
  } catch (e) {
    logger.warn('[DecisionService] Failed to persist query record:', e);
  }

  try {
    const { riskIntelligenceService } = await import('../risk-intelligence/riskIntelligenceService');
    riskIntelligenceService.refreshAsync(orgId);
  } catch (e) {
    // non-blocking
  }

  return result;
}

export async function listDecisions(orgId: string, opts: DecisionListOptions = {}) {
  const page = Math.max(1, opts.page || 1);
  const limit = Math.min(50, Math.max(1, opts.limit || 20));
  const filter: Record<string, unknown> = { organizationId: new mongoose.Types.ObjectId(orgId) };
  if (opts.status) filter.status = opts.status;
  if (opts.department) filter.department = opts.department;

  const [documents, total] = await Promise.all([
    Decision.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Decision.countDocuments(filter),
  ]);
  return { decisions: documents, total, page, limit };
}

export async function getDecision(orgId: string, id: string): Promise<IDecision | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  return Decision.findOne({ _id: id, organizationId: orgId }).lean<IDecision>();
}

export async function createDecision(orgId: string, userId: string, data: Partial<IDecision>): Promise<IDecision> {
  const doc = await Decision.create({
    organizationId: new mongoose.Types.ObjectId(orgId),
    createdBy: new mongoose.Types.ObjectId(userId),
    title: data.title || 'Untitled decision',
    decision: data.decision || data.title || '',
    category: data.category || 'strategy',
    department: data.department,
    budget: data.budget,
    riskTolerance: data.riskTolerance,
    status: data.status || 'draft',
    priority: data.priority || 'medium',
    impact: data.impact,
    owner: data.owner,
    summary: data.summary,
    opportunities: data.opportunities || [],
    risks: data.risks || [],
    expectedImpact: data.expectedImpact,
    recommendation: data.recommendation,
    confidence: data.confidence ?? 0,
    rewardRatio: data.rewardRatio,
    scenarios: data.scenarios || [],
    supportingMetrics: data.supportingMetrics || [],
    supportingDocuments: data.supportingDocuments || [],
    relatedEntities: data.relatedEntities || [],
    expectedOutcome: data.expectedOutcome,
    actualOutcome: data.actualOutcome,
    tags: data.tags || [],
  });
  return doc.toObject();
}

export async function updateDecision(orgId: string, id: string, updates: Partial<IDecision>): Promise<IDecision | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  const allowed = [
    'title', 'category', 'department', 'status', 'priority', 'impact', 'owner',
    'summary', 'opportunities', 'risks', 'expectedImpact', 'recommendation',
    'confidence', 'rewardRatio', 'scenarios', 'supportingMetrics',
    'supportingDocuments', 'relatedEntities', 'expectedOutcome', 'actualOutcome', 'tags',
  ];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (updates[key as keyof Partial<IDecision>] !== undefined) patch[key] = updates[key as keyof Partial<IDecision>];
  }
  return Decision.findOneAndUpdate({ _id: id, organizationId: orgId }, patch, { new: true }).lean<IDecision>();
}

export async function deleteDecision(orgId: string, id: string): Promise<boolean> {
  if (!mongoose.isValidObjectId(id)) return false;
  const res = await Decision.deleteOne({ _id: id, organizationId: orgId });
  return res.deletedCount > 0;
}

/**
 * Synthesize AI-generated recommended actions from the current risk posture
 * and business metrics. Falls back to a deterministic aggregation when the AI
 * provider is unavailable, so the endpoint never fails.
 */
export async function getDecisionRecommendations(orgId: string): Promise<string[]> {
  let risksText = 'No active risks.';
  let metricsText = 'No business metrics available.';
  try {
    const risks = await Risk.find({ organizationId: orgId, status: { $ne: 'resolved' } }).sort({ riskScore: -1 }).limit(6).lean();
    if (risks.length) risksText = risks.map((r) => `- ${r.title} (${r.level}, score ${r.riskScore})`).join('\n');
  } catch (e) { /* non-blocking */ }
  try {
    const sales = await SalesRecord.aggregate([
      { $match: { organizationId: new mongoose.Types.ObjectId(orgId) } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
    if (sales[0]?.total != null) metricsText = `Total historic revenue $${Math.round(sales[0].total).toLocaleString()} across ${sales[0].count ?? 0} sales records.`;
  } catch (e) { /* non-blocking */ }

  const fallback = [
    `Mitigate the highest-scoring active risk (${risksText.split('\n')[0]?.replace(/^- /, '') || 'no active risk identified'}) before committing new budget.`,
    'Validate the decision with a small-scale pilot before full rollout.',
    'Re-run the evaluation once additional sales and document evidence is ingested for a stronger confidence read.',
  ];

  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: 'You are a concise strategic advisor. Respond with a JSON array of exactly 3 recommended actions, each a single sentence.' },
        {
          role: 'user',
          content: `Given the current enterprise state, recommend 3 concrete actions for leadership.\n\nCurrent risks:\n${risksText}\n\nBusiness metrics:\n${metricsText}\n\nRespond ONLY with a JSON array of strings.`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_completion_tokens: 400,
    });
    const raw = JSON.parse(response.choices[0].message.content || '{}') as { recommendations?: unknown };
    if (Array.isArray(raw.recommendations) && raw.recommendations.length) {
      return raw.recommendations.filter((r): r is string => typeof r === 'string').slice(0, 5);
    }
  } catch (err) {
    logger.warn('[DecisionService] AI recommendations failed, using deterministic fallback:', err);
  }
  return fallback;
}

/** Aggregate the DI-focused sales analytics (totals + monthly trend) for filters. */
async function getSalesAnalytics(orgId: string, opts: DecisionInsightsOptions) {
  const range = parseDateRange(opts.from, opts.to);
  const departmentId = await resolveDepartmentId(orgId, opts.department);
  const match: Record<string, unknown> = { organizationId: new mongoose.Types.ObjectId(orgId) };
  if (departmentId) match.departmentId = departmentId;

  const createdAt: Record<string, Date> = {};
  if (range.from) createdAt.$gte = range.from;
  if (range.to) createdAt.$lte = range.to;
  if (Object.keys(createdAt).length) match.createdAt = createdAt;

  try {
    const monthly = await SalesRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: { year: '$period.year', month: '$period.month' },
          revenue: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const totals = monthly.reduce(
      (acc, m) => ({ revenue: acc.revenue + (m.revenue || 0), count: acc.count + (m.count || 0) }),
      { revenue: 0, count: 0 }
    );

    const trend: DecisionTrendPoint[] = monthly.map((m) => ({
      year: m._id.year,
      month: m._id.month,
      label: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`,
      revenue: m.revenue || 0,
      count: m.count || 0,
    }));

    return { totals, trend };
  } catch (e) {
    logger.warn('[DecisionService] Sales analytics error:', e);
    return { totals: { revenue: 0, count: 0 }, trend: [] as DecisionTrendPoint[] };
  }
}

function parseDateRange(from?: string, to?: string): { from?: Date; to?: Date } {
  const range: { from?: Date; to?: Date } = {};
  if (from && Number.isFinite(Date.parse(from))) range.from = new Date(from);
  if (to && Number.isFinite(Date.parse(to))) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    range.to = end;
  }
  return range;
}

async function resolveDepartmentId(orgId: string, name?: string): Promise<mongoose.Types.ObjectId | null> {
  if (!name || !name.trim()) return null;
  try {
    const dept = await Department.findOne({ organizationId: orgId, name: name.trim() }).lean();
    return dept ? dept._id : null;
  } catch (e) {
    logger.warn('[DecisionService] Department lookup error:', e);
    return null;
  }
}

/** Simple linear-regression projection of the next 3 months from a monthly trend. */
function buildForecast(trend: DecisionTrendPoint[]): DecisionForecast {
  const n = trend.length;
  const empty: DecisionForecast = {
    points: [],
    direction: 'flat',
    note: 'Not enough historical data for a reliable forecast.',
  };
  if (n < 2) return empty;

  const xs = trend.map((_, i) => i);
  const ys = trend.map((t) => t.revenue);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  const denom = xs.reduce((s, x) => s + (x - meanX) ** 2, 0);
  if (denom === 0) return empty;
  const slope = xs.reduce((s, x, i) => s + (x - meanX) * (ys[i] - meanY), 0) / denom;
  const intercept = meanY - slope * meanX;

  const points: Array<{ label: string; value: number }> = [];
  let y = trend[n - 1].year;
  let m = trend[n - 1].month;
  for (let k = 1; k <= 3; k++) {
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    const value = Math.max(0, Math.round(intercept + slope * (n - 1 + k)));
    points.push({ label: `${y}-${String(m).padStart(2, '0')}`, value });
  }

  const spread = Math.abs(meanY) || 1;
  const direction: DecisionForecast['direction'] =
    Math.abs(slope) * n <= spread * 0.03 ? 'flat' : slope > 0 ? 'up' : 'down';
  const note =
    direction === 'flat'
      ? 'Revenue is expected to remain steady over the next quarter.'
      : direction === 'up'
        ? 'A positive trend is projected — plan for higher volume and cash flow.'
        : 'A downward trend is projected — re-evaluate pipeline and cost structure.';

  return { points, direction, note };
}

/** Decisions created over time — supports the DI trend view. */
async function getDecisionTrend(orgId: string, department?: string): Promise<Array<{ label: string; count: number }>> {
  try {
    const match: Record<string, unknown> = { organizationId: new mongoose.Types.ObjectId(orgId) };
    if (department) match.department = department;
    const rows = await Decision.aggregate([
      { $match: match },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);
    return rows.map((r) => ({ label: `${r._id.year}-${String(r._id.month).padStart(2, '0')}`, count: r.count }));
  } catch (e) {
    logger.warn('[DecisionService] Decision trend error:', e);
    return [];
  }
}

/** Aggregate dashboard KPIs + trend + forecast needed by the Decision Intelligence landing view. */
export async function getDecisionInsights(
  orgId: string,
  opts: DecisionInsightsOptions = {}
): Promise<Record<string, unknown>> {
  const { totals, trend } = await getSalesAnalytics(orgId, opts);
  return {
    metrics: { totalRevenue: totals.revenue, salesCount: totals.count },
    riskSummary: await getRiskSummarySafe(orgId),
    decisions: await listDecisions(orgId, { limit: 8, department: opts.department }),
    documents: await getDocumentCount(orgId),
    trend,
    forecast: buildForecast(trend),
    decisionTrend: await getDecisionTrend(orgId, opts.department),
  };
}

async function getRiskSummarySafe(orgId: string): Promise<Record<string, number>> {
  try {
    const counts = await Risk.aggregate([
      { $match: { organizationId: new mongoose.Types.ObjectId(orgId) } },
      { $group: { _id: '$level', count: { $sum: 1 } } },
    ]);
    const summary: Record<string, number> = {};
    for (const c of counts) summary[c._id] = c.count;
    return summary;
  } catch (e) {
    return {};
  }
}

async function getDocumentCount(orgId: string): Promise<number> {
  try {
    return (await DocumentModel.find({ organizationId: orgId }).countDocuments()) || 0;
  } catch (e) {
    return 0;
  }
}