import mongoose from 'mongoose';
import { SalesRecord } from '../models/SalesRecord';
import { Customer } from '../models/Customer';
import { Risk } from '../models/Risk';
import { KnowledgeEntity } from '../models/KnowledgeEntity';
import { KnowledgeRelationship } from '../models/KnowledgeRelationship';
import { AnalyticsResult } from '../models/AnalyticsResult';

export interface FetchReportDataInput {
  type: string;
  orgId: mongoose.Types.ObjectId;
  start: Date;
  end: Date;
  context?: Record<string, unknown>;
  sources?: string[];
  userId?: string;
  roles?: string[];
}

export const reportService = {
  /**
   * Fetch real, org-scoped data for a report. Returns structured data matching the
   * shapes the frontend renders from `content.aggregatedData`, plus derived
   * `kpis`, `trends` and `risks` for the report body and exports.
   */
  async fetchReportData(input: FetchReportDataInput): Promise<{
    aggregatedData: Record<string, unknown>;
    kpis: Array<{ name: string; value: string; change?: number }>;
    trends: Array<{ period: string; metric: string; value: number }>;
    risks: Array<{
      title: string;
      severity: string;
      status: string;
      confidence?: number;
      sources?: string[];
      evidence?: Array<{ label: string; detail: string }>;
      mitigation?: string;
      recommendations?: string[];
    }>;
  }> {
    const { type, orgId, start, end, context = {}, sources = [], userId, roles = [] } = input;
    const aggregatedData: Record<string, unknown> = {};
    const kpis: Array<{ name: string; value: string; change?: number }> = [];
    const trends: Array<{ period: string; metric: string; value: number }> = [];
    const reportRisks: Array<{
      title: string;
      severity: string;
      status: string;
      confidence?: number;
      sources?: string[];
      evidence?: Array<{ label: string; detail: string }>;
      mitigation?: string;
      recommendations?: string[];
    }> = [];

    const normalizedType = type.toLowerCase();
    const wantSales = normalizedType === 'sales' || sources.includes('sales') || sources.includes('business_intelligence');
    const wantCustomers = sources.includes('analytics') || sources.includes('customers') || sources.includes('executive_dashboard') || normalizedType === 'executive';
    const wantRisks = normalizedType === 'operations' || sources.includes('risks');
    const wantDocs = sources.includes('documents');
    const wantGraph = sources.includes('knowledge_graph') || sources.includes('evaluate_graph');
    const wantUniversal = sources.includes('universal_search');
    const wantAnalytics = sources.includes('analytics');

    // ── Sales performance (by region) ────────────────────────────────────
    if (wantSales) {
      const [byRegion, byQuarter] = await Promise.all([
        SalesRecord.aggregate([
          { $match: { organizationId: orgId, createdAt: { $gte: start, $lte: end } } },
          { $group: { _id: '$region', total: { $sum: '$amount' }, count: { $sum: 1 } } },
          { $sort: { total: -1 } },
        ]),
        SalesRecord.aggregate([
          { $match: { organizationId: orgId, createdAt: { $gte: start, $lte: end } } },
          {
            $group: {
              _id: { year: '$period.year', quarter: '$period.quarter' },
              revenue: { $sum: '$amount' },
              count: { $sum: 1 },
            },
          },
          { $sort: { '_id.year': 1, '_id.quarter': 1 } },
        ]),
      ]);
      aggregatedData.sales = byRegion;
      byRegion.forEach((r) => kpis.push({ name: `Revenue - ${r._id}`, value: `$${(r.total || 0).toLocaleString()}` }));
      byQuarter.forEach((q) =>
        trends.push({
          period: `Q${q._id.quarter} ${q._id.year}`,
          metric: 'Revenue',
          value: Math.round(q.revenue || 0),
        })
      );
    }

    // ── Customer segmentation ────────────────────────────────────────────
    if (wantCustomers) {
      const customerStats = await Customer.aggregate([
        { $match: { organizationId: orgId } },
        { $group: { _id: '$segment', count: { $sum: 1 }, avgLTV: { $avg: '$lifetimeValue' } } },
        { $sort: { count: -1 } },
      ]);
      aggregatedData.customers = customerStats;
    }

    // ── Risks by severity ────────────────────────────────────────────────
    if (wantRisks) {
      // Generate the Risk report exclusively from the Risk Intelligence dataset.
      try {
        const { riskIntelligenceService } = await import('../risk-intelligence/riskIntelligenceService');
        await riskIntelligenceService.getAnalysis(orgId.toString());
      } catch {
        // fall through to DB read if analysis unavailable
      }

      const riskCounts = await Risk.aggregate([
        { $match: { organizationId: orgId, status: { $ne: 'resolved' } } },
        { $group: { _id: '$level', count: { $sum: 1 } } },
      ]);
      const ordered = ['critical', 'high', 'medium', 'low']
        .map((level) => ({ _id: level, count: (riskCounts.find((r) => r._id === level) || {}).count || 0 }))
        .filter((r) => r.count > 0);
      aggregatedData.risks = ordered;

      const riskList = await Risk.find({ organizationId: orgId, status: { $ne: 'resolved' } })
        .sort({ riskScore: -1 })
        .limit(15)
        .lean();
      riskList.forEach((r) =>
        reportRisks.push({
          title: r.title,
          severity: r.level,
          status: r.status,
          confidence: r.confidence,
          sources: r.sources,
          evidence: r.evidence,
          mitigation: r.mitigation || r.mitigationStrategies?.[0],
          recommendations: r.recommendations,
        })
      );
      aggregatedData.risk_intelligence = {
        bySeverity: ordered,
        items: riskList.map((r) => ({
          title: r.title,
          category: r.category,
          severity: r.level,
          riskScore: r.riskScore,
          probability: r.probability,
          impact: r.impact,
          confidence: r.confidence,
          status: r.status,
          sources: r.sources,
        })),
      };
    }

    // ── Analytics snapshot ───────────────────────────────────────────────
    if (wantAnalytics) {
      const recent = await AnalyticsResult.find({
        organizationId: orgId,
        createdAt: { $gte: start, $lte: end },
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();
      aggregatedData.analytics = recent;
    }

    // ── Universal search evidence (from report context) ──────────────────
    if (wantUniversal && context.matchingDocuments) {
      aggregatedData.universal_search = {
        query: context.searchQuery || 'Universal search analysis',
        matchingDocuments: context.matchingDocuments,
      };
    }

    // ── Document analysis ────────────────────────────────────────────────
    if (wantDocs) {
      aggregatedData.documents = context.documents || [];
    }

    // ── Knowledge graph / evaluate graph ─────────────────────────────────
    if (wantGraph) {
      const [entities, rels] = await Promise.all([
        KnowledgeEntity.countDocuments({ organizationId: orgId, isActive: true }),
        KnowledgeRelationship.countDocuments({ organizationId: orgId, isActive: true }),
      ]);
      const storedGraph = { totalEntities: entities, totalRelationships: rels };

      // The Knowledge Graph report reflects the LIVE unified graph (documents,
      // enterprise records, chat, decisions, searches) rather than stored nodes only.
      if (sources.includes('knowledge_graph')) {
        try {
          const { unifiedKnowledgeGraphService } = await import('../knowledge-graph/unifiedGraphService');
          const result = await unifiedKnowledgeGraphService.getGraphWithBreakdown(orgId.toString(), {
            userId: userId || 'system',
            roles,
          });
          const nodesBySource: Record<string, number> = {};
          result.data.nodes.forEach((n) => {
            const s = n.source || 'knowledge';
            nodesBySource[s] = (nodesBySource[s] || 0) + 1;
          });
          aggregatedData.knowledge_graph = {
            ...storedGraph,
            totalNodes: result.data.totalNodes,
            totalEdges: result.data.totalEdges,
            nodesByType: result.breakdown.nodesByType,
            edgesByType: result.breakdown.edgesByType,
            sources: nodesBySource,
          };
          Object.entries(result.breakdown.nodesByType || {}).forEach(([t, count]) =>
            kpis.push({ name: `${t.replace(/_/g, ' ')} entities`, value: String(count) })
          );
          Object.entries(nodesBySource || {}).forEach(([s, count]) =>
            trends.push({ period: (s || 'source').replace(/_/g, ' '), metric: 'Entities', value: Number(count) })
          );
        } catch {
          aggregatedData.knowledge_graph = storedGraph;
        }
      } else {
        aggregatedData.knowledge_graph = storedGraph;
      }
    }

    // ── Executive / broad metrics (for executive, finance, operations) ───
    const wantsBroad = normalizedType === 'executive' || normalizedType === 'finance' || normalizedType === 'operations';
    if (wantsBroad) {
      const [revenueAgg, customerCount, queryCount] = await Promise.all([
        SalesRecord.aggregate([
          { $match: { organizationId: orgId, createdAt: { $gte: start, $lte: end } } },
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
        Customer.countDocuments({ organizationId: orgId }),
        import('../models/Query').then(({ Query }) => Query.countDocuments({ organizationId: orgId })),
      ]);
      const total = revenueAgg[0]?.total || 0;
      const deals = revenueAgg[0]?.count || 0;
      aggregatedData.executive = {
        totalRevenue: total,
        totalDeals: deals,
        totalCustomers: customerCount,
        totalQueries: queryCount,
        startDate: start,
        endDate: end,
      };
      kpis.push(
        { name: 'Total Revenue', value: `$${total.toLocaleString()}` },
        { name: 'Total Deals', value: String(deals) },
        { name: 'Total Customers', value: String(customerCount) },
        { name: 'Total AI Queries', value: String(queryCount) },
      );
    }

    return { aggregatedData, kpis, trends, risks: reportRisks };
  },
};
