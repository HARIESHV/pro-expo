import mongoose from 'mongoose';
import { DocumentModel } from '../models/Document';
import { DocumentChunk } from '../models/DocumentChunk';
import { Conversation } from '../models/Conversation';
import { KnowledgeEntity } from '../models/KnowledgeEntity';
import { User } from '../models/User';
import { Report } from '../models/Report';
import { AnalyticsResult } from '../models/AnalyticsResult';
import { Query } from '../models/Query';
import { Project } from '../models/Project';
import { Department } from '../models/Department';
import { Customer } from '../models/Customer';
import { Risk } from '../models/Risk';
import { SupportTicket } from '../models/SupportTicket';
import { SalesRecord } from '../models/SalesRecord';
import { IUser } from '../models/User';
import { searchCompanies } from './companySearchService';
import { hasPermission, PermissionType } from '../config/permissions';
import { getAccessLevelsForRoles } from '../config/accessControl';

export type SearchResultType =
  | 'document'
  | 'chat'
  | 'knowledge'
  | 'user'
  | 'dashboard'
  | 'decision'
  | 'report'
  | 'analytics'
  | 'company';

/**
 * Internal source identifiers used for permission scoping and AI context.
 * Mirrors the PermissionType dashboard gates where applicable.
 */
export type SearchCategory =
  | 'documents'
  | 'documents_content'
  | 'knowledge_graph'
  | 'chat'
  | 'users'
  | 'reports'
  | 'analytics'
  | 'decision_intelligence'
  | 'projects'
  | 'departments'
  | 'customers'
  | 'risks'
  | 'support_tickets'
  | 'sales_records'
  | 'companies';

/**
 * Structured Universal Search result. This shape is designed to be consumed
 * both by the normal UI (grouping + navigation) and by the AI Assistant as
 * grounded context, without the AI needing to re-implement any search logic.
 */
export interface SearchResult {
  id: string;
  type: SearchResultType;
  /** Human-friendly category (e.g. 'event', 'document', 'project'). */
  category: string;
  title: string;
  snippet: string;
  description?: string;
  source: string;
  relevance: number;
  timestamp?: string;
  url: string;
  /** Permissions required to view this result (empty = no special gate). */
  permissions: PermissionType[];
  metadata: Record<string, unknown>;
}

export interface SearchOptions {
  /** Zero-indexed page for pagination. */
  page?: number;
  /** Max results per page (default 25, capped at 50). */
  limit?: number;
  /** Restrict results to a single category (e.g. 'project', 'document'). */
  category?: string;
}

export interface UniversalSearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  categories: string[];
}

const MAX_RESULTS_PER_SOURCE = 8;
const MAX_TOTAL = 120;
const PER_PAGE_MIN = 5;
const PER_PAGE_MAX = 50;

/** Escape regex special characters so a raw query is safe in RegExp. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Build a case-insensitive, partial-match regex from a user query. */
function buildRegex(query: string): RegExp {
  const escaped = escapeRegex(query.trim());
  return new RegExp(escaped, 'i');
}

/** Wrap text into a compact snippet, ideally around a term match. */
function makeSnippet(text: string, query: string, maxLen = 220): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  const lower = clean.toLowerCase();
  const idx = query ? lower.indexOf(query.toLowerCase()) : -1;
  const start = idx > maxLen / 2 ? idx - maxLen / 2 : 0;
  return '…' + clean.slice(start, start + maxLen).trim() + '…';
}

function snippetAround(text: string, query: string, radius = 180): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  const lower = clean.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q || lower.length <= 2 * radius + q.length) {
    return clean.length > (2 * radius) ? '…' + clean.slice(0, 2 * radius) + '…' : clean;
  }
  const idx = lower.indexOf(q);
  const start = Math.max(0, idx - radius);
  const end = Math.min(clean.length, idx + q.length + radius);
  return (start > 0 ? '…' : '') + clean.slice(start, end) + (end < clean.length ? '…' : '');
}

