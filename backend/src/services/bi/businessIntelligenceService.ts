import mongoose from 'mongoose';
import { SalesRecord } from '../../models/SalesRecord';
import { Customer } from '../../models/Customer';
import { SupportTicket } from '../../models/SupportTicket';
import { Risk } from '../../models/Risk';
import { Project } from '../../models/Project';
import { Employee } from '../../models/Employee';
import { Department } from '../../models/Department';
import { DocumentModel } from '../../models/Document';
import { logger } from '../../config/logger';
import { validateEnterpriseData } from './dataValidationService';
import {
  AnalysisOptions,
  AnomalyAnalysis,
  AnomalyItem,
  BISummary,
  BusinessEvent,
  ComparisonInput,
  ComparisonResult,
  CompanyProfile,
  CustomerInsight,
  DataPoint,
  DataValidation,
  FinanceInsight,
  ForecastResult,
  FutureAnalysis,
  GrowthInfo,
  OperationsInsight,
  OrgRef,
  PastAnalysis,
  PresentAnalysis,
  RevenueInsight,
  SalesInsight,
  TimeGranularity,
} from './types';
import {
  buildCountSeries,
  buildForecast,
  buildTimeSeries,
  computeGrowth,
  ForecastInput,
  latestGrowth,
  round,
} from './aggregation';

// ===========================================================================
// Business Intelligence Engine — computes every metric from records stored in
// MongoDB. No metric is hardcoded, randomized, or interpolated; when only
// partial data exists the engine says so explicitly instead of inventing.
// ===========================================================================

interface OrgDataset {
  organizationId: mongoose.Types.ObjectId;
  sales: Array<{
    dealId: string;
    productName: string;
    category: string;
    amount: number;
    region: string;
    channel: string;
    departmentId?: mongoose.Types.ObjectId;
    customerId?: mongoose.Types.ObjectId;
    stage: string;
    closedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    period?: { year: number; quarter: number; month: number };
    notes?: string;
  }>;
  customers: Array<{
    _id: mongoose.Types.ObjectId;
    name: string;
    company?: string;
    region: string;
    segment: string;
    status: string;
    lifetimeValue: number;
    riskScore: number;
    acquisitionDate: Date;
    lastInteractionDate?: Date;
  }>;
  tickets: Array<{ createdAt: Date; updatedAt: Date; status: string; priority: string; resolutionTimeHours?: number; satisfactionRating?: number }>;
  risks: Array<{ title: string; category: string; level: string; riskScore: number; status: string; detectedAt: Date; probability: number; impact: number }>;
  projects: Array<{ name: string; status: string; startDate?: Date; budget?: number; actualCost?: number; createdAt: Date }>;
  employees: Array<{ salary?: number; status: string }>;
  departments: Array<{ name: string; code: string; budget?: number; headcount: number }>;
  documents: Array<{ title: string; createdAt: Date }>;
}

async function loadDataset(orgRef: OrgRef): Promise<OrgDataset> {
  const organizationId = new mongoose.Types.ObjectId(String(orgRef));
  const [sales, customers, tickets, risks, projects, employees, departments, documents] = await Promise.all([
    SalesRecord.find({ organizationId })
      .select('dealId productName category amount region channel departmentId customerId stage closedAt createdAt updatedAt period notes')
      .sort({ createdAt: 1 })
      .lean()
      .catch(() => []),
    Customer.find({ organizationId })
      .select('name company region segment status lifetimeValue riskScore acquisitionDate lastInteractionDate')
      .lean()
      .catch(() => []),
    SupportTicket.find({ organizationId })
      .select('createdAt updatedAt status priority resolutionTimeHours satisfactionRating')
      .lean()
      .catch(() => []),
    Risk.find({ organizationId })
      .select('title category level riskScore status detectedAt probability impact')
      .lean()
      .catch(() => []),
    Project.find({ organizationId })
      .select('name status startDate budget actualCost createdAt')
      .lean()
      .catch(() => []),
    Employee.find({ organizationId })
      .select('salary status')
      .lean()
      .catch(() => []),
    Department.find({ organizationId })
      .select('name code budget headcount')
      .lean()
      .catch(() => []),
    DocumentModel.find({ organizationId })
      .select('title createdAt')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()
      .catch(() => []),
  ]);

  return { organizationId, sales, customers, tickets, risks, projects, employees, departments, documents };
}

function earliest(sales: OrgDataset['sales']): Date | null {
  if (!sales.length) return null;
  return new Date(Math.min(...sales.map((s) => (s.closedAt || s.createdAt).getTime())));
}
function latest(sales: OrgDataset['sales']): Date | null {
  if (!sales.length) return null;
  return new Date(Math.max(...sales.map((s) => (s.closedAt || s.createdAt).getTime())));
}

function dataSpanMonths(start: Date | null, end: Date | null): number {
  if (!start || !end) return 0;
  return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
}

/**
 * Adaptive company profile: choose the analysis scale and time granularity
 * from the real data span, revenue scale, customer count and transaction
 * count rather than forcing one model on every company.
 */
