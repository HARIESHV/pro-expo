import { Request, Response } from 'express';
import { Risk } from '../models/Risk';
import { AppError } from '../middleware/errorHandler';
import { ApiResponse } from '../types';
import mongoose from 'mongoose';
import { riskIntelligenceService } from '../risk-intelligence/riskIntelligenceService';

export const riskController = {
  /**
   * GET /api/risks — runs (or reuses cached) Risk Intelligence analysis, then
   * returns the persisted risk records enriched with source availability info.
   */
  async getRisks(req: Request, res: Response): Promise<void> {
    const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);
    const orgIdStr = orgId.toString();
    const { level, status } = req.query;

    const analysis = await riskIntelligenceService.getAnalysis(orgIdStr);

    const query: Record<string, unknown> = { organizationId: orgId };
    if (level) query.level = String(level).toLowerCase();
    if (status) query.status = String(status).toLowerCase();

    const risks = await Risk.find(query)
      .sort({ riskScore: -1, detectedAt: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        risks,
        sourceAvailability: analysis.sourceAvailability,
        unavailableSources: analysis.unavailableSources,
        analyzedAt: analysis.analyzedAt,
        totalSignals: analysis.totalSignals,
      },
    } as ApiResponse);
  },

  /**
   * GET /api/risks/summary — severity counts, total, and per-source distribution.
   */
  async getRiskSummary(req: Request, res: Response): Promise<void> {
    const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);
    const orgIdStr = orgId.toString();

    await riskIntelligenceService.getAnalysis(orgIdStr);

    const [levelStats, sourceStats] = await Promise.all([
      Risk.aggregate([
        { $match: { organizationId: orgId } },
        { $group: { _id: '$level', count: { $sum: 1 } } },
      ]),
      Risk.aggregate([
        { $match: { organizationId: orgId, status: { $ne: 'resolved' } } },
        { $unwind: '$sources' },
        { $group: { _id: '$sources', count: { $sum: 1 } } },
      ]),
    ]);

    const counts = {
      critical: levelStats.find((s) => s._id === 'critical')?.count || 0,
      high: levelStats.find((s) => s._id === 'high')?.count || 0,
      medium: levelStats.find((s) => s._id === 'medium')?.count || 0,
      low: levelStats.find((s) => s._id === 'low')?.count || 0,
    };
    const total = levelStats.reduce((a, s) => a + s.count, 0);

    const sources: Record<string, number> = {};
    sourceStats.forEach((s) => { sources[s._id as string] = s.count; });

    res.json({
      success: true,
      data: { summary: counts, total, sources },
    } as ApiResponse);
  },

  /**
   * POST /api/risks/recalculate — force a full risk re-analysis (recompute).
   * Deterministic; never duplicates; resolves stale automated risks.
   */
  async recalculate(req: Request, res: Response): Promise<void> {
    const orgIdStr = req.user!.organizationId.toString();
    const analysis = await riskIntelligenceService.recalculate(orgIdStr);
    res.json({
      success: true,
      message: 'Risk analysis recalculated',
      data: {
        riskCount: analysis.risks.length,
        totalSignals: analysis.totalSignals,
        unavailableSources: analysis.unavailableSources,
        analyzedAt: analysis.analyzedAt,
      },
    } as ApiResponse);
  },

  /**
   * GET /api/risks/report — Risk Intelligence report generated exclusively
   * from the Risk Intelligence dataset (not from other dashboards).
   */
  async getRiskReport(req: Request, res: Response): Promise<void> {
    const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);
    const orgIdStr = orgId.toString();

    const analysis = await riskIntelligenceService.getAnalysis(orgIdStr);

    const risks = await Risk.find({ organizationId: orgId, status: { $ne: 'resolved' } })
      .sort({ riskScore: -1 })
      .lean();

    const bySeverity = (['critical', 'high', 'medium', 'low'] as const).map((s) => ({
      severity: s,
      count: risks.filter((r) => r.level === s).length,
    }));

    const byCategory = new Map<string, number>();
    risks.forEach((r) => byCategory.set(r.category, (byCategory.get(r.category) || 0) + 1));

    const bySource = new Map<string, number>();
    risks.forEach((r) => (r.sources || []).forEach((s) => bySource.set(s, (bySource.get(s) || 0) + 1)));

    const critical = risks.filter((r) => r.level === 'critical');
    const high = risks.filter((r) => r.level === 'high');

    const report = {
      title: 'Risk Intelligence Report',
      generatedAt: analysis.analyzedAt,
      executiveSummary:
        risks.length === 0
          ? (analysis.unavailableSources.length === 0
              ? 'No significant risks detected.'
              : 'Insufficient enterprise data for reliable risk analysis.')
          : `${risks.length} active risk(s) identified: ${bySeverity.find((s) => s.severity === 'critical')?.count || 0} critical, ${bySeverity.find((s) => s.severity === 'high')?.count || 0} high, ${bySeverity.find((s) => s.severity === 'medium')?.count || 0} moderate, ${bySeverity.find((s) => s.severity === 'low')?.count || 0} low.`,
      totalRisks: risks.length,
      bySeverity,
      criticalRisks: critical.map((r) => ({ title: r.title, category: r.category, riskScore: r.riskScore, confidence: r.confidence, sources: r.sources })),
      highRisks: high.map((r) => ({ title: r.title, category: r.category, riskScore: r.riskScore, confidence: r.confidence, sources: r.sources })),
      moderateRisks: risks.filter((r) => r.level === 'medium').map((r) => ({ title: r.title, riskScore: r.riskScore })),
      lowRisks: risks.filter((r) => r.level === 'low').map((r) => ({ title: r.title, riskScore: r.riskScore })),
      riskCategories: [...byCategory.entries()].map(([category, count]) => ({ category, count })),
      riskSources: [...bySource.entries()].map(([source, count]) => ({ source, count })),
      sourceAvailability: analysis.sourceAvailability,
      unavailableSources: analysis.unavailableSources,
      risks: risks.map((r) => ({
        id: r._id,
        title: r.title,
        description: r.description,
        category: r.category,
        severity: r.level,
        probability: r.probability,
        impact: r.impact,
        riskScore: r.riskScore,
        confidence: r.confidence,
        status: r.status,
        sources: r.sources,
        evidence: r.evidence,
        mitigation: r.mitigation || r.mitigationStrategies?.[0],
        recommendations: r.recommendations,
      })),
    };

    res.json({ success: true, data: { report } } as ApiResponse);
  },

  /**
   * PUT /api/risks/:id — update non-computed metadata (e.g. status lifecycle).
   * Scores are never accepted from the client; they are re-derived.
   */
  async updateRisk(req: Request, res: Response): Promise<void> {
    const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);
    const { id } = req.params;
    const updates = req.body;

    const risk = await Risk.findOne({ _id: id, organizationId: orgId });
    if (!risk) {
      throw new AppError('Risk not found', 404);
    }

    const set: Record<string, unknown> = {};
    if (updates.status !== undefined) {
      const allowed = ['open', 'monitoring', 'mitigated', 'identified', 'assessing', 'mitigating', 'resolved', 'accepted'];
      if (!allowed.includes(String(updates.status))) {
        throw new AppError('Invalid risk status', 400);
      }
      set.status = String(updates.status);
      if (String(updates.status) === 'resolved') set.resolvedAt = new Date();
    }
    if (updates.mitigation !== undefined) set.mitigation = String(updates.mitigation);
    if (Array.isArray(updates.recommendations)) set.recommendations = updates.recommendations;
    if (updates.ownerId !== undefined && updates.ownerId) {
      set.ownerId = new mongoose.Types.ObjectId(updates.ownerId);
    }

    if (Object.keys(set).length === 0) {
      throw new AppError('Nothing to update', 400);
    }

    const updatedRisk = await Risk.findOneAndUpdate(
      { _id: id, organizationId: orgId },
      { $set: set },
      { new: true, runValidators: true }
    );

    res.json({ success: true, data: { risk: updatedRisk } } as ApiResponse);
  },

  async deleteRisk(req: Request, res: Response): Promise<void> {
    const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);
    const { id } = req.params;

    const result = await Risk.deleteOne({ _id: id, organizationId: orgId });
    if (result.deletedCount === 0) {
      throw new AppError('Risk not found', 404);
    }

    res.json({ success: true, message: 'Risk deleted successfully' } as ApiResponse);
  },
};
