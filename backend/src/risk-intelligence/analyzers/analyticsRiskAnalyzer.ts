import mongoose from 'mongoose';
import { SalesRecord } from '../../models/SalesRecord';
import { RiskSignal } from '../types';

/**
 * Analytics-based risk signals.
 *
 * Determininistic trend/decline/concentration rules over SalesRecord and
 * Customer data. All queries are org-scoped (tenant isolation). No random
 * scores — every signal is derived from real numbers; no risk is emitted
 * unless evidence clears the thresholds.
 */
export async function analyzeAnalyticsRisk(orgId: string): Promise<RiskSignal[]> {
  const signals: RiskSignal[] = [];
  const oid = new mongoose.Types.ObjectId(orgId);

  try {
    const quarterTrend = await SalesRecord.aggregate([
      { $match: { organizationId: oid } },
      {
        $group: {
          _id: { year: '$period.year', quarter: '$period.quarter' },
          revenue: { $sum: '$amount' },
          deals: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.quarter': 1 } },
    ]);

    // ── Revenue Decline Risk (streak of quarterly declines) ───────────────
    const withRev = quarterTrend.filter((q) => (q.revenue || 0) > 0);
    if (withRev.length >= 2) {
      let streak = 0;
      for (let i = withRev.length - 1; i > 0; i--) {
        if (withRev[i].revenue < withRev[i - 1].revenue) streak++;
        else break;
      }
      if (streak >= 1) {
        const latest = withRev[withRev.length - 1];
        const prev = withRev[withRev.length - 2];
        const declinePct = prev.revenue > 0
          ? Math.round(((prev.revenue - latest.revenue) / prev.revenue) * 100)
          : 0;
        if (declinePct >= 5) {
          const probability = Math.min(85, 45 + streak * 15 + declinePct);
          signals.push({
            sourceType: 'analytics',
            sourceId: `analytics::revenue::${latest._id.year}q${latest._id.quarter}`,
            signalType: 'revenue_decline',
            title: 'Revenue Decline Risk',
            description: `Revenue has declined for ${streak} consecutive period(s); the latest period (${latest._id.year} Q${latest._id.quarter}) is ${declinePct}% below the previous period ($${latest.revenue.toLocaleString()} vs $${prev.revenue.toLocaleString()}).`,
            category: 'Financial',
            evidence: [
              { label: 'Analytics', detail: `Revenue trend shows a ${declinePct}% period-over-period decline (latest ${latest._id.year}-Q${latest._id.quarter}: $${latest.revenue.toLocaleString()}).` },
            ],
            confidence: 0.7,
            probability: Math.round(probability),
            impact: 85,
          });
        }
      }
    }

    // ── Sales Performance Risk (deals closed decreasing) ──────────────────
    const withDeals = quarterTrend.filter((q) => (q.deals || 0) > 0);
    if (withDeals.length >= 2) {
      const latest = withDeals[withDeals.length - 1];
      const prev = withDeals[withDeals.length - 2];
      if (latest.deals < prev.deals) {
        const dropPct = Math.round(((prev.deals - latest.deals) / prev.deals) * 100);
        if (dropPct >= 15) {
          signals.push({
            sourceType: 'analytics',
            sourceId: `analytics::deals::${latest._id.year}q${latest._id.quarter}`,
            signalType: 'sales_performance',
            title: 'Sales Performance Risk',
            description: `Deals closed decreased by ${dropPct}% (${prev.deals} -> ${latest.deals}) in the latest period.`,
            category: 'Operational',
            evidence: [
              { label: 'Analytics', detail: `Deals closed fell from ${prev.deals} to ${latest.deals} (${dropPct}% drop).` },
            ],
            confidence: 0.55,
            probability: 55,
            impact: 70,
          });
        }
      }
    }

    // ── Customer Concentration Risk ───────────────────────────────────────
    const concentration = await SalesRecord.aggregate([
      { $match: { organizationId: oid } },
      { $group: { _id: '$customerId', total: { $sum: '$amount' } } },
    ]);
    if (concentration.length >= 3) {
      const total = concentration.reduce((a, b) => a + b.total, 0);
      const sorted = concentration.slice().sort((a, b) => b.total - a.total);
      const top1Pct = total > 0 ? Math.round((sorted[0].total / total) * 100) : 0;
      const top3Pct = total > 0
        ? Math.round((sorted.slice(0, 3).reduce((a, b) => a + b.total, 0) / total) * 100)
        : 0;
      if (top1Pct >= 40 || top3Pct >= 75) {
        signals.push({
          sourceType: 'analytics',
          sourceId: `analytics::concentration::${Date.now()}`,
          signalType: 'customer_concentration',
          title: 'Customer Concentration Risk',
          description: `A significant portion of revenue depends on a small number of customers: the top customer contributes ${top1Pct}% and the top 3 contribute ${top3Pct}% of total revenue.`,
          category: 'Customer',
          evidence: [
            { label: 'Analytics', detail: `Customer concentration: top 1 = ${top1Pct}%, top 3 = ${top3Pct}% of revenue.` },
          ],
          confidence: 0.6,
          probability: 50,
          impact: 80,
        });
      }
    }

    // ── Regional Performance Risk ─────────────────────────────────────────
    const byRegion = await SalesRecord.aggregate([
      { $match: { organizationId: oid } },
      { $group: { _id: '$region', total: { $sum: '$amount' } } },
    ]);
    if (byRegion.length >= 2) {
      const total = byRegion.reduce((a, b) => a + b.total, 0);
      const avg = total / byRegion.length;
      const weak = byRegion.filter((r) => avg > 0 && r.total < avg * 0.4);
      if (weak.length > 0) {
        const region = weak[0];
        signals.push({
          sourceType: 'analytics',
          sourceId: `analytics::region::${region._id}`,
          signalType: 'regional_performance',
          title: 'Regional Performance Risk',
          description: `Region "${region._id}" is significantly underperforming the average ($${region.total.toLocaleString()} vs average $${avg.toLocaleString()}).`,
          category: 'Operational',
          evidence: [
            { label: 'Analytics', detail: `Regional performance: "${region._id}" at $${region.total.toLocaleString()} vs average $${avg.toLocaleString()}.` },
          ],
          confidence: 0.5,
          probability: 50,
          impact: 55,
        });
      }
    }
  } catch {
    // Analytics source unavailable — skip gracefully.
  }

  return signals;
}