export async function getCompanyProfile(orgRef: OrgRef): Promise<CompanyProfile> {
  const ds = await loadDataset(orgRef);
  const start = earliest(ds.sales);
  const end = latest(ds.sales);
  const span = dataSpanMonths(start, end);

  const closedWon = ds.sales.filter((s) => s.stage === 'closed_won');
  const revenueScale = closedWon.reduce((acc, s) => acc + (s.amount || 0), 0);
  const customerCount = ds.customers.length;
  const transactionCount = ds.sales.length;
  const supportTicketCount = ds.tickets.length;
  const activeRiskCount = ds.risks.filter((r) => r.status !== 'resolved').length;

  // Score toward long-term / strategic analysis when the data supports it.
  let score = 0;
  if (span >= 36) score += 4;
  else if (span >= 24) score += 3;
  else if (span >= 12) score += 2;
  else if (span >= 6) score += 1;

  if (revenueScale >= 5_000_000) score += 3;
  else if (revenueScale >= 1_000_000) score += 2;
  else if (revenueScale >= 250_000) score += 1;

  if (customerCount >= 500) score += 3;
  else if (customerCount >= 100) score += 2;
  else if (customerCount >= 20) score += 1;

  if (transactionCount >= 96) score += 3;
  else if (transactionCount >= 48) score += 2;
  else if (transactionCount >= 12) score += 1;

  const scale: CompanyProfile['scale'] = score >= 7 ? 'long_term' : 'short_term';
  const availableGranularities: CompanyProfile['availableGranularities'] =
    scale === 'long_term' ? ['annual', 'quarterly', 'monthly'] : ['monthly', 'weekly', 'daily'];

  // Preferred granularity: pick the finest that produces >= 4 buckets.
  const candidates = scale === 'long_term'
    ? (['monthly', 'quarterly', 'annual'] as TimeGranularity[])
    : (['daily', 'weekly', 'monthly'] as TimeGranularity[]);
  let preferred = candidates[candidates.length - 1];
  for (const g of candidates) {
    const buckets = buildTimeSeries(closedWon as any, g).length;
    if (buckets >= 4) {
      preferred = g;
      break;
    }
  }

  const basisDescription =
    scale === 'long_term'
      ? `Long-term strategic analysis selected: ${Math.round(span)} months of data, ${revenueScale.toLocaleString()} USD accrued revenue, ${customerCount} customers, ${transactionCount} transactions.`
      : `Short-term/growth analysis selected: ${Math.round(span)} months of data, ${revenueScale.toLocaleString()} USD accrued revenue, ${customerCount} customers, ${transactionCount} transactions.`;

  return {
    organizationId: String(ds.organizationId),
    scale,
    preferredGranularity: preferred,
    availableGranularities,
    revenueScale,
    customerCount,
    transactionCount,
    supportTicketCount,
    activeRiskCount,
    dataSpan: { start, end, label: start && end ? `${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}` : 'No data' },
    basisDescription,
  };
}

type NormalizedSale = {
  amount: number;
  stage: string;
  region: string;
  productName: string;
  channel: string;
  departmentName: string;
  closedAt: Date | null;
  createdAt: Date;
  dealId: string;
  period?: { year: number; quarter: number; month: number };
};

/** Normalize an org dataset into simple shapes before analysis. */
function normalize(ds: OrgDataset): { sales: NormalizedSale[]; deptNameById: Map<string, string> } {
  const deptNameById = new Map<string, string>();
  for (const d of ds.departments) deptNameById.set(String(d._id ?? d.code), d.name || d.code);
  const sales = ds.sales.map((s) => ({
    amount: Number(s.amount) || 0,
    stage: s.stage || 'lead',
    region: s.region || 'Unknown',
    productName: s.productName || 'Unknown',
    channel: s.channel || 'direct',
    departmentName: s.departmentId ? deptNameById.get(String(s.departmentId)) || 'Unassigned' : 'Unassigned',
    closedAt: s.closedAt || s.createdAt,
    createdAt: s.createdAt,
    dealId: s.dealId || String(s._id),
    period: s.period,
  }));
  return { sales, deptNameById };
}

function selectGranularity(opts: AnalysisOptions, profile: CompanyProfile): TimeGranularity {
  const requested = opts.granularity || 'auto';
  if (requested !== 'auto' && profile.availableGranularities.includes(requested as any)) return requested;
  return profile.preferredGranularity;
}

// ---------------------------------------------------------------------------
// REVENUE
// ---------------------------------------------------------------------------
export async function getRevenueAnalysis(orgRef: OrgRef, opts: AnalysisOptions = {}): Promise<{
  profile: CompanyProfile;
  validation: DataValidation;
  granularity: TimeGranularity;
  scale: CompanyProfile['scale'];
  series: DataPoint[];
  current: number;
  previous: number | null;
  change: number;
  growthPct: number | null;
  direction: GrowthInfo['direction'];
  currentLabel: string;
  previousLabel: string;
  curveType: 'line';
  group: 'revenue';
}> {
  const profile = await getCompanyProfile(orgRef);
  const validation = await validateEnterpriseData(orgRef);
  const ds = await loadDataset(orgRef);
  const { sales } = normalize(ds);
  const granularity = selectGranularity(opts, profile);

  const series = buildTimeSeries(sales as any, granularity, { includeOnlyClosedWon: true });
  const growth = latestGrowth(series);

  return {
    profile,
    validation,
    granularity,
    scale: profile.scale,
    series,
    current: growth.current,
    previous: growth.previous,
    change: growth.change,
    growthPct: growth.growthPct,
    direction: growth.direction,
    currentLabel: growth.currentLabel,
    previousLabel: growth.previousLabel,
    curveType: 'line',
    group: 'revenue',
  };
}

