import mongoose from 'mongoose';
import { IUser } from '../models/User';
import { searchService, SearchResult } from './searchService';
import { hasPermission } from '../config/permissions';
import { SupportTicket } from '../models/SupportTicket';
import { Project } from '../models/Project';
import { Risk } from '../models/Risk';
import { Customer } from '../models/Customer';
import { Department } from '../models/Department';
import { SalesRecord } from '../models/SalesRecord';
import { logger } from '../config/logger';

/**
 * AI Data Access — the bridge between the AI Assistant and application data.
 *
 * ARCHITECTURE:
 *   AI Assistant -> aiDataAccessService (this) -> Universal Search (searchService)
 *                                           \-> Authorized Dashboard APIs (models)
 *
 * Universal Search is the PRIMARY discovery mechanism. Dashboard collections are
 * only queried for deeper structured context AFTER search identifies a relevant
 * entity/category. This service NEVER re-implements search logic — it consumes
 * the structured SearchResults produced by searchService.
 *
 * It is fully deterministic and LLM-free: if the AI provider is down, this
 * service still returns grounded context, so the AI's data layer never fails
 * because of the AI itself.
 */
export interface AIContext {
  searchResults: SearchResult[];
  dashboardData: Array<{ category: string; label: string; items: unknown[] }>;
  /** Human-readable, condensed context ready to be injected into an AI prompt. */
  text: string;
}

interface DashboardProvider {
  permission: Parameters<typeof hasPermission>[1];
  label: string;
  fetch: (orgId: mongoose.Types.ObjectId, category: string, limit: number) => Promise<unknown[]>;
}

const DASHBOARD_PROVIDERS: DashboardProvider[] = [
  {
    permission: 'dashboards.risks',
    label: 'Risk Dashboard',
    fetch: (orgId, _category, limit) =>
      Risk.find({ organizationId: orgId })
        .select('_id title description category level riskScore status createdAt')
        .sort({ riskScore: -1 })
        .limit(limit)
        .lean(),
  },
  {
    permission: 'dashboards.bi',
    label: 'Project Dashboard',
    fetch: (orgId, _category, limit) =>
      Project.find({ organizationId: orgId })
        .select('_id name code description status priority createdAt')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
  },
  {
    permission: 'dashboards.analytics',
    label: 'Customer Records',
    fetch: (orgId, _category, limit) =>
      Customer.find({ organizationId: orgId })
        .select('_id name company industry region segment status lifetimeValue riskScore createdAt')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
  },
  {
    permission: 'dashboards.analytics',
    label: 'Support Tickets',
    fetch: (orgId, _category, limit) =>
      SupportTicket.find({ organizationId: orgId })
        .select('_id ticketId title description category priority status channel createdAt')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
  },
  {
    permission: 'dashboards.executive',
    label: 'Department Records',
    fetch: (orgId, _category, limit) =>
      Department.find({ organizationId: orgId, isActive: true })
        .select('_id name code description location headcount createdAt')
        .limit(limit)
        .lean(),
  },
  {
    permission: 'dashboards.analytics',
    label: 'Sales Records',
    fetch: async (orgId, _category, limit) => {
      const sales = await SalesRecord.aggregate([
        { $match: { organizationId: orgId } },
        { $sort: { createdAt: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: 'customers',
            localField: 'customerId',
            foreignField: '_id',
            as: 'customerInfo',
          },
        },
        { $unwind: { path: '$customerInfo', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            productName: 1,
            amount: 1,
            region: 1,
            stage: 1,
            createdAt: 1,
            customerName: '$customerInfo.name',
          },
        },
      ]).allowDiskUse(true);
      return sales;
    },
  },
];

const CATEGORY_TO_PROVIDER: Record<string, string | undefined> = {
  risk: 'Risk Dashboard',
  project: 'Project Dashboard',
  customer: 'Customer Records',
  support_ticket: 'Support Tickets',
  department: 'Department Records',
  sales_record: 'Sales Records',
};

function formatItem(category: string, item: Record<string, unknown>): string {
  switch (category) {
    case 'risk':
      return `- ${item.title} (${item.level}, risk score ${item.riskScore ?? 'n/a'}, status ${item.status})`;
    case 'project':
      return `- ${item.name} (${item.status}, ${item.priority} priority)${item.description ? `: ${item.description}` : ''}`;
    case 'customer':
      return `- ${item.name} (industry: ${item.industry || 'n/a'}, region: ${item.region || 'n/a'}, status: ${item.status})`;
    case 'support_ticket':
      return `- ${item.title} (${item.ticketId}, ${item.status}, ${item.priority})`;
    case 'department':
      return `- ${item.name} (${item.code || 'ORG'}, headcount: ${item.headcount ?? 'n/a'})`;
    case 'sales_record':
      return `- ${item.productName} sold to ${item.customerName || 'n/a'} for ${item.amount ?? 'n/a'} (${item.region || 'n/a'}, ${item.stage || 'n/a'})`;
    default:
      return `- ${JSON.stringify(item).slice(0, 200)}`;
  }
}

export const aiDataAccessService = {
  /**
   * Discover + retrieve authorized dashboard data for the AI.
   *
   * 1. Universal Search discovers matching categories/entities (reused, not
   *    re-implemented).
   * 2. For each discovered category with a dashboard provider, deeper
   *    structured data is fetched (role/perm gated).
   *
   * Returns structured context + a condensed text blob for the prompt.
   * Never calls the LLM. Filtering happens on the backend against the current
   * authenticated user's permissions.
   */
  async buildContext(user: IUser, query: string, limit = 6): Promise<AIContext> {
    const search = await searchService.search(user, query, { limit: 12 });

    const discovered = new Set(search.results.map((r) => r.category));
    const dashboardData: AIContext['dashboardData'] = [];

    const orgId = new mongoose.Types.ObjectId(user.organizationId!.toString());

    // Only fetch each provider once per category set.
    for (const category of discovered) {
      const providerLabel = CATEGORY_TO_PROVIDER[category];
      if (!providerLabel) continue;
      const provider = DASHBOARD_PROVIDERS.find((p) => p.label === providerLabel);
      if (!provider) continue;

      // Backend gate: the current user must hold the required permission.
      if (!hasPermission(user.roles, provider.permission)) continue;

      try {
        const items = await provider.fetch(orgId, category, limit);
        if (items.length > 0) {
          dashboardData.push({ category, label: provider.label, items });
        }
      } catch (err) {
        logger.error(`[AIDataAccess] Dashboard fetch failed for ${provider.label}:`, err);
      }
    }

    // Condensed text context (LLM-free, grounded).
    const lines: string[] = [];

    if (search.results.length > 0) {
      lines.push('=== UNIVERSAL SEARCH RESULTS ===');
      for (const r of search.results) {
        lines.push(`[${r.category.toUpperCase()} | ${r.title}] ${r.snippet}`);
      }
    }

    for (const section of dashboardData) {
      lines.push('');
      lines.push(`=== ${section.label.toUpperCase()} (DASHBOARD DATA) ===`);
      for (const item of section.items as Array<Record<string, unknown>>) {
        lines.push(formatItem(section.category, item));
      }
    }

    return {
      searchResults: search.results,
      dashboardData,
      text: lines.join('\n'),
    };
  },
};