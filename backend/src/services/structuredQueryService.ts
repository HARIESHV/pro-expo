import mongoose from 'mongoose';
import { SalesRecord } from '../models/SalesRecord';
import { Employee } from '../models/Employee';
import { Customer } from '../models/Customer';
import { Project } from '../models/Project';
import { Risk } from '../models/Risk';
import { SupportTicket } from '../models/SupportTicket';
import { Department } from '../models/Department';
import type { QueryUnderstanding } from '../types';
import { Source } from '../types';
import { logger } from '../config/logger';

/**
 * Deterministic, LLM-free resolver for enterprise data questions.
 *
 * This is the SINGLE SOURCE OF TRUTH for grounded enterprise answers. It parses
 * the user's intent using synonym + entity expansion (no exact database
 * terminology required), resolves entities from the query and any recent
 * conversation context, queries the real Mongo collections directly, and
 * performs calculations (totals, differences, percentages, comparisons).
 *
 * Crucially it is independent of the LLM provider — if the AI API is throttled
 * or offline, the user still gets a real, grounded answer rather than a
 * "couldn't retrieve a matching record" failure message.
 */

export interface StructuredAnswer {
  matched: boolean;
  answer?: string;
  keyFindings?: string[];
  sources?: Source[];
  confidence: number;
  /** Normalized intent, useful for logging the detected intent. */
  intent?: string;
  /** Entities that were resolved (for logging + debugging). */
  entities?: string[];
}