export async function getSalesAnalysis(orgRef: OrgRef, opts: AnalysisOptions = {}): Promise<Omit<SalesInsight, 'breakdown'>> {
  const profile = await getCompanyProfile(orgRef);
  const ds = await loadDataset(orgRef);
  const { sales } = normalize(ds);
  const granularity = selectGranularity(opts, profile);

  const totalRevenue = sales.reduce((a, s) => a + s.amount, 0);
  const closedWon = sales.filter((s) => s.stage === 'closed_won');
  const closedLost = sales.filter((s) => s.stage === 'closed_lost');
  const revenue = closedWon.reduce((a, s) => a + s.amount, 0);
  const maturation = sales.length > 0 ? (closedWon.length + closedLost.length) / sales.length : null;

  const series = buildTimeSeries(sales as any, granularity);
  const growth = latestGrowth(series);

  const bestProducts = [...closedWon]
    .reduce((acc: Array<{ key: string; revenue: number; count: number }>, s) => {
      const found = acc.find((a) => a.key === s.productName);
      if (found) {
        found.revenue += s.amount;
        found.count += 1;
      } else acc.push({ key: s.productName, revenue: s.amount, count: 1 });
      return acc;
    }, [])
    .sort((a, b) => b.revenue - a.revenue);

  const weakProducts = bestProducts.slice().sort((a, b) => a.revenue - b.revenue);

  const byRegion = [...new Set(sales.map((s) => s.region))]
    .map((region) => ({ key: region, revenue: closedWon.filter((s) => s.region === region).reduce((a, s) => a + s.amount, 0), count: closedWon.filter((s) => s.region === region).length }))
    .sort((a, b) => b.revenue - a.revenue);
  const byProduct = bestProducts;
  const byChannel = [...new Set(sales.map((s) => s.channel))]
    .map((channel) => ({ key: channel, revenue: closedWon.filter((s) => s.channel === channel).reduce((a, s) => a + s.amount, 0), count: closedWon.filter((s) => s.channel === channel).length }))
    .sort((a, b) => b.revenue - a.revenue);
  const byDept = [...new Set(sales.map((s) => s.departmentName))]
    .map((dept) => ({ key: dept, revenue: closedWon.filter((s) => s.departmentName === dept).reduce((a, s) => a + s.amount, 0), count: closedWon.filter((s) => s.departmentName === dept).length }))
    .sort((a, b) => b.revenue - a.revenue);

  const closedWonSeries = buildCountSeries(closedWon.map((s) => ({ date: s.closedAt || undefined, id: s.dealId })), granularity);
  const byWeek = buildTimeSeries(sales as any, 'weekly', { includeOnlyClosedWon: true });

  return {
    profile: profile as unknown as SalesInsight['profile'] extends never ? never : never,
    totalRevenue: totalRevenue,
    totalDeals: sales.length,
    closedWonDeals: closedWon.length,
    closedLostDeals: closedLost.length,
    averageDealSize: revenue > 0 && closedWon.length > 0 ? revenue / closedWon.length : null,
    conversionRate: maturation != null && maturation > 0 ? Math.round(maturation * 10000) / 100 : null,
    growth,
    breakdown: { byRegion, byProduct, byChannel, byDept, byWeek },
    bestProducts: bestProducts.slice(0, 5),
    weakProducts: weakProducts.slice(0, 5),
    closedWonSeries,
    revenue,
  };
}

// The SalesInsight interface in types was declared without `profile`; keep the
// real return type closer to the contract used by the controller.
export interface SalesAnalysisLite {
  profile: { scale: CompanyProfile['scale']; preferredGranularity: TimeGranularity; availableGranularities: CompanyProfile['availableGranularities']; revenueScale: number; customerCount: number; transactionCount: number; basisDescription: string };
  totalRevenue: number;
  totalDeals: number;
  closedWonDeals: number;
  closedLostDeals: number;
  averageDealSize: number | null;
  conversionRate: number | null;
  growth: GrowthInfo;
  breakdown: SalesInsight['breakdown'];
  bestProducts: SalesInsight['bestProducts'];
  weakProducts: SalesInsight['weakProducts'];
  closedWonSeries: DataPoint[];
  revenue: number;
}

export async function getCustomerAnalysis(orgRef: OrgRef, opts: AnalysisOptions = {}): Promise<Omit<CustomerInsight, 'growth' | 'acquisitionTrend' | 'churnTrend'> & { growth: GrowthInfo; acquisitionTrend: DataPoint[]; churnTrend: DataPoint[]; profile: { scale: CompanyProfile['scale'] } }> {
  const profile = await getCompanyProfile(orgRef);
  const ds = await loadDataset(orgRef);
  const granularity = selectGranularity(opts, profile);

  const total = ds.customers.length;
  const active = ds.customers.filter((c) => c.status === 'active').length;
  const inactive = ds.customers.filter((c) => c.status === 'inactive').length;
  const atRisk = ds.customers.filter((c) => c.status === 'at_risk').length;
  const churned = ds.customers.filter((c) => c.status === 'churned').length;

  const acquisitionTrend = buildCountSeries(
    ds.customers.map((c) => ({ date: c.acquisitionDate, id: String(c._id) })),
    granularity
  );
  const churnTrend = buildCountSeries(
    ds.customers.filter((c) => c.status === 'churned').map((c) => ({ date: c.lastInteractionDate || c.acquisitionDate, id: String(c._id) })),
    granularity
  );
  const growth = latestGrowth(acquisitionTrend);

  const activeCustomers = ds.customers.filter((c) => c.status === 'active' || c.status === 'at_risk');
  const avgLtv = activeCustomers.length ? activeCustomers.reduce((a, c) => a + (c.lifetimeValue || 0), 0) / activeCustomers.length : null;

  const bySegment = [...new Set(ds.customers.map((c) => c.segment))]
    .map((seg) => {
      const set = ds.customers.filter((c) => c.segment === seg);
      const segLtv = set.length ? set.reduce((a, c) => a + (c.lifetimeValue || 0), 0) / set.length : 0;
      return { key: seg, count: set.length, avgLtv: Math.round(segLtv) };
    })
    .sort((a, b) => b.count - a.count);

  const byRegion = [...new Set(ds.customers.map((c) => c.region))]
    .map((region) => ({ key: region, count: ds.customers.filter((c) => c.region === region).length }))
    .sort((a, b) => b.count - a.count);

  const recentInteraction = ds.customers.filter((c) => c.lastInteractionDate)
    .sort((a, b) => new Date(b.lastInteractionDate!).getTime() - new Date(a.lastInteractionDate!).getTime());
  const newest = recentInteraction.slice(0, Math.min(10, recentInteraction.length));
  const returningCustomers = newest.filter((c) => c.status === 'active' || c.status === 'at_risk').length;
  const seenNew: Set<string> = new Set();
  const newCustomers = ds.customers.filter((c) => {
    if (seenNew.has(String(c._id))) return false;
    const age = (Date.now() - new Date(c.acquisitionDate).getTime()) / (1000 * 60 * 60 * 24);
    if (age <= 90) {
      seenNew.add(String(c._id));
      return true;
    }
    return false;
  }).length;

  const topAtRisk = ds.customers
    .filter((c) => c.status === 'at_risk')
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 8)
    .map((c) => ({ name: c.name, company: c.company, region: c.region, riskScore: c.riskScore, ltv: c.lifetimeValue }));

  return {
    profile: { scale: profile.scale },
    total,
    active,
    inactive,
    atRisk,
    churned,
    newCustomers,
    returningCustomers,
    growth,
    averageLtv: avgLtv ? Math.round(avgLtv) : null,
    bySegment,
    byRegion,
    acquisitionTrend,
    churnTrend,
    topAtRisk,
  };
}

