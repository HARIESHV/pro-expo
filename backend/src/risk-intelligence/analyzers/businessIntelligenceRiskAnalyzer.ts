import mongoose from 'mongoose';
import { SalesRecord } from '../../models/SalesRecord';
import { Customer } from '../../models/Customer';
import { RiskSignal } from '../types';

/**
 * Business Intelligence risk signals.
 * Analyzes aggregate business health: total revenue, active customers, LTV,
 * segment/churned composition. Deterministic rules, org-scoped, no random data.
 */
export async function analyzeBusinessIntelligenceRisk(orgId: string): Promise<RiskSignal[]> {
  const signals: RiskSignal[] = [];
  const oid = new mongoose.Types.ObjectId(orgId);

  try {
    const [revenueAgg, customerAgg, statusAgg, churned] = await Promise.all([
      SalesRecord.aggregate([
        { $match: { organizationId: oid } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Customer.aggregate([
        { $match: { organizationId: oid } },
        { $group: { _id: null, avgLTV: { $avg: '$lifetimeValue' }, count: { $sum: 1 } } },
      ]),
      Customer.aggregate([
        { $match: { organizationId: oid } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Customer.countDocuments({ organizationId: oid, status: 'churned' }),
    ]);

    const totalCustomers = customerAgg[0]?.count || 0;
    const activeCustomers = statusAgg.find((s) => s._id === 'active')?.count || 0;
    const avgLtv = customerAgg[0]?.avgLTV || 0;
    const totalRevenue = revenueAgg[0]?.total || 0;

    // ── Business Performance Risk: revenue + customers + LTV all weak ─────
    // Only fires when there is real, negative business evidence.
    if (totalCustomers > 0) {
      const churnedPct = Math.round((churned / totalCustomers) * 100);
      const atRiskCount = statusAgg.find((s) => s._id === 'at_risk')?.count || 0;
      const atRiskPct = totalCustomers > 0 ? Math.round((atRiskCount / totalCustomers) * 100) : 0;

      if ((churnedPct >= 10 || atRiskPct >= 15) || (totalRevenue > 0 && totalRevenue < 500000)) {
        signals.push({
          sourceType: 'business_intelligence',
          sourceId: `bi::business_performance::${Date.now()}`,
          signalType: 'business_performance',
          title: 'Business Performance Risk',
          description:
            `Business health signals are weak: ${churnedPct}% of customers have churned, ${atRiskPct}% are at risk, ` +
            `total revenue is $${totalRevenue.toLocaleString()} and average customer LTV is $${Math.round(avgLtv).toLocaleString()}.`,
          category: 'Strategic',
          evidence: [
            { label: 'Business Intelligence', detail: `Customers: ${churnedPct}% churned, ${atRiskPct}% at risk of ${totalCustomers} total.` },
            { label: 'Business Intelligence', detail: `Total revenue $${totalRevenue.toLocaleString()}; average LTV $${Math.round(avgLtv).toLocaleString()}.` },
          ],
          confidence: 0.6,
          probability: 55,
          impact: 75,
        });
      }

      // ── Customer LTV Risk (falling/weak lifetime value) ─────────────────
      if (totalCustomers > 0 && totalRevenue > 0 && avgLtv > 0 && totalRevenue / totalCustomers > avgLtv * 3) {
        const impliedLtv = Math.round(totalRevenue / totalCustomers);
        signals.push({
          sourceType: 'business_intelligence',
          sourceId: `bi::ltv::${Date.now()}`,
          signalType: 'customer_ltv',
          title: 'Customer Lifetime Value Risk',
          description: `Realized revenue per customer ($${impliedLtv.toLocaleString()}) far exceeds the recorded average customer LTV ($${Math.round(avgLtv).toLocaleString()}), suggesting LTV is understated or profitability is concentrated in few accounts.`,
          category: 'Customer',
          evidence: [
            { label: 'Business Intelligence', detail: `Average customer LTV $${Math.round(avgLtv).toLocaleString()} vs realized revenue/customer $${impliedLtv.toLocaleString()}.` },
          ],
          confidence: 0.45,
          probability: 40,
          impact: 60,
        });
      }
    }
  } catch {
    // BI source unavailable — skip gracefully.
  }

  return signals;
}
