import mongoose from 'mongoose';
import { Risk } from '../models/Risk';
import { RiskSignal, NormalizedRisk, RiskAnalysisResult, RiskSourceType } from './types';
import { fingerprintFor, mergeSignals } from './dedupe';
import { aggregateConfidence, calcRiskScore, severityFromScore, clamp } from './ruleEngine';
import { logger } from '../config/logger';

import { analyzeDocumentRisk } from './analyzers/documentRiskAnalyzer';
import { analyzeAiRisk } from './analyzers/aiRiskAnalyzer';
import { analyzeSearchRisk } from './analyzers/searchRiskAnalyzer';
import { analyzeChatRisk } from './analyzers/chatRiskAnalyzer';
import { analyzeAnalyticsRisk } from './analyzers/analyticsRiskAnalyzer';
import { analyzeBusinessIntelligenceRisk } from './analyzers/businessIntelligenceRiskAnalyzer';
import { analyzeKnowledgeGraphRisk } from './analyzers/knowledgeGraphRiskAnalyzer';
import { analyzeGraphEvaluationRisk } from './analyzers/graphEvaluationRiskAnalyzer';
import { analyzeDecisionRisk } from './analyzers/decisionRiskAnalyzer';

export const ALL_SOURCE_TYPES: RiskSourceType[] = [
  'document',
  'ai_analysis',
  'universal_search',
  'chat',
  'analytics',
  'business_intelligence',
  'knowledge_graph',
  'graph_evaluation',
  'decision_intelligence',
];

// Weights: how strongly each source contributes to impact/probability when merged.
const SOURCE_IMPACT_WEIGHT: Record<RiskSourceType, number> = {
  document: 1,
  ai_analysis: 0.9,
  universal_search: 0.7,
  chat: 0.6,
  analytics: 1.1,
  business_intelligence: 1.1,
  knowledge_graph: 0.8,
  graph_evaluation: 0.9,
  decision_intelligence: 1,
};

interface AnalyzerEntry {
  sourceType: RiskSourceType;
  run: (orgId: string) => Promise<RiskSignal[]>;
}

const ANALYZERS: AnalyzerEntry[] = [
  { sourceType: 'analytics', run: analyzeAnalyticsRisk },
  { sourceType: 'business_intelligence', run: analyzeBusinessIntelligenceRisk },
  { sourceType: 'knowledge_graph', run: analyzeKnowledgeGraphRisk },
  { sourceType: 'graph_evaluation', run: analyzeGraphEvaluationRisk },
  { sourceType: 'chat', run: analyzeChatRisk },
  { sourceType: 'universal_search', run: analyzeSearchRisk },
  { sourceType: 'decision_intelligence', run: analyzeDecisionRisk },
  { sourceType: 'ai_analysis', run: analyzeAiRisk },
  { sourceType: 'document', run: analyzeDocumentRisk },
];

const CACHE_TTL_MS = 45_000; // avoid expensive recompute on every dashboard GET
const analysisCache = new Map<string, { at: number; result: RiskAnalysisResult }>();