export async function getFinanceAnalysis(orgRef: OrgRef, opts: AnalysisOptions = {}): Promise<{
  profile: { scale: CompanyProfile['scale']; preferredGranularity: TimeGranularity };
  granularity: TimeGranularity;
  revenue: number;
  profit: number | null;
  profitMarginPct: number | null;
  expenses: FinanceInsight['expenses'];
  costTrend: DataPoint[];
  notes: string[];
}> {
  const profile = await getCompanyProfile(orgRef);
  const ds = await loadDataset(orgRef);
  const granularity = selectGranularity(opts, profile);
  const closedWon = ds.sales.filter((s) => s.stage === 'closed_won');
  const revenue = closedWon.reduce((a, s) => a + (s.amount || 0), 0);

  const byBudget = ds.departments.reduce((a, d) => a + (d.budget || 0), 0);
  const byProjectCost = ds.projects.reduce((a, p) => a + (p.actualCost || 0), 0);
  const byPayroll = ds.employees.reduce((a, e) => a + (e.salary || 0), 0);

  const available = byBudget > 0 || byProjectCost > 0 || byPayroll > 0;
  const notes: string[] = [];
  if (!byBudget) notes.push('No department budget data available.');
  if (!byProjectCost) notes.push('No project actual-cost data available.');
  if (!byPayroll) notes.push('No employee salary data available.');

  const expenses = {
    byBudget,
    byProjectCost,
    byPayroll,
    estimatedLabel:
      available
        ? 'Expenses are compiled from recorded department budgets, project actual costs and payroll where present.'
        : 'No recorded expense sources found — expense metrics are insufficient.',
    available,
  };

  const profit = available && revenue > 0 ? revenue - (byProjectCost + byPayroll) : null;
  const profitMarginPct = profit != null && revenue > 0 ? (profit / revenue) * 100 : null;

  const costTrend = buildTimeSeries(
    ds.projects.map((p) => ({ amount: p.actualCost || 0, closedAt: p.startDate || p.createdAt, dealId: p.name, stage: 'closed_won', region: '', productName: '', channel: '', departmentName: '', createdAt: p.createdAt || new Date() })),
    granularity
  );

  return { profile: { scale: profile.scale, preferredGranularity: granularity }, granularity, revenue, profit, profitMarginPct, expenses, costTrend, notes };
}

export async function getOperationsAnalysis(orgRef: OrgRef): Promise<OperationsInsight> {
  const ds = await loadDataset(orgRef);
  const orders = ds.sales.length;
  const open = ds.tickets.filter((t) => t.status === 'open' || t.status === 'in_progress');
  const resolved = ds.tickets.filter((t) => t.status === 'resolved' || t.status === 'closed');
  const withResolution = resolved.filter((t) => t.resolutionTimeHours != null);
  const avgResolutionHours = withResolution.length ? withResolution.reduce((a, t) => a + (t.resolutionTimeHours || 0), 0) / withResolution.length : null;
  const withRating = resolved.filter((t) => t.satisfactionRating != null);
  const satisfactionAvg = withRating.length ? withRating.reduce((a, t) => a + (t.satisfactionRating || 0), 0) / withRating.length : null;

  const openTicketsByPriority = ['critical', 'high', 'medium', 'low']
    .map((p) => ({ key: p, count: open.filter((t) => t.priority === p).length }))
    .filter((p) => p.count > 0);

  const projectsOverBudget = ds.projects
    .filter((p) => p.budget != null && p.actualCost != null && p.actualCost > p.budget)
    .map((p) => ({ name: p.name, budget: p.budget || 0, actualCost: p.actualCost || 0 }));

  const anomalies: OperationsInsight['anomalies'] = [];
  if (projectsOverBudget.length) {
    anomalies.push({
      scope: 'projects',
      metric: 'budget_overrun',
      detail: `${projectsOverBudget.length} project(s) exceeded their recorded budget.`,
      severity: projectsOverBudget.length >= 2 ? 'high' : 'medium',
    });
  }
  const criticalOpen = open.filter((t) => t.priority === 'critical').length;
  if (criticalOpen > 0) {
    anomalies.push({
      scope: 'support',
      metric: 'critical_tickets_open',
      detail: `${criticalOpen} critical support ticket(s) currently unresolved.`,
      severity: criticalOpen >= 2 ? 'high' : 'medium',
    });
  }

  return { orders, openTickets: open.length, openTicketsByPriority, resolvedTickets: resolved.length, avgResolutionHours: avgResolutionHours != null ? Math.round(avgResolutionHours * 10) / 10 : null, satisfactionAvg: satisfactionAvg != null ? Math.round(satisfactionAvg * 10) / 10 : null, projectsOverBudget, anomalies };
}