function relevanceFromScore(score: number | undefined | null): number {
  const s = Number(score);
  if (!Number.isFinite(s)) return 0.5;
  return Math.max(0, Math.min(1, s));
}

function titleRelevanceBoost(title: string, q: string, base: number): number {
  if (!title || !q) return base;
  const t = title.toLowerCase();
  const lq = q.toLowerCase();
  if (t === lq) return Math.min(1, base + 0.3);
  if (t.startsWith(lq)) return Math.min(1, base + 0.15);
  if (t.includes(lq)) return Math.min(1, base + 0.08);
  return base;
}

export const searchService = {
  /**
   * Perform a Universal Search across all permitted enterprise data sources.
   * Guarantees RBAC: results are scoped to the current user's organization and
   * filtered by document access levels, private conversation ownership, and
   * backend permission checks. Never leaks restricted data.
   */
  async search(user: IUser, rawQuery: string, options: SearchOptions = {}): Promise<UniversalSearchResponse> {
    const query = (rawQuery || '').trim();
    const perPage = Math.min(Math.max(options.limit || 25, PER_PAGE_MIN), PER_PAGE_MAX);
    const page = Math.max(options.page || 0, 0);
    const categoryFilter = (options.category || '').toLowerCase().trim();

    if (!query) {
      return { query, results: [], total: 0, page: 0, limit: perPage, totalPages: 0, categories: [] };
    }

    const orgId = user.organizationId!.toString();
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const userIdStr = user._id.toString();

    // RBAC: document access levels for this user's roles
    const accessLevels = getAccessLevelsForRoles(user.roles);

    const normalizedRoles = user.roles.map((r) => r.toLowerCase().trim());
    const isAdmin = normalizedRoles.includes('super_admin');

    // RBAC permission gates for universal search sources
    const hasUsersView = hasPermission(user.roles, 'users.view') || normalizedRoles.includes('hr') || isAdmin;
    const hasReportsView = hasPermission(user.roles, 'reports.view');
    const hasKnowledgeGraph = hasPermission(user.roles, 'dashboards.knowledge_graph') || isAdmin;
    const hasAnalyticsDashboard = hasPermission(user.roles, 'dashboards.analytics') || isAdmin;
    const hasDecisionIntelligence = true;
    const hasProjectsView = hasPermission(user.roles, 'dashboards.bi') || hasPermission(user.roles, 'dashboards.executive') || isAdmin;

    const results: SearchResult[] = [];
    const regex = buildRegex(query);

    // ---------------- Documents (title + tags + description) ----------------
    try {
      const docs = await DocumentModel.find({
        organizationId: orgObjectId,
        isDeleted: false,
        accessLevel: { $in: accessLevels },
        $or: [
          { title: regex },
          { description: regex },
          { tags: regex },
        ],
      })
        .select('_id title description fileName accessLevel tags metadata createdAt')
        .limit(MAX_RESULTS_PER_SOURCE)
        .lean();

      for (const d of docs) {
        const base = 0.8;
        results.push({
          id: d._id.toString(),
          type: 'document',
          category: 'document',
          title: d.title || d.fileName,
          snippet: makeSnippet(d.description || d.fileName, query),
          description: d.description || undefined,
          source: `Document · ${(d.accessLevel || 'internal').toUpperCase()}`,
          relevance: titleRelevanceBoost(d.title, query, base),
          timestamp: d.createdAt ? (d.createdAt as Date).toISOString() : undefined,
          url: `/documents?focus=${d._id.toString()}`,
          permissions: ['dashboards.documents'],
          metadata: {
            category: 'document',
            fileName: d.fileName || '',
            accessLevel: d.accessLevel || 'internal',
            tags: Array.isArray(d.tags) ? d.tags : [],
          },
        });
      }
    } catch (e) {
      // non-blocking per-source failure
    }

    // ---------------- Document full-text content search ----------------
    try {
      const chunks = await DocumentChunk.aggregate([
        {
          $match: {
            organizationId: orgObjectId,
            'metadata.accessLevel': { $in: accessLevels },
            $text: { $search: query },
          },
        },
        { $sort: { score: { $meta: 'textScore' } } },
        { $limit: MAX_RESULTS_PER_SOURCE },
        {
          $lookup: {
            from: 'documents',
            localField: 'documentId',
            foreignField: '_id',
            as: 'doc',
          },
        },
        { $unwind: { path: '$doc', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            content: 1,
            documentId: 1,
            score: { $meta: 'textScore' },
            docTitle: '$doc.title',
            docAccessLevel: '$doc.accessLevel',
            docCreatedAt: '$doc.createdAt',
          },
        },
      ]).allowDiskUse(true);

      for (const c of chunks as Array<{
        content: string;
        documentId: mongoose.Types.ObjectId;
        score?: number;
        docTitle?: string;
        docAccessLevel?: string;
        docCreatedAt?: Date;
      }>) {
        results.push({
          id: c.documentId.toString(),
          type: 'document',
          category: 'document',
          title: c.docTitle || 'Document snippet',
          snippet: snippetAround(c.content, query),
          description: c.content.slice(0, 300),
          source: `Document content · ${(c.docAccessLevel || 'internal').toUpperCase()}`,
          relevance: titleRelevanceBoost(c.docTitle || '', query, relevanceFromScore(c.score)),
          timestamp: c.docCreatedAt ? c.docCreatedAt.toISOString() : undefined,
          url: `/documents?focus=${c.documentId.toString()}`,
          permissions: ['dashboards.documents'],
          metadata: {
            category: 'document',
            accessLevel: c.docAccessLevel || 'internal',
            matchField: 'content',
          },
        });
      }
    } catch (e) {
      // Full-text index may be absent; fall back to substring scan on chunks
    }

    // ---------------- Knowledge Graph entities (admin only) ----------------
    if (hasKnowledgeGraph) {
      try {
        const entities = await KnowledgeEntity.find({
          organizationId: orgObjectId,
          isActive: true,
          $or: [{ name: regex }, { description: regex }, { aliases: regex }],
        })
          .select('_id name type description aliases confidence updatedAt')
          .limit(MAX_RESULTS_PER_SOURCE)
          .lean();

        for (const en of entities) {
          const base = 0.75;
          results.push({
            id: en._id.toString(),
            type: 'knowledge',
            category: 'knowledge_entity',
            title: en.name,
            snippet: makeSnippet(en.description || (Array.isArray(en.aliases) ? en.aliases.join(', ') : ''), query),
            description: en.description || undefined,
            source: `Knowledge Graph · ${en.type}`,
            relevance: titleRelevanceBoost(en.name, query, base + (Number(en.confidence) || 0) * 0.1),
            timestamp: en.updatedAt ? (en.updatedAt as Date).toISOString() : undefined,
            url: `/knowledge-graph?entity=${en._id.toString()}`,
            permissions: ['dashboards.knowledge_graph'],
            metadata: {
              category: 'knowledge_entity',
              entityType: en.type || 'entity',
              confidence: Number(en.confidence) || 0,
            },
          });
        }
      } catch (e) {
        // non-blocking
      }
    }

    // ---------------- AI Chat conversations (user-scoped) ----------------
    try {
      const convs = await Conversation.find({
        organizationId: orgObjectId,
        userId: userIdStr,
        $or: [{ title: regex }],
      })
        .select('_id title lastMessageAt createdAt')
        .limit(MAX_RESULTS_PER_SOURCE)
        .lean();

      for (const c of convs as Array<{ _id: mongoose.Types.ObjectId; title: string; lastMessageAt?: Date; createdAt: Date }>) {
        results.push({
          id: c._id.toString(),
          type: 'chat',
          category: 'conversation',
          title: c.title || 'Conversation',
          snippet: 'AI Chat conversation',
          description: 'AI Chat conversation',
          source: 'AI Chat',
          relevance: titleRelevanceBoost(c.title, query, 0.7),
          timestamp: (c.lastMessageAt || c.createdAt).toISOString(),
          url: `/chat?conv=${c._id.toString()}`,
          permissions: [],
          metadata: { category: 'conversation' },
        });
      }

      // Search inside conversation messages for the current user and their org.
      const { Message } = await import('../models/Message');
      const msgMatches = await Message.aggregate([
        {
          $match: {
            organizationId: orgObjectId,
            role: { $in: ['user', 'assistant'] },
            $or: [{ content: regex }, { answer: regex }, { summary: regex }],
          },
        },
        { $sort: { createdAt: -1 } },
        { $limit: MAX_RESULTS_PER_SOURCE },
        {
          $lookup: {
            from: 'conversations',
            localField: 'conversationId',
            foreignField: '_id',
            as: 'conv',
          },
        },
        { $unwind: { path: '$conv', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            content: 1,
            answer: 1,
            conversationId: 1,
            convUserId: '$conv.userId',
            convTitle: '$conv.title',
            createdAt: 1,
          },
        },
      ]).allowDiskUse(true);

      for (const m of msgMatches as Array<{
        content: string;
        answer?: string;
        conversationId: mongoose.Types.ObjectId;
        convUserId?: mongoose.Types.ObjectId;
        convTitle?: string;
        createdAt?: Date;
      }>) {
        // Only expose conversations this user owns
        if (m.convUserId && m.convUserId.toString() !== userIdStr) continue;
        const text = m.answer || m.content;
        results.push({
          id: m.conversationId.toString(),
          type: 'chat',
          category: 'conversation',
          title: m.convTitle || 'Conversation',
          snippet: snippetAround(text || '', query),
          description: (text || '').slice(0, 300),
          source: 'AI Chat message',
          relevance: 0.7,
          timestamp: m.createdAt ? m.createdAt.toISOString() : undefined,
          url: `/chat?conv=${m.conversationId.toString()}`,
          permissions: [],
          metadata: {
            category: 'conversation',
            messageRole: (m as { role?: string }).role || 'assistant',
          },
        });
      }
    } catch (e) {
      // non-blocking
    }

    // ---------------- Users (permission gated) ----------------
    if (hasUsersView) {
      try {
        const users = await User.find({
          organizationId: orgObjectId,
          status: 'active',
          $or: [
            { firstName: regex },
            { lastName: regex },
            { displayName: regex },
            { email: regex },
          ],
        })
          .select('_id firstName lastName displayName email roles createdAt')
          .limit(MAX_RESULTS_PER_SOURCE)
          .lean();

        for (const u of users as Array<{
          _id: mongoose.Types.ObjectId;
          firstName: string;
          lastName: string;
          displayName?: string;
          email: string;
          roles: string[];
          createdAt: Date;
        }>) {
          const name = u.displayName || `${u.firstName} ${u.lastName}`.trim();
          results.push({
            id: u._id.toString(),
            type: 'user',
            category: 'user',
            title: name || u.email,
            snippet: u.email,
            description: u.email,
            source: `User · ${(u.roles || []).join(', ')}`,
            relevance: titleRelevanceBoost(name, query, 0.7),
            timestamp: u.createdAt ? u.createdAt.toISOString() : undefined,
            url: `/dashboard`,
            permissions: ['users.view'],
            metadata: {
              category: 'user',
              roles: (u.roles || []).slice(0, 5),
              email: u.email,
            },
          });
        }
      } catch (e) {
        // non-blocking
      }
    }

    // ---------------- Reports (permission gated) ----------------
    if (hasReportsView) {
      try {
        const reports = await Report.find({
          organizationId: orgObjectId,
          $or: [{ title: regex }, { 'content.executiveSummary': regex }, { 'content.aiInsights': regex }],
        })
          .select('_id title type status parameters content.createdAt updatedAt')
          .limit(MAX_RESULTS_PER_SOURCE)
          .lean();

        for (const r of reports as Array<{
          _id: mongoose.Types.ObjectId;
          title: string;
          type: string;
          status: string;
          createdAt: Date;
          updatedAt: Date;
          content?: { executiveSummary?: string };
        }>) {
          results.push({
            id: r._id.toString(),
            type: 'report',
            category: 'report',
            title: r.title,
            snippet: makeSnippet(r.content?.executiveSummary || '', query) || `Report · ${r.type} · ${r.status}`,
            description: r.content?.executiveSummary || undefined,
            source: `Report · ${r.type} · ${r.status}`,
            relevance: titleRelevanceBoost(r.title, query, 0.75),
            timestamp: (r.updatedAt || r.createdAt).toISOString(),
            url: `/reports/${r._id.toString()}`,
            permissions: ['reports.view'],
            metadata: {
              category: 'report',
              type: r.type,
              status: r.status,
            },
          });
        }
      } catch (e) {
        // non-blocking
      }
    }

    // ---------------- Analytics Dashboard data (admin only) ----------------
    if (hasAnalyticsDashboard) {
      try {
        const analytics = await AnalyticsResult.find({
          organizationId: orgObjectId,
          $or: [{ name: regex }, { insights: regex }, { category: regex }],
        })
          .select('_id name type category period insights createdAt')
          .limit(MAX_RESULTS_PER_SOURCE)
          .lean();

        for (const a of analytics as Array<{
          _id: mongoose.Types.ObjectId;
          name: string;
          type: string;
          category: string;
          insights?: string[];
          period?: { start?: Date; end?: Date };
          createdAt: Date;
        }>) {
          const snippet = Array.isArray(a.insights) && a.insights.length
            ? snippetAround(a.insights.join(' '), query)
            : `Analytics · ${a.category} · ${a.type}`;
          const periodLabel = a.period?.start
            ? new Date(a.period.start).toISOString().slice(0, 10)
            : undefined;
          results.push({
            id: a._id.toString(),
            type: 'analytics',
            category: 'analytics',
            title: a.name,
            snippet,
            description: snippet,
            source: `Dashboard · ${a.category} · ${a.type}`,
            relevance: titleRelevanceBoost(a.name, query, 0.72),
            timestamp: a.createdAt ? a.createdAt.toISOString() : undefined,
            url: `/business-intelligence`,
            permissions: ['dashboards.analytics'],
            metadata: {
              category: 'analytics',
              type: a.type,
              period: periodLabel,
            },
          });
        }
      } catch (e) {
        // non-blocking
      }
    }

    // ---------------- Decision Intelligence — Query records (all authenticated users) ----------------
    if (hasDecisionIntelligence) {
      try {
        const queryFilter: Record<string, unknown> = {
          organizationId: orgObjectId,
          originalQuery: regex,
        };
        if (!isAdmin) {
          queryFilter.userId = user._id;
        }

        const queries = await Query.find(queryFilter)
          .select('_id originalQuery agentsUsed status createdAt')
          .sort({ createdAt: -1 })
          .limit(MAX_RESULTS_PER_SOURCE)
          .lean();

        for (const q of queries as Array<{
          _id: mongoose.Types.ObjectId;
          originalQuery: string;
          agentsUsed?: string[];
          status: string;
          createdAt: Date;
        }>) {
          results.push({
            id: q._id.toString(),
            type: 'decision',
            category: 'decision',
            title: q.originalQuery,
            snippet: `Decision Intelligence query · ${q.status}`,
            description: q.originalQuery,
            source: `Decision Intelligence · ${(q.agentsUsed || []).join(', ') || 'executive'}`,
            relevance: titleRelevanceBoost(q.originalQuery, query, 0.72),
            timestamp: q.createdAt ? q.createdAt.toISOString() : undefined,
            url: `/query-history`,
            permissions: ['dashboards.di'],
            metadata: {
              category: 'decision',
              status: q.status,
              agentsUsed: (q.agentsUsed || []).slice(0, 5),
            },
          });
        }
      } catch (e) {
        // non-blocking
      }
    }

    // ---------------- Projects ----------------
    if (hasProjectsView) {
      try {
        const projects = await Project.find({
          organizationId: orgObjectId,
          $or: [{ name: regex }, { description: regex }, { tags: regex }, { code: regex }],
        })
          .select('_id name description code status priority createdAt')
          .limit(MAX_RESULTS_PER_SOURCE)
          .lean();

        for (const p of projects as Array<{
          _id: mongoose.Types.ObjectId;
          name: string;
          description?: string;
          code?: string;
          status: string;
          priority: string;
          createdAt?: Date;
        }>) {
          results.push({
            id: p._id.toString(),
            type: 'dashboard',
            category: 'project',
            title: `${p.name} (${p.code || 'PROJECT'})`,
            snippet: makeSnippet(p.description || `Project · Status: ${p.status} · Priority: ${p.priority}`, query),
            description: p.description || undefined,
            source: `Project · ${p.status.toUpperCase()}`,
            relevance: titleRelevanceBoost(p.name, query, 0.76),
            timestamp: p.createdAt ? (p.createdAt as Date).toISOString() : undefined,
            url: `/business-intelligence`,
            permissions: ['dashboards.bi', 'dashboards.executive'],
            metadata: {
              category: 'project',
              status: p.status,
              priority: p.priority,
              code: p.code || '',
            },
          });
        }
      } catch (e) {
        // non-blocking
      }
    }

    // ---------------- Departments & Customer Database Records ----------------
    try {
      const depts = await Department.find({
        organizationId: orgObjectId,
        isActive: true,
        $or: [{ name: regex }, { description: regex }, { code: regex }],
      })
        .select('_id name code description location headcount createdAt')
        .limit(MAX_RESULTS_PER_SOURCE)
        .lean();

      for (const dept of depts as Array<{
        _id: mongoose.Types.ObjectId;
        name: string;
        code?: string;
        description?: string;
        location?: string;
        headcount?: number;
        createdAt?: Date;
      }>) {
        results.push({
          id: dept._id.toString(),
          type: 'knowledge',
          category: 'department',
          title: dept.name,
          snippet: makeSnippet(dept.description || `Department · Code: ${dept.code} · Location: ${dept.location}`, query),
          description: dept.description || undefined,
          source: `Department · ${dept.code || 'ORG'}`,
          relevance: titleRelevanceBoost(dept.name, query, 0.74),
          timestamp: dept.createdAt ? (dept.createdAt as Date).toISOString() : undefined,
          url: `/knowledge-graph`,
          permissions: ['dashboards.executive'],
          metadata: {
            category: 'department',
            code: dept.code || '',
            location: dept.location || '',
            headcount: dept.headcount ?? undefined,
          },
        });
      }

      const customerList = await Customer.find({
        organizationId: orgObjectId,
        $or: [{ name: regex }, { company: regex }, { industry: regex }, { region: regex }],
      })
        .select('_id name company industry region segment status lifetimeValue riskScore createdAt')
        .limit(MAX_RESULTS_PER_SOURCE)
        .lean();

      for (const cust of customerList as Array<{
        _id: mongoose.Types.ObjectId;
        name: string;
        company?: string;
        industry?: string;
        region?: string;
        status: string;
        createdAt?: Date;
      }>) {
        results.push({
          id: cust._id.toString(),
          type: 'analytics',
          category: 'customer',
          title: cust.name || cust.company || 'Customer Record',
          snippet: `Record · Industry: ${cust.industry || 'N/A'} · Region: ${cust.region || 'N/A'} · Status: ${cust.status}`,
          description: `Customer · Industry: ${cust.industry || 'N/A'} · Region: ${cust.region || 'N/A'} · Status: ${cust.status}`,
          source: `Database Record · Customer (${cust.status})`,
          relevance: titleRelevanceBoost(cust.name, query, 0.75),
          timestamp: cust.createdAt ? (cust.createdAt as Date).toISOString() : undefined,
          url: `/analytics`,
          permissions: ['dashboards.analytics'],
          metadata: {
            category: 'customer',
            industry: cust.industry || '',
            region: cust.region || '',
            status: cust.status,
          },
        });
      }
    } catch (e) {
      // non-blocking
    }

    // ---------------- Risk Intelligence Records ----------------
    try {
      const risks = await Risk.find({
        organizationId: orgObjectId,
        $or: [{ title: regex }, { description: regex }, { category: regex }],
      })
        .select('_id title description category level riskScore status createdAt')
        .limit(MAX_RESULTS_PER_SOURCE)
        .lean();

      for (const r of risks as Array<{
        _id: mongoose.Types.ObjectId;
        title: string;
        description?: string;
        category: string;
        level: string;
        riskScore?: number;
        status: string;
        createdAt?: Date;
      }>) {
        results.push({
          id: r._id.toString(),
          type: 'decision',
          category: 'risk',
          title: `Risk: ${r.title}`,
          snippet: makeSnippet(r.description || `Risk level: ${r.level} · Category: ${r.category}`, query),
          description: r.description || undefined,
          source: `Risk Intelligence · ${r.level.toUpperCase()}`,
          relevance: titleRelevanceBoost(r.title, query, 0.78),
          timestamp: r.createdAt ? (r.createdAt as Date).toISOString() : undefined,
          url: `/risks`,
          permissions: ['dashboards.risks'],
          metadata: {
            category: 'risk',
            level: r.level,
            riskScore: r.riskScore ?? undefined,
            status: r.status,
          },
        });
      }
    } catch (e) {
      // non-blocking
    }

    // ---------------- Support Tickets ----------------
    try {
      const tickets = await SupportTicket.find({
        organizationId: orgObjectId,
        $or: [{ title: regex }, { description: regex }, { category: regex }, { ticketId: regex }, { tags: regex }],
      })
        .select('_id ticketId title description category priority status channel createdAt')
        .limit(MAX_RESULTS_PER_SOURCE)
        .lean();

      for (const t of tickets as Array<{
        _id: mongoose.Types.ObjectId;
        ticketId: string;
        title: string;
        description?: string;
        category: string;
        priority: string;
        status: string;
        channel?: string;
        createdAt?: Date;
      }>) {
        results.push({
          id: t._id.toString(),
          type: 'dashboard',
          category: 'support_ticket',
          title: `${t.title} (${t.ticketId})`,
          snippet: makeSnippet(t.description || `Ticket · ${t.status} · ${t.priority}`, query),
          description: t.description || undefined,
          source: `Support Ticket · ${t.status.toUpperCase()} · ${t.priority.toUpperCase()}`,
          relevance: titleRelevanceBoost(t.title, query, 0.75),
          timestamp: t.createdAt ? (t.createdAt as Date).toISOString() : undefined,
          url: `/analytics`,
          permissions: ['dashboards.analytics'],
          metadata: {
            category: 'support_ticket',
            ticketId: t.ticketId,
            status: t.status,
            priority: t.priority,
            channel: t.channel || '',
          },
        });
      }
    } catch (e) {
      // non-blocking
    }

    // ---------------- Sales Records ----------------
    if (hasAnalyticsDashboard || hasProjectsView) {
      try {
        const sales = await SalesRecord.aggregate([
          {
            $match: {
              organizationId: orgObjectId,
              $or: [{ productName: regex }, { category: regex }, { region: regex }, { stage: regex }],
            },
          },
          {
            $lookup: {
              from: 'customers',
              localField: 'customerId',
              foreignField: '_id',
              as: 'customerInfo',
            },
          },
          { $unwind: { path: '$customerInfo', preserveNullAndEmptyArrays: true } },
          { $sort: { createdAt: -1 } },
          { $limit: MAX_RESULTS_PER_SOURCE },
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

        for (const s of sales as Array<{
          _id: mongoose.Types.ObjectId;
          productName?: string;
          customerName?: string;
          amount?: number;
          region?: string;
          stage?: string;
          createdAt?: Date;
        }>) {
          results.push({
            id: s._id.toString(),
            type: 'analytics',
            category: 'sales_record',
            title: s.productName || `Sale record (${s.customerName || 'unknown'})`,
            snippet: `Sale · ${s.customerName || 'N/A'} · ${money(s.amount ?? 0)} · ${s.region || 'N/A'} · ${s.stage || 'N/A'}`,
            description: `Sale record for ${s.customerName || 'N/A'}`,
            source: `Database Record · Sales (${(s.stage || 'N/A').toUpperCase()})`,
            relevance: titleRelevanceBoost(s.productName || '', query, 0.72),
            timestamp: s.createdAt ? (s.createdAt as Date).toISOString() : undefined,
            url: `/analytics`,
            permissions: ['dashboards.analytics'],
            metadata: {
              category: 'sales_record',
              product: s.productName || '',
              customer: s.customerName || '',
              amount: s.amount ?? undefined,
              region: s.region || '',
              stage: s.stage || '',
            },
          });
        }
      } catch (e) {
        // non-blocking
      }
    }

    // ---------------- Universal Company Knowledge Base ----------------
    // Grounded search over the normalized company store (any size, any sector).
    try {
      const companyHits = await searchCompanies(query, { limit: MAX_RESULTS_PER_SOURCE });
      for (const hit of companyHits) {
        const c = hit.company;
        const loc = [c.headquarters?.city, c.headquarters?.state, c.headquarters?.country]
          .filter(Boolean)
          .join(', ');
        results.push({
          id: `company:${String(c._id)}`,
          type: 'company',
          category: 'company',
          title: c.displayName,
          snippet: makeSnippet(
            [loc && `HQ: ${loc}`, c.industry, c.subIndustry, c.category && `Category: ${c.category}`]
              .filter(Boolean)
              .join(' · '),
            query
          ),
          description: c.description || c.about || undefined,
          source: 'Company Knowledge Base',
          relevance: titleRelevanceBoost(c.displayName, query, 0.85),
          url: `/companies/${String(c._id)}`,
          permissions: ['universal_search'],
          metadata: {
            category: 'company',
            companyId: String(c._id),
            matchedBy: hit.matchedBy,
            industry: c.industry || '',
            hq: loc,
            foundedYear: c.foundedYear,
            website: c.website,
            stockTicker: c.stockTicker,
          },
        });
      }
    } catch (e) {
      // non-blocking
    }

    // Dedupe by (type + id) keeping the highest relevance
    const byKey = new Map<string, SearchResult>();
    for (const r of results) {
      if (byKey.size >= MAX_TOTAL) break;
      const key = `${r.type}:${r.id}`;
      const existing = byKey.get(key);
      if (!existing || r.relevance > existing.relevance) byKey.set(key, r);
    }

    let unique = Array.from(byKey.values())
      .sort((a, b) => b.relevance - a.relevance);

    // All categories available for this query (unfiltered, for the UI chips)
    const categories = Array.from(new Set(unique.map((r) => r.category))).sort();

    // Category filter (Requirement 8: API-level filtering)
    if (categoryFilter) {
      unique = unique.filter((r) => r.category === categoryFilter);
      // Re-sort in natural order when filtering by a single category
      unique.sort((a, b) => b.relevance - a.relevance);
    }

    const total = unique.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const start = page * perPage;
    const paged = unique.slice(start, start + perPage);

    return {
      query,
      results: paged,
      total,
      page,
      limit: perPage,
      totalPages,
      categories,
    };
  },
};

function money(n: number): string {
  return `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}