interface ResolveContext {
  organizationId: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

const money = (n: number): string => `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const pct = (n: number): string => `${Number(n).toFixed(1)}%`;

function normalize(q: string): string {
  return q.toLowerCase().replace(/[?.!,'"]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Entity aliases: partial names / abbreviations / suffixes -> canonical label
// ---------------------------------------------------------------------------
const ENTITY_ALIASES: Array<{ keys: string[]; label: string }> = [
  { keys: ['abc technologies', 'abc tech', 'abc', 'abc technologies pvt'], label: 'ABC Technologies' },
  { keys: ['stark industries', 'stark'], label: 'Stark Industries' },
  { keys: ['wayne enterprises', 'wayne'], label: 'Wayne Enterprises' },
  { keys: ['oscorp biotech', 'oscorp'], label: 'Oscorp Biotech' },
  { keys: ['lexcorp global', 'lexcorp'], label: 'LexCorp Global' },
  { keys: ['product x', 'proj-x', 'projx', 'product x engine'], label: 'Product X Engine' },
];

// ---------------------------------------------------------------------------
// Intent / synonym expansion. Map natural language to an intent category.
// ---------------------------------------------------------------------------
interface IntentRule {
  intent: string;
  keys: string[];
}

const INTENT_RULES: IntentRule[] = [
  {
    intent: 'overview',
    keys: [
      'overview', 'about the company', 'about our company', 'about this enterprise',
      'about the enterprise', 'tell me about the company', 'tell me about this enterprise',
      'tell me about our company', 'company overview', 'executive summary',
      'what can you tell me', 'give me a summary', 'summarize the company',
      'company performance', 'business performance', 'how did the business perform',
      'how is the business', 'how is the company', 'how did the company perform',
      'what is the company performance', 'how are things', 'financial snapshot',
      'company summary', 'business summary', 'state of the business', 'state of the company',
    ],
  },
  {
    intent: 'revenue',
    keys: [
      'revenue', 'sales', 'income', 'turnover', 'earnings', 'earning', 'made',
      'make', 'make money', 'money', 'financial performance', 'financials', 'finance',
      'q1', 'q2', 'q3', 'q4', 'how much did', 'how much money', 'annual', 'yearly',
      'profit', 'grew', 'growth', 'top product', 'best seller', 'total income',
      'last quarter', 'this quarter', 'money did the company', 'money did they',
      'did the company make', 'did they make', 'money made', 'did they earn',
      'did the company earn', 'how much earned', 'how much did the business',
      'revenue generated', 'sales generated', 'top line', 'bottom line', 'financials',
      'what did the company make', 'how did sales', 'how were sales',
      'performed better', 'perform better', 'which quarter', 'which did better',
      'which was better', 'which performed',
    ],
  },
  {
    intent: 'employees',
    keys: [
      'employee', 'headcount', 'people work', 'staff', 'workforce', 'hired',
      'how many people', 'people working there', 'team size', 'personnel',
      'organizational chart', 'who works', 'department', 'rd', 'research',
      'how many people work', 'how big is the team', 'how many staff',
    ],
  },
  {
    intent: 'customers',
    keys: [
      'customer', 'client', 'account', 'who buys', 'buy from', 'buyers',
      'accounts', 'who are our', 'who are the', 'who are their', 'their customers',
      'their clients', 'customer base', 'clients',
    ],
  },
  {
    intent: 'projects',
    keys: [
      'project', 'initiative', 'product', 'workstream', 'milestone',
      'what are they working on', 'what are you working on', 'working on',
      'what is the company working', 'are working on',
    ],
  },
  {
    intent: 'risks',
    keys: [
      'risk', 'threat', 'churn', 'vulnerability', 'open issue', 'incident',
      'at risk', 'what risks', 'problems', 'issues', 'concerns',
    ],
  },
  {
    intent: 'tickets',
    keys: [
      'ticket', 'support case', 'support request', 'open support', 'helpdesk',
      'issue report', 'help requests', 'support requests', 'open tickets',
    ],
  },
];

/**
 * Pick the earliest-matching intent rule. Revenue/customers share some words
 * ("who are the customers?" -> customers must win), so order matters; we score
 * by which rule has the most keyword hits in the resolved query.
 */
function detectIntent(q: string, qLower: string): string {
  let best = 'unknown';
  let bestScore = 0;
  for (const rule of INTENT_RULES) {
    let score = 0;
    for (const k of rule.keys) {
      if (k.includes(' ')) {
        // Multiple-word keys are specific enough to match as substrings.
        if (qLower.includes(k)) score += 2;
      } else {
        // Single-token keywords MUST match on word boundaries. Otherwise short
        // ambiguous keywords hijack unrelated general questions; e.g. the
        // revenue keyword "earning" would wrongly match inside "machine
        // learning" / "meaning", routing a general AI question to the
        // enterprise data resolver and returning unrelated business figures.
        const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`\\b${escaped}\\b`, 'i').test(qLower)) score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = rule.intent;
    }
  }
  return bestScore > 0 ? best : 'unknown';
}

/**
 * Resolve any entity mentioned in the query OR recent conversation history.
 * Supports partial names, abbreviations, and "their / it / they" style
 * references by remembering the last entity from history.
 *
 * History entities are ONLY applied when the current query contains an actual
 * referential signal (a pronoun such as "their / it / they / them / its", or
 * a "the company / that company / this company" style reference). This avoids
 * wrongly scoping a fresh, self-contained question to a stale entity that
 * happened to appear in an earlier turn.
 */
function resolveTargetEntity(query: string, context: ResolveContext): string | undefined {
  const qLower = normalize(query);
  const direct = ENTITY_ALIASES.find((e) => e.keys.some((k) => qLower.includes(k)));
  if (direct) return direct.label;

  // Express or implicit references that mean "the previously-mentioned entity".
  const hasReferenceSignal =
    /\b(its|their|theirs|they'?re|them)\b/.test(qLower) ||
    /(^|\s)(it|they)(\s|$|[?.!,])/.test(qLower) ||
    /\b(the company|that company|this company|the firm|that firm)\b/.test(qLower);

  if (!hasReferenceSignal) return undefined;

  // The most recent entity mentioned before the current user turn.
  const history = context.history || [];
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'user') break;
    const msg = normalize(history[i].content);
    const found = ENTITY_ALIASES.find((e) => e.keys.some((k) => msg.includes(k)));
    if (found) return found.label;
  }
  return undefined;
}



export class StructuredQueryService {
  async resolve(query: string, context: ResolveContext): Promise<StructuredAnswer> {
    const orgId = new mongoose.Types.ObjectId(context.organizationId);
    const qLower = normalize(query);
    const intent = detectIntent(query, qLower);

    // Resolve the entity the question refers to (from query or history).
    const entity = resolveTargetEntity(query, context);
    const entities = entity ? [entity] : [];

    let result: StructuredAnswer;
    try {
      switch (intent) {
        case 'overview':
          result = await this.resolveOverview(orgId, entity);
          break;
        case 'revenue':
          result = await this.resolveRevenue(orgId, query, context);
          break;
        case 'employees':
          result = await this.resolveHeadcount(orgId, query, context);
          break;
        case 'customers':
          result = await this.resolveCustomers(orgId, query);
          break;
        case 'projects':
          result = await this.resolveProjects(orgId, query);
          break;
        case 'risks':
          result = await this.resolveRisks(orgId, query);
          break;
        case 'tickets':
          result = await this.resolveTickets(orgId, query);
          break;
        default:
          return { matched: false, confidence: 0, intent, entities };
      }
    } catch (err) {
      logger.error('[StructuredQueryService] Resolver error:', err);
      return { matched: false, confidence: 0, intent, entities };
    }

    return {
      ...result,
      intent,
      entities: result.entities && result.entities.length ? result.entities : entities,
    };
  }

  private async resolveRevenue(
    orgId: mongoose.Types.ObjectId,
    query: string,
    context: ResolveContext
  ): Promise<StructuredAnswer> {
    const qLower = normalize(query);
    const scopeName = resolveTargetEntity(query, context);

    const match: Record<string, unknown> = { organizationId: orgId };
    let scopedCustomer: string | undefined;
    if (scopeName) {
      const cid = await this.findCustomerId(orgId, scopeName);
      if (cid) {
        match.customerId = cid;
        scopedCustomer = scopeName;
      }
    }

    // Revenue is recognized on closed_won deals only — do not count lost deals.
    const totals = await SalesRecord.aggregate([
      { $match: { ...match, stage: 'closed_won' } },
      {
        $group: {
          _id: { year: '$period.year', quarter: '$period.quarter' },
          revenue: { $sum: '$amount' },
          deals: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.quarter': 1 } },
    ]);

    if (!totals.length) {
      if (scopedCustomer) {
        return {
          matched: true,
          confidence: 0.6,
          answer: `There is no recorded closed revenue for ${scopedCustomer} in the available sales data.`,
          keyFindings: [`No closed-won sales recorded for ${scopedCustomer}.`],
          sources: [{ id: 'sales-records', title: 'Sales Records', type: 'database', relevanceScore: 0.6 }],
        };
      }
      return { matched: true, confidence: 0, answer: undefined };
    }

    const byQuarter = new Map<string, number>();
    let total = 0;
    let dealCount = 0;
    for (const row of totals as Array<{ _id: { year: number; quarter: number }; revenue: number; deals: number }>) {
      const key = `${row._id.year} Q${row._id.quarter}`;
      byQuarter.set(key, row.revenue);
      total += row.revenue;
      dealCount += row.deals;
    }

    const keys = Array.from(byQuarter.keys()).sort();
    const q1 = byQuarter.get(keys[0] || '') || 0;
    const q2 = keys.length > 1 ? byQuarter.get(keys[1]) || 0 : 0;

    const qBreakdown = keys.map((k) => `${k} ${money(byQuarter.get(k) || 0)}`).join(', ');

    // Explicit single-quarter request (e.g. "What was Q1 revenue?").
    const specificQuarter = qLower.match(/\bq([1-4])\b/);
    if (specificQuarter && !qLower.includes('compare') && !qLower.includes('total') && !qLower.includes('versus') && !qLower.includes(' vs ')) {
      const requested = `Q${specificQuarter[1]}`;
      const requestedKey = keys.find((k) => k.endsWith(` ${requested}`));
      if (requestedKey) {
        const revenue = byQuarter.get(requestedKey) || 0;
        return {
          matched: true,
          answer: scopedCustomer
            ? `${requested} revenue for ${scopedCustomer} was ${money(revenue)}.`
            : `${requested} revenue was ${money(revenue)}.`,
          keyFindings: [`${requested} revenue: ${money(revenue)}`],
          sources: [{ id: 'sales-records', title: 'Sales Records', type: 'database', relevanceScore: 0.95 }],
          confidence: 0.9,
        };
      }
      return {
        matched: true,
        answer: `There is no recorded ${requested} revenue in the available sales data. The available data covers: ${qBreakdown}.`,
        keyFindings: keys.map((k) => `${k} revenue: ${money(byQuarter.get(k) || 0)}`),
        sources: [{ id: 'sales-records', title: 'Sales Records', type: 'database', relevanceScore: 0.6 }],
        confidence: 0.6,
      };
    }

    // Comparison / Q1-vs-Q2 / growth / difference / "which quarter performed better".
    const comparing = qLower.includes('compare') || qLower.includes('versus') || qLower.includes(' vs ') ||
      (qLower.includes('q1') && qLower.includes('q2') && keys.length >= 2) ||
      qLower.includes('difference') || qLower.includes('growth') || qLower.includes('change') ||
      qLower.includes('performed better') || qLower.includes('which quarter') ||
      qLower.includes('which one did better') || qLower.includes('how did sales') ||
      qLower.includes('how were sales') || qLower.includes('which was better');

    let answer: string;
    let keyFindings: string[];

    if (scopedCustomer) {
      answer = `${scopedCustomer} has generated ${money(total)} in total revenue across ${dealCount} closed deal(s)${keys.length ? ` (${qBreakdown})` : ''}.`;
      keyFindings = [
        `${scopedCustomer} total revenue: ${money(total)}`,
        `Recorded over ${dealCount} closed-won deal(s).`,
        ...keys.map((k) => `${k}: ${money(byQuarter.get(k) || 0)}`),
      ];
    } else if (qLower.includes('last quarter') && keys.length >= 1) {
      // "How were sales last quarter?" -> report the most recent recorded quarter.
      const lastKey = keys[keys.length - 1];
      const lastRev = byQuarter.get(lastKey) || 0;
      const priorKey = keys.length > 1 ? keys[keys.length - 2] : undefined;
      const priorRev = priorKey ? byQuarter.get(priorKey) || 0 : 0;
      let sentence = `In the most recent recorded quarter (${lastKey}) revenue was ${money(lastRev)}.`;
      if (priorKey) {
        const diff = lastRev - priorRev;
        const pctVal = priorRev !== 0 ? ((diff / priorRev) * 100) : 0;
        sentence += ` That is a change of ${diff >= 0 ? '+' : ''}${money(diff)} (${pct(pctVal)}) compared to ${priorKey} (${money(priorRev)}).`;
      }
      answer = sentence;
      keyFindings = [
        `${lastKey} revenue: ${money(lastRev)}`,
        ...(priorKey ? [`${priorKey} revenue: ${money(priorRev)}`] : []),
        `Total revenue: ${money(total)}`,
      ];
    } else if (qLower.includes('performed better') || qLower.includes('which quarter') || qLower.includes('which one did better') || qLower.includes('which was better')) {
      // "Which quarter performed better?" -> report the best quaarter and its figure.
      let bestKey = keys[0];
      let bestRev = byQuarter.get(bestKey) || 0;
      for (const k of keys) {
        const v = byQuarter.get(k) || 0;
        if (v > bestRev) {
          bestRev = v;
          bestKey = k;
        }
      }
      answer = `${bestKey} performed best with ${money(bestRev)} in revenue. Overall total is ${money(total)} across ${keys.length} quarter(s) (${qBreakdown}).`;
      keyFindings = [
        `Best quarter: ${bestKey} (${money(bestRev)})`,
        ...keys.map((k) => `${k}: ${money(byQuarter.get(k) || 0)}`),
        `Total revenue: ${money(total)}`,
      ];
    } else if (comparing && keys.length >= 2) {
      const diff = q2 - q1;
      const pctVal = q1 !== 0 ? ((diff / q1) * 100) : 0;
      answer = `Revenue was ${money(q1)} in ${keys[0]} and ${money(q2)} in ${keys[1]}, a change of ${diff >= 0 ? '+' : ''}${money(diff)} (${pct(pctVal)}). The total revenue is ${money(total)}.`;
      keyFindings = [
        `${keys[0]} revenue: ${money(q1)}`,
        `${keys[1]} revenue: ${money(q2)}`,
        `Change: ${diff >= 0 ? '+' : ''}${money(diff)} (${pct(pctVal)})`,
        `Total revenue: ${money(total)}`,
      ];
    } else if (qLower.includes('total') || qLower.includes('overall') || qLower.includes('all ') && keys.length > 1) {
      answer = `The total revenue is ${money(total)}, based on the available Q1 revenue of ${money(q1)} and Q2 revenue of ${money(q2)}.`;
      keyFindings = [`Total revenue: ${money(total)}`, `Across ${dealCount} closed deal(s).`];
    } else {
      answer = `The total recorded revenue is ${money(total)} across ${dealCount} closed deal(s). By quarter: ${qBreakdown}.`;
      keyFindings = keys.map((k) => `${k} revenue: ${money(byQuarter.get(k) || 0)}`);
    }

    const sources: Source[] = [
      { id: 'sales-records', title: 'Sales Records', type: 'database', relevanceScore: 0.95 },
    ];

    return { matched: true, answer, keyFindings, sources, confidence: 0.94 };
  }

  private async resolveHeadcount(orgId: mongoose.Types.ObjectId, query: string, _context: ResolveContext): Promise<StructuredAnswer> {
    const qLower = normalize(query);
    const deptMap: Array<{ keys: string[]; label: string }> = [
      { keys: ['r&d', 'research', 'product development'], label: 'research' },
      { keys: ['sales'], label: 'sales' },
      { keys: ['customer success', 'support'], label: 'customer success' },
      { keys: ['finance', 'compliance'], label: 'finance' },
      { keys: ['human resources', 'hr'], label: 'hr' },
      { keys: ['operations'], label: 'operations' },
    ];
    const depMatch = deptMap.find((d) => d.keys.some((k) => qLower.includes(k)));

    const match: Record<string, unknown> = { organizationId: orgId, status: 'active' };
    if (depMatch) {
      const dept = await Department.findOne({
        organizationId: orgId,
        $or: [{ name: new RegExp(depMatch.label, 'i') }, { code: new RegExp(depMatch.label, 'i') }],
      }).lean();
      if (dept) match.departmentId = dept._id;
    }

    // Authoritative headcount figures live on the Department collections
    // (they include planned/approved headcount, e.g. R&D: 24). Use them when
    // available, and fall back to the actual employee roster otherwise.
    const departments = await Department.find({ organizationId: orgId })
      .select('name code headcount')
      .lean();
    const deptByName = new Map<string, number>();
    for (const d of departments) {
      if (typeof d.headcount === 'number' && d.headcount > 0) {
        deptByName.set(d.name, d.headcount);
      }
    }

    const deptTotal = Array.from(deptByName.values()).reduce((a, b) => a + b, 0);
    const rosterTotal = await Employee.countDocuments(match);

    // If a specific department was requested, the authoritative headcount for
    // that department beats the (sparse) employee-roster count.
    if (depMatch && match.departmentId) {
      const dept = departments.find((d) => String(d._id) === String(match.departmentId));
      const authoritative = dept && typeof dept.headcount === 'number' ? dept.headcount : rosterTotal;
      return {
        matched: true,
        answer: `The ${depMatch.label} department has ${authoritative} employee(s) on record${authoritative !== rosterTotal && rosterTotal > 0 ? ` (${rosterTotal} currently tracked in the active roster)` : ''}.`,
        keyFindings: [`${depMatch.label} headcount: ${authoritative}`],
        sources: [{ id: 'department-records', title: 'Headcount & Department Records', type: 'database', relevanceScore: 0.95 }],
        confidence: 0.9,
      };
    }

    // Total headcount: prefer the authoritative department sum; fall back to
    // the actual employee roster count when departments have no headcount.
    const reportedTotal = deptTotal > 0 && departments.some((d) => d.headcount > 0)
      ? deptTotal
      : Math.max(deptTotal, rosterTotal);

    let answer = `The company has ${reportedTotal} employees on record.`;
    let keyFindings: string[] = [
      `Total employees: ${reportedTotal}`,
      `(${rosterTotal} currently tracked in the active employee roster)`,
    ];

    if (deptByName.size > 0) {
      const lines = Array.from(deptByName.entries())
        .map(([name, count]) => `${name}: ${count}`)
        .join(', ');
      answer += ` By department: ${lines}.`;
      keyFindings = Array.from(deptByName.entries()).map(([name, count]) => `${name}: ${count} employees`);
    }

    return {
      matched: true,
      answer,
      keyFindings,
      sources: [{ id: 'department-records', title: 'Headcount & Department Records', type: 'database', relevanceScore: 0.95 }],
      confidence: 0.94,
    };
  }

  private async resolveCustomers(orgId: mongoose.Types.ObjectId, _query: string): Promise<StructuredAnswer> {
    const customers = await Customer.find({ organizationId: orgId })
      .select('name status lifetimeValue riskScore region')
      .sort({ lifetimeValue: -1 })
      .limit(20)
      .lean();

    if (!customers.length) {
      return { matched: true, confidence: 0, answer: undefined };
    }

    const activeCount = customers.filter((c) => c.status === 'active').length;
    const atRisk = customers.filter((c) => c.status === 'at_risk' || c.riskScore >= 60);
    const names = customers.slice(0, 8).map((c) => c.name).join(', ');

    let answer = `The company serves ${customers.length} customer account(s): ${names}.`;
    const keyFindings: string[] = [
      `Total customers: ${customers.length}`,
      `Active accounts: ${activeCount}`,
    ];
    if (atRisk.length) {
      keyFindings.push(`At-risk accounts: ${atRisk.map((c) => c.name).join(', ')}`);
      answer += ` ${atRisk.length} account(s) are at risk, including ${atRisk.map((c) => c.name).join(', ')}.`;
    }

    return {
      matched: true,
      answer,
      keyFindings,
      sources: [{ id: 'customer-records', title: 'Customer Records', type: 'database', relevanceScore: 0.95 }],
      confidence: 0.9,
    };
  }

  private async resolveProjects(orgId: mongoose.Types.ObjectId, _query: string): Promise<StructuredAnswer> {
    const projects = await Project.find({ organizationId: orgId })
      .select('name code status priority')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    if (!projects.length) {
      return { matched: true, confidence: 0, answer: undefined };
    }

    const names = projects.map((p) => `${p.name} (${p.status})`).join(', ');

    const answer = `The company is working on ${projects.length} project(s): ${names}.`;
    const keyFindings = projects.map((p) => `${p.name}: ${p.status} (${p.priority} priority)`);

    return {
      matched: true,
      answer,
      keyFindings,
      sources: [{ id: 'project-records', title: 'Project Records', type: 'database', relevanceScore: 0.9 }],
      confidence: 0.88,
    };
  }

  private async resolveRisks(orgId: mongoose.Types.ObjectId, _query: string): Promise<StructuredAnswer> {
    const risks = await Risk.find({ organizationId: orgId, status: { $ne: 'resolved' } })
      .select('title level riskScore status')
      .sort({ riskScore: -1 })
      .limit(10)
      .lean();

    if (!risks.length) {
      return { matched: true, confidence: 0, answer: undefined };
    }

    const top = risks[0];
    const answer = `The top active risk is "${top.title}" (${top.level}, risk score ${top.riskScore}). There are ${risks.length} active risk(s) in total.`;
    const keyFindings = risks.map((r) => `${r.title}: ${r.level} (score ${r.riskScore})`);

    return {
      matched: true,
      answer,
      keyFindings,
      sources: [{ id: 'risk-records', title: 'Risk Records', type: 'database', relevanceScore: 0.9 }],
      confidence: 0.88,
    };
  }

  private async findCustomerId(orgId: mongoose.Types.ObjectId, name: string): Promise<mongoose.Types.ObjectId | undefined> {
    // Match partial / abbreviated names: "ABC" -> "ABC Technologies", "Stark" -> "Stark Industries".
    if (!name) return undefined;
    const tokens = name.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    if (tokens.length === 0) return undefined;
    const regexes = tokens.map((t) => new RegExp(t, 'i'));
    const customer = await Customer.findOne({
      organizationId: orgId,
      $and: regexes.map((re) => ({ name: re })),
    })
      .select('_id')
      .lean();
    return customer ? (customer._id as mongoose.Types.ObjectId) : undefined;
  }

  private async resolveTickets(orgId: mongoose.Types.ObjectId, _query: string): Promise<StructuredAnswer> {
    const open = await SupportTicket.find({
      organizationId: orgId,
      status: { $in: ['open', 'in_progress'] },
    })
      .select('title ticketId priority status')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    if (!open.length) {
      return {
        matched: true,
        confidence: 0.6,
        answer: 'There are no open support tickets at the moment.',
        keyFindings: [],
        sources: [{ id: 'support-tickets', title: 'Support Tickets', type: 'database', relevanceScore: 0.8 }],
      };
    }

    const names = open.map((t) => `${t.title || t.ticketId} (${t.status}, ${t.priority} priority)`).join(', ');
    const answer = `There are ${open.length} open support ticket(s): ${names}.`;

    return {
      matched: true,
      answer,
      keyFindings: open.map((t) => `${t.title || t.ticketId}: ${t.status} (${t.priority})`),
      sources: [{ id: 'support-tickets', title: 'Support Tickets', type: 'database', relevanceScore: 0.85 }],
      confidence: 0.85,
    };
  }

  private async resolveOverview(orgId: mongoose.Types.ObjectId, _entity?: string): Promise<StructuredAnswer> {
    const [revenueAgg, employees, customers, projects, risks, tickets] = await Promise.all([
      SalesRecord.aggregate([
        { $match: { organizationId: orgId, stage: 'closed_won' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Employee.countDocuments({ organizationId: orgId, status: 'active' }),
      Customer.countDocuments({ organizationId: orgId }),
      Project.countDocuments({ organizationId: orgId }),
      Risk.countDocuments({ organizationId: orgId, status: { $ne: 'resolved' } }),
      SupportTicket.countDocuments({ organizationId: orgId, status: { $in: ['open', 'in_progress'] } }),
    ]);

    const rev = revenueAgg[0]
      ? { total: (revenueAgg[0] as { total: number }).total, count: (revenueAgg[0] as { count: number }).count }
      : null;

    const parts: string[] = [];
    if (rev) {
      parts.push(`${money(rev.total)} in recorded revenue across ${rev.count} closed deal(s)`);
    } else {
      parts.push('no recorded sales data');
    }
    parts.push(`${employees} active employee(s)`);
    parts.push(`${customers} customer account(s)`);
    parts.push(`${projects} project(s)`);

    let answer = `Here is a high-level overview of the company. It has ${parts.join(', ')}.`;
    if (risks > 0) answer += ` There are ${risks} active risk(s).`;
    if (tickets > 0) answer += ` There are ${tickets} open support ticket(s).`;

    const keyFindings = [
      ...(rev ? [`Total revenue: ${money(rev.total)}`] : []),
      `Employees: ${employees}`,
      `Customers: ${customers}`,
      `Projects: ${projects}`,
      ...(risks > 0 ? [`Active risks: ${risks}`] : []),
      ...(tickets > 0 ? [`Open support tickets: ${tickets}`] : []),
    ];

    return {
      matched: true,
      answer,
      keyFindings,
      sources: [
        { id: 'sales-records', title: 'Sales Records', type: 'database', relevanceScore: 0.85 },
        { id: 'employee-records', title: 'Employee Records', type: 'database', relevanceScore: 0.85 },
        { id: 'customer-records', title: 'Customer Records', type: 'database', relevanceScore: 0.85 },
        { id: 'project-records', title: 'Project Records', type: 'database', relevanceScore: 0.85 },
      ],
      confidence: 0.92,
    };
  }
}

export const structuredQueryService = new StructuredQueryService();

export type { QueryUnderstanding };