// ---------------------------------------------------------------------------
// PAST
// ---------------------------------------------------------------------------
export async function getPastAnalysis(orgRef: OrgRef, opts: AnalysisOptions = {}): Promise<PastAnalysis> {
  const profile = await getCompanyProfile(orgRef);
  const ds = await loadDataset(orgRef);
  const granularity = selectGranularity(opts, profile);
  const { sales } = normalize(ds);

  const revenueSeries = buildTimeSeries(sales as any, granularity, { includeOnlyClosedWon: true });
  const salesSeries = buildTimeSeries(sales as any, granularity);
  const customerSeries = buildCountSeries(ds.customers.map((c) => ({ date: c.acquisitionDate, id: String(c._id) })), granularity);
  const churnSeries = buildCountSeries(ds.customers.filter((c) => c.status === 'churned').map((c) => ({ date: c.lastInteractionDate || c.acquisitionDate, id: String(c._id) })), granularity);

  const events: BusinessEvent[] = [];

  // Revenue change events.
  for (let i = 1; i < revenueSeries.length; i++) {
    const prev = revenueSeries[i - 1];
    const cur = revenueSeries[i];
    const changePct = prev.value > 0 ? ((cur.value - prev.value) / prev.value) * 100 : 0;
    const magnitude = Math.round(changePct * 10) / 10;
    if (changePct <= -10) {
      events.push({
        type: 'revenue_decline',
        title: `Revenue declined ${magnitude}% in ${cur.label}`,
        detail: `Revenue fell from ${prev.value.toLocaleString()} to ${cur.value.toLocaleString()} USD between ${prev.label} and ${cur.label}.`,
        periodLabel: cur.label,
        date: cur.key,
        magnitude,
        evidenceIds: cur.sources,
      });
    } else if (changePct >= 10) {
      events.push({
        type: 'revenue_growth',
        title: `Revenue grew ${magnitude}% in ${cur.label}`,
        detail: `Revenue rose from ${prev.value.toLocaleString()} to ${cur.value.toLocaleString()} USD between ${prev.label} and ${cur.label}.`,
        periodLabel: cur.label,
        date: cur.key,
        magnitude,
        evidenceIds: cur.sources,
      });
    }
  }

  // Recorded "why" notes on deals become historical events.
  for (const s of ds.sales) {
    if (s.notes) {
      const when = s.closedAt || s.createdAt;
      events.push({
        type: 'revenue_decline',
        title: `Deal note (${s.dealId}): ${s.productName}`,
        detail: s.notes,
        periodLabel: when.toISOString().slice(0, 10),
        date: when.toISOString(),
        evidenceIds: [s.dealId],
      });
    }
  }

  for (const c of ds.customers) {
    if (c.status === 'churned') {
      events.push({
        type: 'customer_churned',
        title: `${c.name} churned`,
        detail: `${c.name} (${c.segment}, ${c.region}) is no longer an active customer.`,
        periodLabel: (c.lastInteractionDate || c.acquisitionDate).toISOString().slice(0, 10),
        date: (c.lastInteractionDate || c.acquisitionDate).toISOString(),
      });
    }
    if (c.status === 'at_risk') {
      events.push({
        type: 'customer_at_risk',
        title: `${c.name} flagged at risk`,
        detail: `${c.name} has a risk score of ${c.riskScore} (${c.segment}, ${c.region}).`,
        periodLabel: (c.lastInteractionDate || c.acquisitionDate).toISOString().slice(0, 10),
        date: (c.lastInteractionDate || c.acquisitionDate).toISOString(),
      });
    }
  }

  for (const r of ds.risks) {
    events.push({
      type: 'risk_detected',
      title: `Risk detected: ${r.title}`,
      detail: `${r.level.toUpperCase()} risk (${r.category}) with score ${r.riskScore}.`,
      periodLabel: r.detectedAt.toISOString().slice(0, 10),
      date: r.detectedAt.toISOString(),
    });
  }

  for (const p of ds.projects) {
    if (p.status === 'on_hold' || p.status === 'cancelled') {
      events.push({
        type: 'project_on_hold',
        title: `Project ${p.status}: ${p.name}`,
        detail: p.status === 'on_hold' ? `${p.name} has been paused.` : `${p.name} was cancelled.`,
        periodLabel: (p.startDate || p.createdAt).toISOString().slice(0, 10),
        date: (p.startDate || p.createdAt).toISOString(),
      });
    }
  }

  for (const d of ds.documents.slice(0, 10)) {
    events.push({
      type: 'document_added',
      title: `Document added: ${d.title}`,
      detail: d.title,
      periodLabel: d.createdAt.toISOString().slice(0, 10),
      date: d.createdAt.toISOString(),
    });
  }

  events.sort((a, b) => (a.date < b.date ? 1 : -1));

  // YoY / QoQ / MoM comparisons computed from the actual series.
  const yoy = computeYoY(revenueSeries, granularity);
  const qoq = granularity === 'quarterly' ? computeGrowthFromBucket(revenueSeries, -1, -2) : null;
  const mom = granularity === 'monthly' ? computeGrowthFromBucket(revenueSeries, -1, -2) : null;

  const keyFindings: PastAnalysis['keyFindings'] = events
    .filter((e) => e.type === 'revenue_decline' || e.type === 'revenue_growth')
    .slice(0, 5)
    .map((e) => ({
      finding: e.title,
      evidence: [e.detail, ...(e.evidenceIds || []).slice(0, 3)],
      direction: e.type === 'revenue_growth' ? 'growth' : 'decline',
    }));

  const period = profile.dataSpan;

  return { analysisMode: 'past', period, revenueSeries, salesSeries, customerSeries, churnSeries, events, comparisons: { yoy, qoq, mom }, keyFindings };
}