export const riskIntelligenceService = {
  /**
   * Return a cached analysis when fresh, otherwise run the pipeline.
   * Caching keeps dashboard reads fast while refresh/recalculate force a re-run.
   */
  async getAnalysis(orgId: string, force = false): Promise<RiskAnalysisResult> {
    if (!force) {
      const cached = analysisCache.get(orgId);
      if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
        return cached.result;
      }
    }
    const result = await this.analyze(orgId);
    analysisCache.set(orgId, { at: Date.now(), result });
    return result;
  },

  /**
   * Run the full Risk Intelligence pipeline for an organization:
   * every analyzer independently -> normalize -> validate -> deduplicate ->
   * score -> severity -> confidence -> evidence -> mitigation -> persist.
   */
  async analyze(orgId: string): Promise<RiskAnalysisResult> {
    const sourceAvailability: Record<RiskSourceType, boolean> = {
      document: true,
      ai_analysis: true,
      universal_search: true,
      chat: true,
      analytics: true,
      business_intelligence: true,
      knowledge_graph: true,
      graph_evaluation: true,
      decision_intelligence: true,
    };
    const unavailableSources: RiskSourceType[] = [];
    const allSignals: RiskSignal[] = [];

    // Run analyzers independently so one failure never breaks the dashboard.
    await Promise.all(
      ANALYZERS.map(async ({ sourceType, run }) => {
        try {
          const signals = await run(orgId);
          allSignals.push(...signals);
        } catch (err: any) {
          sourceAvailability[sourceType] = false;
          unavailableSources.push(sourceType);
          logger.warn(`[RiskIntelligence] Source "${sourceType}" failed, continuing: ${err?.message}`);
        }
      })
    );

    const normalized = this.consolidateSignals(allSignals);

    // Left-empty if there genuinely are no signals
    if (normalized.length === 0) {
      await this.resolvestaleRisks(orgId, []);
    } else {
      await this.persistRisks(orgId, normalized);
    }

    return {
      risks: normalized,
      sourceAvailability,
      unavailableSources,
      analyzedAt: new Date().toISOString(),
      totalSignals: allSignals.length,
    };
  },

  /**
   * Normalize + validate + de-duplicate + score signals into final risks.
   * Groups signals by fingerprint so the same issue from many sources becomes
   * ONE risk whose confidence is raised by multi-source confirmation.
   */
  consolidateSignals(signals: RiskSignal[]): NormalizedRisk[] {
    // Validation: drop signals with no usable identifying detail
    const valid = signals.filter((s) => s && s.title && s.title.trim() && (s.evidence?.length || s.description));

    const groups = new Map<string, RiskSignal[]>();
    valid.forEach((s) => {
      const key = fingerprintFor(s.category, s.title);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    });

    const risks: NormalizedRisk[] = [];
    groups.forEach((group) => {
      const merged = this.mergeGroup(group);
      if (merged) risks.push(merged);
    });

    return risks.sort((a, b) => b.riskScore - a.riskScore);
  },

  mergeGroup(group: RiskSignal[]): NormalizedRisk | null {
    if (group.length === 0) return null;
    // Canonical title/category: pick the most-confident signal's wording
    const best = group.slice().sort((a, b) => b.confidence - a.confidence)[0];
    const title = best.title;
    const category = best.category;

    // Weighted deterministic impact/probability across the confirming sources
    const impact = this.weightedEstimate(group, (s) => s.impact ?? 55);
    const probability = this.weightedEstimate(group, (s) => s.probability ?? 40);

    // Multi-source confidence (independent of severity)
    const confidence = aggregateConfidence(group.map((s) => s.confidence));

    const merged = mergeSignals(group, category, title, confidence, impact, probability);

    // Multi-source confirmation boosts confidence resolution
    merged.sources = [...new Set(group.map((s) => s.sourceType))];

    return merged;
  },

  weightedEstimate(group: RiskSignal[], pick: (s: RiskSignal) => number): number {
    let totalWeight = 0;
    let weighted = 0;
    const contribution = new Map<string, number>();
    group.forEach((s) => {
      const w = SOURCE_IMPACT_WEIGHT[s.sourceType] || 1;
      // De-duplicate by source so the same source doesn't dominate
      if (!contribution.has(s.sourceType)) {
        weighted += clamp(pick(s), 1, 100) * w;
        totalWeight += w;
        contribution.set(s.sourceType, 1);
      }
    });
    return totalWeight === 0 ? 50 : Math.round(weighted / totalWeight);
  },

  /**
   * Persist risks keyed by fingerprint. Avoids creating duplicates on every
   * recalculation; updates existing risks, preserves resolved history, and
   * reopens risks whose evidence has returned.
   */
  async persistRisks(orgId: string, risks: NormalizedRisk[]): Promise<void> {
    const oid = new mongoose.Types.ObjectId(orgId);
    const fingerprints = risks.map((r) => r.fingerprint);

    for (const risk of risks) {
      const existing = await Risk.findOne({ organizationId: oid, fingerprint: risk.fingerprint });
      if (existing) {
        const reopen = existing.status === 'resolved';
        const updates: Record<string, unknown> = {
          title: risk.title,
          description: risk.description,
          category: risk.category,
          level: risk.severity,
          probability: risk.probability,
          impact: risk.impact,
          riskScore: calcRiskScore(risk.probability, risk.impact),
          confidence: risk.confidence,
          sources: risk.sources,
          evidence: risk.evidence,
          mitigation: risk.mitigation,
          recommendations: risk.recommendations,
          aiDetected: true,
          updatedAt: new Date(),
        };
        if (reopen) {
          updates.status = 'open';
          updates.resolvedAt = undefined;
        }
        await Risk.updateOne({ _id: existing._id }, { $set: updates });
      } else {
        await Risk.create({
          organizationId: oid,
          title: risk.title,
          description: risk.description,
          category: risk.category,
          level: risk.severity,
          probability: risk.probability,
          impact: risk.impact,
          riskScore: calcRiskScore(risk.probability, risk.impact),
          confidence: risk.confidence,
          status: 'open',
          sources: risk.sources,
          evidence: risk.evidence,
          mitigation: risk.mitigation,
          recommendations: risk.recommendations,
          mitigationStrategies: [risk.mitigation],
          fingerprint: risk.fingerprint,
          detectedAt: new Date(risk.detectedAt),
          aiDetected: true,
          aiConfidence: risk.confidence,
        });
      }
    }

    // Resolve automated risks no longer supported by fresh signals, preserving
    // already-resolved history.
    await this.resolvestaleRisks(orgId, fingerprints);
  },

  async resolvestaleRisks(orgId: string, activeFingerprints: string[]): Promise<void> {
    const oid = new mongoose.Types.ObjectId(orgId);
    await Risk.updateMany(
      {
        organizationId: oid,
        fingerprint: { $nin: activeFingerprints },
        aiDetected: true,
        status: { $in: ['open', 'monitoring', 'identified', 'assessing', 'mitigating'] },
      },
      {
        $set: {
          status: 'resolved',
          resolvedAt: new Date(),
        },
      }
    );
  },

  /**
   * Re-run the full pipeline deterministically (used by Refresh/Recalculate).
   */
  async recalculate(orgId: string): Promise<RiskAnalysisResult> {
    return this.analyze(orgId);
  },

  /**
   * Fire-and-forget background refresh so auto-updates (new document, chat
   * message, decision evaluation) never block the originating request.
   */
  refreshAsync(orgId: string): void {
    const orgIdStr = String(orgId);
    Promise.resolve()
      .then(() => this.recalculate(orgIdStr))
      .catch((err) => logger.warn(`[RiskIntelligence] background refresh failed: ${err?.message}`));
  },
};