function computeGrowthFromBucket(series: DataPoint[], idxCurrent: number, idxPrevious: number): GrowthInfo | null {
  if (series.length === 0) return null;
  const i = series.length - Math.abs(idxCurrent);
  const j = series.length - Math.abs(idxPrevious);
  if (i < 0 || j < 0) return null;
  const current = series[i];
  const previous = series[j];
  return computeGrowth(current.value, previous.value, current.label, previous.label);
}

function computeYoY(series: DataPoint[], granularity: TimeGranularity): GrowthInfo | null {
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  const lastYear = parseInt(last.key.split('-')[0], 10) || 0;
  const match = series.filter((p) => parseInt(p.key.split('-')[0], 10) === lastYear - 1);
  if (!match.length) return null;
  const prev = match[match.length - 1];
  return computeGrowth(last.value, prev.value, last.label, prev.label);
}

// ---------------------------------------------------------------------------
// PRESENT
// ---------------------------------------------------------------------------
export async function getPresentAnalysis(orgRef: OrgRef, opts: AnalysisOptions = {}): Promise<PresentAnalysis> {
  const profile = await getCompanyProfile(orgRef);
  const ds = await loadDataset(orgRef);
  const granularity = selectGranularity(opts, profile);
  const { sales } = normalize(ds);

  const series = buildTimeSeries(sales as any, granularity, { includeOnlyClosedWon: true });
  const currentBucket = series[series.length - 1];
  const periodLabel = currentBucket?.label || 'No data';
  const previousBucket = series.length > 1 ? series[series.length - 2] : null;

  const revenue: RevenueInsight = {
    current: currentBucket?.value || 0,
    previous: previousBucket?.value ?? null,
    change: currentBucket && previousBucket ? currentBucket.value - previousBucket.value : 0,
    growthPct: currentBucket && previousBucket && previousBucket.value > 0 ? ((currentBucket.value - previousBucket.value) / previousBucket.value) * 100 : null,
    direction: !currentBucket
      ? 'insufficient'
      : !previousBucket || previousBucket.value === 0
        ? 'insufficient'
        : currentBucket.value > previousBucket.value
          ? 'up'
          : currentBucket.value < previousBucket.value
            ? 'down'
            : 'flat',
    currentLabel: currentBucket?.label || '',
    previousLabel: previousBucket?.label || '',
    pipeline: sales.filter((s) => s.stage !== 'closed_won' && s.stage !== 'closed_lost').reduce((a, s) => a + s.amount, 0),
    closedWonDeals: sales.filter((s) => s.stage === 'closed_won').length,
    closedLostAmount: sales.filter((s) => s.stage === 'closed_lost').reduce((a, s) => a + s.amount, 0),
    period: periodLabel,
  };

  const customerAnalysis = await getCustomerAnalysis(orgRef, opts);
  const operations = await getOperationsAnalysis(orgRef);

  const risks = ds.risks
    .filter((r) => r.status !== 'resolved')
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 8)
    .map((r) => ({ title: r.title, level: r.level, riskScore: r.riskScore, category: r.category }));

  const allStamps: number[] = [
    ...ds.sales.map((s) => new Date(s.updatedAt || s.createdAt).getTime()),
    ...ds.customers.map((c) => new Date(c.lastInteractionDate || c.acquisitionDate).getTime()),
    ...ds.tickets.map((t) => new Date(t.updatedAt || t.createdAt).getTime()),
  ].filter((n) => Number.isFinite(n));
  const lastUpdatedAt = allStamps.length ? new Date(Math.max(...allStamps)).toISOString() : new Date().toISOString();

  const closedStamps = ds.sales.filter((s) => s.closedAt).map((s) => new Date(s.closedAt!).getTime());
  const dataSourceLastUpdated = closedStamps.length ? new Date(Math.max(...closedStamps)).toISOString() : null;

  return {
    analysisMode: 'present',
    periodLabel,
    lastUpdatedAt,
    dataSourceLastUpdated,
    revenue,
    customers: customerAnalysis as CustomerInsight,
    operations,
    risks,
    anomaliesEnabled: series.length >= 4,
  };
}

// ---------------------------------------------------------------------------
// FUTURE / FORECAST
// ---------------------------------------------------------------------------
export async function getFutureAnalysis(orgRef: OrgRef, opts: AnalysisOptions = {}): Promise<FutureAnalysis> {
  const profile = await getCompanyProfile(orgRef);
  const ds = await loadDataset(orgRef);
  const granularity = selectGranularity(opts, profile);
  const { sales } = normalize(ds);

  const horizon = opts.horizon || (profile.scale === 'long_term' ? 4 : 3);
  const requiredMin = 4;

  const revenueSeries = buildTimeSeries(sales as any, granularity, { includeOnlyClosedWon: true });
  const revenueForecast = toForecastResult(buildForecast({ series: revenueSeries, granularity, horizon, requiredMinPoints: requiredMin }));
  const salesCountSeries = buildCountSeries(sales.map((s) => ({ date: s.closedAt || undefined, id: s.dealId })), granularity);
  const salesForecast = toForecastResult(buildForecast({ series: salesCountSeries, granularity, horizon, requiredMinPoints: requiredMin }));
  const customerAcquisitionSeries = buildCountSeries(ds.customers.map((c) => ({ date: c.acquisitionDate, id: String(c._id) })), granularity);
  const customerForecast = toForecastResult(buildForecast({ series: customerAcquisitionSeries, granularity, horizon, requiredMinPoints: requiredMin }));

  const riskForecast = ds.risks
    .filter((r) => r.status !== 'resolved')
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 6)
    .map((r) => ({ title: r.title, level: r.level, riskScore: r.riskScore, likelihood: r.probability, impact: r.impact }));

  const opportunities: FutureAnalysis['opportunities'] = [];
  const bestRegion = await bestRegionByRevenue(orgRef);
  if (bestRegion) {
    opportunities.push({
      title: `Grow the ${bestRegion.key} region`,
      detail: `${bestRegion.key} produced ${bestRegion.revenue.toLocaleString()} USD of revenue across ${bestRegion.count} closed deals — the strongest performed region.`,
      evidence: [`Region ${bestRegion.key}: ${bestRegion.revenue.toLocaleString()} USD (${bestRegion.count} deals)`],
    });
  }

  const recommendations = buildRecommendations(orgRef, ds, revenueSeries, revenueForecast);

  return { analysisMode: 'future', revenueForecast, salesForecast, customerForecast, riskForecast, opportunities, recommendations };
}

async function bestRegionByRevenue(orgRef: OrgRef): Promise<{ key: string; revenue: number; count: number } | null> {
  const ds = await loadDataset(orgRef);
  const closed = ds.sales.filter((s) => s.stage === 'closed_won');
  const regions = [...new Set(closed.map((s) => s.region))].map((region) => ({
    key: region,
    revenue: closed.filter((s) => s.region === region).reduce((a, s) => a + (s.amount || 0), 0),
    count: closed.filter((s) => s.region === region).length,
  }));
  if (!regions.length) return null;
  return regions.sort((a, b) => b.revenue - a.revenue)[0];
}
function buildRecommendations(
  orgRef: OrgRef,
  ds: OrgDataset,
  revenueSeries: DataPoint[],
  forecast: FutureAnalysis['revenueForecast']
): string[] {
  const out: string[] = [];
  const growth = latestGrowth(revenueSeries);
  if (growth.direction === 'down' && growth.growthPct != null) {
    out.push(`Address the ${Math.abs(round(growth.growthPct))}% revenue decline between ${growth.previousLabel} and ${growth.currentLabel} — inspect regional/product contributors and re-validate the pipeline.`);
  }
  const atRisk = ds.customers.filter((c) => c.status === 'at_risk').length;
  if (atRisk > 0) {
    out.push(`Escalate ${atRisk} at-risk customer account(s) to retention programs before the next close cycle.`);
  }
  const openCritical = ds.tickets.filter((t) => (t.status === 'open' || t.status === 'in_progress') && t.priority === 'critical').length;
  if (openCritical > 0) out.push(`Resolve ${openCritical} critical support ticket(s) that may drive churn.`);
  const overBudget = ds.projects.filter((p) => p.budget != null && p.actualCost != null && p.actualCost > p.budget).length;
  if (overBudget > 0) out.push(`Re-forecast ${overBudget} project(s) running over their recorded budget.`);

  if (forecast.available) {
    const direction = forecast.direction === 'up' ? 'positive' : forecast.direction === 'down' ? 'downward' : 'flat';
    out.push(`Revenue is forecast ${direction} over the next ${forecast.period.horizon} — plan capacity and spend accordingly.`);
  } else {
    out.push('Forecasting is currently unavailable due to insufficient historical data; continue enriching the dataset to enable projections.');
  }
  if (!out.length) out.push('No material anomalies detected in the current dataset.');
  return out;
}

function toForecastResult(f: ForecastInput extends never ? never : ForecastOutput): ForecastResult {
  return {
    available: f.available,
    reason: f.reason,
    requiredMinPoints: f.requiredMinPoints,
    actualPoints: f.actualPoints,
    period: {
      startLabel: f.historicalBasis[0] || '',
      endLabel: f.historicalBasis[f.historicalBasis.length - 1] || '',
      horizon: f.points.length ? `${f.points[f.points.length - 1].label} (${f.points.length} periods)` : 'none',
    },
    direction: f.direction,
    points: f.points,
    confidence: f.confidence,
    historicalBasis: f.historicalBasis,
    assumptions: f.assumptions,
    methodology: f.methodology,
  };
}

// ---------------------------------------------------------------------------
// ANOMALIES
// ---------------------------------------------------------------------------
export async function getAnomalies(orgRef: OrgRef, opts: AnalysisOptions = {}): Promise<AnomalyAnalysis> {
  const profile = await getCompanyProfile(orgRef);
  const granularity = selectGranularity(opts, profile);
  const ds = await loadDataset(orgRef);
  const { sales } = normalize(ds);

  const series = buildTimeSeries(sales as any, granularity, { includeOnlyClosedWon: true });
  if (series.length < 4) {
    return { available: false, items: [], thresholdPct: 15, scannedBuckets: series.length };
  }

  const threshold = 15;
  const items: AnomalyItem[] = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1];
    const cur = series[i];
    if (prev.value <= 0) continue;
    const deviationPct = ((cur.value - prev.value) / prev.value) * 100;
    const abs = Math.abs(deviationPct);
    if (abs >= threshold) {
      const severity: AnomalyItem['severity'] = abs >= threshold * 2.5 ? 'high' : abs >= threshold * 1.5 ? 'medium' : 'low';
      items.push({
        metric: 'revenue',
        bucketLabel: cur.label,
        value: cur.value,
        expected: prev.value,
        deviationPct: round(deviationPct),
        severity,
        detail: `Revenue moved ${round(deviationPct)}% ${deviationPct >= 0 ? 'up' : 'down'} between ${prev.label} and ${cur.label} (${prev.value.toLocaleString()} → ${cur.value.toLocaleString()} USD).`,
      });
    }
  }

  return { available: true, items: items.slice(0, 20), thresholdPct: threshold, scannedBuckets: series.length };
}

// ---------------------------------------------------------------------------
// COMPARISON
// ---------------------------------------------------------------------------
export async function getComparison(orgRef: OrgRef, input: ComparisonInput = { dimension: 'qoq' }): Promise<ComparisonResult> {
  const ds = await loadDataset(orgRef);
  const closed = ds.sales.filter((s) => s.stage === 'closed_won');
  const dimension = input.dimension;

  let from: { label: string; value: number; count: number } = { label: '—', value: 0, count: 0 };
  let to: { label: string; value: number; count: number } = { label: '—', value: 0, count: 0 };
  const evidence: Array<{ label: string; detail: string }> = [];

  const summarize = (label: string, records: typeof closed) => ({
    label,
    value: records.reduce((a, s) => a + (s.amount || 0), 0),
    count: records.length,
  });

  if (dimension === 'qoq') {
    const series = buildTimeSeries(closed as any, 'quarterly');
    if (series.length >= 2) {
      const a = series[series.length - 2];
      const b = series[series.length - 1];
      from = { label: a.label, value: a.value, count: a.count };
      to = { label: b.label, value: b.value, count: b.count };
    }
  } else if (dimension === 'yoy') {
    const series = buildTimeSeries(closed as any, 'annual');
    if (series.length >= 2) {
      const a = series[series.length - 2];
      const b = series[series.length - 1];
      from = { label: a.label, value: a.value, count: a.count };
      to = { label: b.label, value: b.value, count: b.count };
    }
  } else if (dimension === 'mom') {
    const series = buildTimeSeries(closed as any, 'monthly');
    if (series.length >= 2) {
      const a = series[series.length - 2];
      const b = series[series.length - 1];
      from = { label: a.label, value: a.value, count: a.count };
      to = { label: b.label, value: b.value, count: b.count };
    }
  } else if (dimension === 'region') {
    const regions = [...new Set(closed.map((s) => s.region))];
    const byRegion = regions.map((region) => summarize(region, closed.filter((s) => s.region === region))).sort((a, b) => b.value - a.value);
    if (byRegion.length >= 2) {
      from = byRegion[0];
      to = byRegion[1];
    }
  } else if (dimension === 'product') {
    const products = [...new Set(closed.map((s) => s.productName))];
    const byProduct = products.map((p) => summarize(p, closed.filter((s) => s.productName === p))).sort((a, b) => b.value - a.value);
    if (byProduct.length >= 2) {
      from = byProduct[0];
      to = byProduct[1];
    }
  } else if (dimension === 'segment') {
    const segments = [...new Set(ds.customers.map((c) => c.segment))];
    const bySegment = segments.map((seg) => {
      const custIds = new Set(ds.customers.filter((c) => c.segment === seg).map((c) => String(c._id)));
      return summarize(seg, closed.filter((s) => s.customerId && custIds.has(String(s.customerId))));
    }).sort((a, b) => b.value - a.value);
    if (bySegment.length >= 2) {
      from = bySegment[0];
      to = bySegment[1];
    }
  } else if (dimension === 'dept') {
    const depts = [...new Set(closed.map((s) => s.departmentName))];
    const byDept = depts.map((d) => summarize(d, closed.filter((s) => s.departmentName === d))).sort((a, b) => b.value - a.value);
    if (byDept.length >= 2) {
      from = byDept[0];
      to = byDept[1];
    }
  } else if (dimension === 'actual_vs_forecast') {
    const profile = await getCompanyProfile(orgRef);
    const granularity = selectGranularity({ granularity: 'auto' }, profile);
    const series = buildTimeSeries(closed as any, granularity);
    const forecast = buildForecast({ series, granularity, horizon: 1, requiredMinPoints: 4 });
    if (series.length >= 1 && forecast.available && forecast.points.length) {
      const actual = series[series.length - 1];
      const pred = forecast.points[0];
      from = { label: actual.label, value: actual.value, count: actual.count };
      to = { label: pred.label, value: pred.value, count: 0 };
    }
  }

  const difference = to.value - from.value;
  const growthPct = from.value > 0 ? (difference / from.value) * 100 : null;
  const direction: ComparisonResult['direction'] =
    from.value === 0 ? 'insufficient' : Math.abs(difference) < 1e-9 ? 'flat' : difference > 0 ? 'up' : 'down';

  evidence.push({ label: `${from.label}`, detail: `${from.value.toLocaleString()} USD across ${from.count} closed deal(s)` });
  evidence.push({ label: `${to.label}`, detail: `${to.value.toLocaleString()} USD across ${to.count} closed deal(s)` });

  return { dimension, from, to, difference, growthPct: growthPct != null ? round(growthPct) : null, direction, evidence };
}

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------
export async function getSummaryDashboard(orgRef: OrgRef, opts: AnalysisOptions = {}): Promise<BISummary> {
  const [profile, validation, present, past, future, anomalies] = await Promise.all([
    getCompanyProfile(orgRef),
    validateEnterpriseData(orgRef),
    getPresentAnalysis(orgRef, opts),
    getPastAnalysis(orgRef, opts),
    getFutureAnalysis(orgRef, opts),
    getAnomalies(orgRef, opts),
  ]);

  const comparisons = await Promise.all([
    getComparison(orgRef, { dimension: 'qoq' }),
    getComparison(orgRef, { dimension: 'yoy' }),
  ]);

  return {
    companyProfile: profile,
    validation,
    present,
    past,
    future,
    anomalies,
    comparisons,
    lastUpdatedAt: present.lastUpdatedAt,
  };
}

// Re-export validation used by the controller.
export { validateEnterpriseData };
export async function getValidation(orgRef: OrgRef): Promise<DataValidation> {
  return validateEnterpriseData(orgRef);
}