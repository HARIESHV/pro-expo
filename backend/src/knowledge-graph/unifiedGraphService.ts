import mongoose from 'mongoose';
import { KnowledgeEntity } from '../models/KnowledgeEntity';
import { KnowledgeRelationship } from '../models/KnowledgeRelationship';
import { DocumentModel } from '../models/Document';
import { Customer } from '../models/Customer';
import { Employee } from '../models/Employee';
import { Project } from '../models/Project';
import { Department } from '../models/Department';
import { Organization } from '../models/Organization';
import { Risk } from '../models/Risk';
import { Conversation } from '../models/Conversation';
import { Query } from '../models/Query';
import { EntityType, RelationshipType, AccessLevel, GraphSource } from '../types';

// ──────────────────────────────────────────────────────────────────────────
// Unified, real-data Knowledge Graph builder.
//
// Reads the enterprise records that ALREADY exist in the application
// (documents, customers, employees, projects, departments, risks, chats and
// universal-search / decision-intelligence queries) and merges them with the
// persisted KnowledgeEntity / KnowledgeRelationship graph into ONE deduplicated
// graph. Nothing is invented: every node/edge maps back to a real record.
// IDs are stable + deterministic so the same record never duplicates.
// ──────────────────────────────────────────────────────────────────────────

export interface UnifiedGraphNode {
  id: string;
  name: string;
  type: string;
  source: GraphSource;
  confidence: number;
  properties: Record<string, unknown>;
  timestamp?: string;
}

export interface UnifiedGraphEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  type: string;
  weight: number;
  confidence: number;
  source: GraphSource;
  timestamp?: string;
}

export interface UnifiedGraphData {
  nodes: UnifiedGraphNode[];
  edges: UnifiedGraphEdge[];
  totalNodes: number;
  totalEdges: number;
}

export interface UnifiedGraphFilters {
  entityTypes?: string[];
  sources?: GraphSource[];
  minConfidence?: number;
  limit?: number;
  userId: string;
  roles?: string[];
}

const ROLE_ACCESS_LEVELS: Record<string, AccessLevel[]> = {
  super_admin: ['public', 'internal', 'confidential', 'restricted', 'top_secret'],
  ceo: ['public', 'internal', 'confidential', 'restricted'],
  manager: ['public', 'internal', 'confidential'],
  analyst: ['public', 'internal', 'confidential'],
  employee: ['public', 'internal'],
  hr: ['public', 'internal'],
  finance: ['public', 'internal', 'confidential'],
  sales: ['public', 'internal'],
};

function normalizeName(name: string): string {
  return (name || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

export function canonicalType(type: string): string {
  return String(type || 'concept')
    .toLowerCase()
    .replace(/\s+/g, '_');
}

// Deterministic id for virtual (non-persisted) nodes so re-loads never duplicate.
function virtualId(prefix: string, key: string): string {
  let h = 2166136261;
  const s = `${prefix}:${key}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `virt:${prefix}:${(h >>> 0).toString(36)}`;
}

export interface GraphBuilder {
  nodes: Map<string, UnifiedGraphNode>;
  edges: Map<string, UnifiedGraphEdge>;
  entityKeyById: Map<string, string>;
  getOrAddNode(opts: {
    type: EntityType | string;
    name: string;
    source: GraphSource;
    confidence?: number;
    properties?: Record<string, unknown>;
    timestamp?: string | Date;
    preferId?: string;
  }): string;
  registerEntityId(dbId: string, nodeId: string): void;
  addEdge(opts: {
    from: string;
    to: string;
    type: RelationshipType | string;
    label?: string;
    weight?: number;
    confidence?: number;
    source: GraphSource;
    timestamp?: string | Date;
  }): void;
}

export class GraphBuilderImpl implements GraphBuilder {
  nodes = new Map<string, UnifiedGraphNode>();
  edges = new Map<string, UnifiedGraphEdge>();
  entityKeyById = new Map<string, string>();
  private nameIndex = new Map<string, string>();

  registerEntityId(dbId: string, nodeId: string): void {
    this.entityKeyById.set(dbId, nodeId);
  }

  getOrAddNode({
    type,
    name,
    source,
    confidence = 0.95,
    properties = {},
    timestamp,
    preferId,
  }: {
    type: EntityType | string;
    name: string;
    source: GraphSource;
    confidence?: number;
    properties?: Record<string, unknown>;
    timestamp?: string | Date;
    preferId?: string;
  }): string {
    const canonType = canonicalType(type);
    const key = `${canonType}:${normalizeName(name)}`;
    if (this.nameIndex.has(key)) {
      const id = this.nameIndex.get(key)!;
      const existing = this.nodes.get(id);
      if (existing) {
        if (existing.confidence < confidence) existing.confidence = confidence;
        if (!existing.timestamp && timestamp) existing.timestamp = new Date(timestamp).toISOString();
        existing.properties = { ...existing.properties, ...properties };
      }
      return id;
    }

    const ts = timestamp ? new Date(timestamp).toISOString() : undefined;
    const id = preferId || virtualId(canonType, normalizeName(name));

    const node: UnifiedGraphNode = {
      id,
      name,
      type: canonType,
      source,
      confidence: Math.min(1, Math.max(0, confidence)),
      properties: properties || {},
      timestamp: ts,
    };
    this.nodes.set(id, node);
    this.nameIndex.set(key, id);
    return id;
  }

  addEdge({
    from,
    to,
    type,
    label,
    weight = 1,
    confidence = 0.9,
    source,
    timestamp,
  }: {
    from: string;
    to: string;
    type: RelationshipType | string;
    label?: string;
    weight?: number;
    confidence?: number;
    source: GraphSource;
    timestamp?: string | Date;
  }): void {
    if (!this.nodes.has(from) || !this.nodes.has(to)) return;
    const ekey = `${from}|${to}|${canonicalType(type)}`;
    const existing = this.edges.get(ekey);
    const ts = timestamp ? new Date(timestamp).toISOString() : undefined;
    const lbl = label || canonicalType(type).replace(/_/g, ' ');
    if (existing) {
      existing.confidence = Math.min(1, Math.max(existing.confidence, confidence));
      existing.weight = Math.min(10, existing.weight + weight);
      if (!existing.timestamp && ts) existing.timestamp = ts;
      return;
    }
    this.edges.set(ekey, {
      id: virtualId('edge', `${from}|${to}|${canonicalType(type)}`),
      from,
      to,
      label: lbl,
      type: canonicalType(type),
      weight: Math.max(0.1, weight),
      confidence: Math.min(1, Math.max(0, confidence)),
      source,
      timestamp: ts,
    });
  }
}

interface AggregationContext {
  orgId: mongoose.Types.ObjectId;
  user: { id: string; roles: string[] };
  accessLevels: AccessLevel[];
  builder: GraphBuilderImpl;
}

async function addStoredGraph(ctx: AggregationContext): Promise<void> {
  const { orgId, builder } = ctx;
  const entities = await KnowledgeEntity.find({ organizationId: orgId, isActive: true }).lean();
  for (const e of entities) {
    const source: GraphSource = e.sourceDocumentIds?.length ? 'document' : 'knowledge';
    const id = builder.getOrAddNode({
      type: e.type,
      name: e.name,
      source,
      confidence: e.confidence || 0.8,
      properties: {
        description: e.description,
        aliases: e.aliases,
        ...(e.properties || {}),
      },
      timestamp: e.createdAt,
      preferId: e._id.toString(),
    });
    builder.registerEntityId(e._id.toString(), id);
  }

  const rels = await KnowledgeRelationship.find({ organizationId: orgId, isActive: true }).lean();
  for (const r of rels) {
    const fromId = builder.entityKeyById.get(r.fromEntityId.toString());
    const toId = builder.entityKeyById.get(r.toEntityId.toString());
    if (!fromId || !toId) continue;
    builder.addEdge({
      from: fromId,
      to: toId,
      type: r.relationshipType,
      label: r.label,
      weight: r.weight || 1,
      confidence: r.confidence ?? 0.8,
      source: r.sourceDocumentIds?.length ? 'document' : 'knowledge',
      timestamp: r.createdAt,
    });
  }
}

async function addDocuments(ctx: AggregationContext): Promise<void> {
  const { orgId, accessLevels, builder } = ctx;
  const docs = await DocumentModel.find({
    organizationId: orgId,
    accessLevel: { $in: accessLevels },
    processingStatus: { $nin: ['failed'] },
  })
    .sort({ createdAt: -1 })
    .lean();

  for (const d of docs) {
    const docId = builder.getOrAddNode({
      type: 'document',
      name: d.title,
      source: 'document',
      confidence: 0.98,
      properties: {
        fileName: d.fileName,
        fileSize: d.fileSize,
        mimeType: d.mimeType,
        tags: d.tags,
        accessLevel: d.accessLevel,
        chunksCount: d.chunksCount,
      },
      timestamp: d.createdAt,
      preferId: `doc:${d._id.toString()}`,
    });
    void docId;
  }

  // Connect persisted entities back to the document nodes they were extracted from
  const docNodes = new Map<string, string>();
  for (const [id, node] of builder.nodes.entries()) {
    if (node.type === 'document') docNodes.set(id.replace('doc:', ''), id);
  }
  const entities = await KnowledgeEntity.find({ organizationId: orgId, isActive: true }).lean();
  for (const e of entities) {
    const nodeId = builder.entityKeyById.get(e._id.toString());
    if (!nodeId) continue;
    for (const docRef of e.sourceDocumentIds || []) {
      const docId = docNodes.get(docRef.toString());
      if (!docId || docId === nodeId) continue;
      builder.addEdge({
        from: docId,
        to: nodeId,
        type: 'references',
        label: 'references',
        weight: 1,
        confidence: 0.95,
        source: 'document',
        timestamp: e.createdAt,
      });
    }
  }
}

async function addEnterpriseRecords(ctx: AggregationContext): Promise<void> {
  const { orgId, builder } = ctx;

  const org = await Organization.findById(orgId).lean();
  let orgIdNode = '';
  if (org) {
    orgIdNode = builder.getOrAddNode({
      type: 'organization',
      name: org.name,
      source: 'database',
      confidence: 1,
      properties: { industry: org.industry, size: org.size, website: org.website },
      timestamp: org.createdAt,
      preferId: `org:${org._id.toString()}`,
    });
  }

  const [departments, employees, projects, customers, risks] = await Promise.all([
    Department.find({ organizationId: orgId, isActive: true }).lean(),
    Employee.find({ organizationId: orgId }).lean(),
    Project.find({ organizationId: orgId }).lean(),
    Customer.find({ organizationId: orgId }).lean(),
    Risk.find({ organizationId: orgId }).lean(),
  ]);

  // Departments
  const deptIdByDb = new Map<string, string>();
  for (const d of departments) {
    const id = builder.getOrAddNode({
      type: 'department',
      name: d.name,
      source: 'database',
      confidence: 1,
      properties: { headcount: d.headcount, location: d.location, budget: d.budget },
      timestamp: d.createdAt,
      preferId: `dept:${d._id.toString()}`,
    });
    deptIdByDb.set(d._id.toString(), id);
    if (orgIdNode) builder.addEdge({ from: id, to: orgIdNode, type: 'part_of', label: 'part of', confidence: 1, source: 'database', timestamp: d.createdAt });
  }
  for (const d of departments) {
    if (d.parentDepartmentId) {
      const child = deptIdByDb.get(d._id.toString());
      const parent = deptIdByDb.get(d.parentDepartmentId.toString());
      if (child && parent) builder.addEdge({ from: child, to: parent, type: 'part_of', label: 'part of', confidence: 1, source: 'database' });
    }
  }

  // Employees
  const employeeIdByDb = new Map<string, string>();
  for (const emp of employees) {
    if (emp.status === 'terminated') continue;
    const id = builder.getOrAddNode({
      type: 'employee',
      name: `${emp.firstName} ${emp.lastName}`.trim(),
      source: 'database',
      confidence: 1,
      properties: {
        jobTitle: emp.jobTitle,
        email: emp.email,
        skills: emp.skills,
        location: emp.location,
        performanceScore: emp.performanceScore,
      },
      timestamp: emp.hireDate,
      preferId: `emp:${emp._id.toString()}`,
    });
    employeeIdByDb.set(emp._id.toString(), id);
    const deptId = deptIdByDb.get(emp.departmentId.toString());
    if (deptId) builder.addEdge({ from: id, to: deptId, type: 'works_for', label: 'works for', confidence: 1, source: 'database' });
    if (orgIdNode) builder.addEdge({ from: id, to: orgIdNode, type: 'belongs_to', label: 'belongs to', confidence: 1, source: 'database' });
  }
  for (const emp of employees) {
    if (emp.status === 'terminated' || !emp.managerId) continue;
    const eid = employeeIdByDb.get(emp._id.toString());
    const mid = employeeIdByDb.get(emp.managerId.toString());
    if (eid && mid && eid !== mid) builder.addEdge({ from: eid, to: mid, type: 'reports_to', label: 'reports to', confidence: 1, source: 'database' });
  }

  // Projects
  for (const p of projects) {
    const id = builder.getOrAddNode({
      type: 'project',
      name: p.name,
      source: 'database',
      confidence: 1,
      properties: {
        status: p.status,
        priority: p.priority,
        completionPercentage: p.completionPercentage,
        budget: p.budget,
        actualCost: p.actualCost,
        tags: p.tags,
      },
      timestamp: p.createdAt,
      preferId: `proj:${p._id.toString()}`,
    });
    const deptId = deptIdByDb.get(p.departmentId.toString());
    if (deptId) builder.addEdge({ from: id, to: deptId, type: 'part_of', label: 'part of', confidence: 1, source: 'database' });
    if (orgIdNode) builder.addEdge({ from: id, to: orgIdNode, type: 'involves', label: 'involves', confidence: 0.9, source: 'database' });
  }

  // Regions (derived from real customer + department location values)
  const regionNames = new Set<string>();
  customers.forEach((c) => regionNames.add(c.region));
  departments.forEach((d) => { if (d.location) regionNames.add(d.location); });

  // Customers
  for (const c of customers) {
    const id = builder.getOrAddNode({
      type: 'customer',
      name: c.name,
      source: 'database',
      confidence: 1,
      properties: {
        segment: c.segment,
        status: c.status,
        industry: c.industry,
        lifetimeValue: c.lifetimeValue,
        riskScore: c.riskScore,
        satisfactionScore: c.satisfactionScore,
      },
      timestamp: c.acquisitionDate,
      preferId: `cust:${c._id.toString()}`,
    });
    if (c.region && regionNames.has(c.region)) {
      const regionId = builder.getOrAddNode({
        type: 'region',
        name: c.region,
        source: 'database',
        confidence: 0.9,
        properties: { customerCount: [...customers].filter((x) => x.region === c.region).length },
      });
      builder.addEdge({ from: id, to: regionId, type: 'located_in', label: 'located in', confidence: 1, source: 'database' });
    }
    if (orgIdNode) builder.addEdge({ from: id, to: orgIdNode, type: 'belongs_to', label: 'belongs to', confidence: 1, source: 'database' });

    // Account manager → customer relation when the manager maps to an employee
    if (c.accountManager) {
      const empId = employeeIdByDb.get(c.accountManager.toString()) || (await mapUserToEmployee(ctx, c.accountManager.toString()));
      if (empId) builder.addEdge({ from: empId, to: id, type: 'manages', label: 'manages', confidence: 0.9, source: 'database' });
    }
  }

  // Risks
  const riskIdByDb = new Map<string, string>();
  for (const r of risks) {
    const id = builder.getOrAddNode({
      type: 'risk',
      name: r.title,
      source: r.aiDetected ? 'decision' : 'database',
      confidence: r.confidence ?? 0.8,
      properties: {
        category: r.category,
        level: r.level,
        riskScore: r.riskScore,
        probability: r.probability,
        impact: r.impact,
        status: r.status,
        sources: r.sources,
      },
      timestamp: r.detectedAt,
      preferId: `risk:${r._id.toString()}`,
    });
    riskIdByDb.set(r._id.toString(), id);
    if (r.ownerId) {
      const empId = employeeIdByDb.get(r.ownerId.toString()) || (await mapUserToEmployee(ctx, r.ownerId.toString()));
      if (empId) builder.addEdge({ from: id, to: empId, type: 'involves', label: 'involves', confidence: 0.85, source: 'database' });
    }
    if (r.departmentId) {
      const deptId = deptIdByDb.get(r.departmentId.toString());
      if (deptId) builder.addEdge({ from: id, to: deptId, type: 'impacts', label: 'impacts', confidence: 0.9, source: 'database' });
    }
    if (orgIdNode) builder.addEdge({ from: id, to: orgIdNode, type: 'impacts', label: 'impacts', confidence: 0.9, source: 'database' });
  }
}

// Find an employee node for a User account (manager/owner joins).
async function mapUserToEmployee(ctx: AggregationContext, userId: string): Promise<string | undefined> {
  if (!mongoose.Types.ObjectId.isValid(userId)) return undefined;
  const emp = await Employee.findOne({ userId: new mongoose.Types.ObjectId(userId) }).lean();
  if (!emp) return undefined;
  const name = `${emp.firstName} ${emp.lastName}`.trim();
  const id = ctx.builder.getOrAddNode({
    type: 'employee',
    name,
    source: 'database',
    confidence: 1,
    properties: { jobTitle: emp.jobTitle, email: emp.email },
    timestamp: emp.hireDate,
    preferId: `emp:${emp._id.toString()}`,
  });
  return id;
}

async function addChatAndDecisions(ctx: AggregationContext): Promise<void> {
  const { orgId, user, builder } = ctx;

  // Decisions are stored as Query records (agentsUsed includes 'executive', or a
  // distinct decision text), so pull the decision-specific fields if present.
  const decisionPart = (q: any): Record<string, unknown> | undefined =>
    q.result && typeof q.result === 'object' ? q.result : undefined;
  // Scope conversations + queries to the requesting user so no other user's chat
  // data is exposed on the graph.
  const conversations = await Conversation.find({ organizationId: orgId, userId: user.id, isActive: true })
    .sort({ updatedAt: -1 })
    .lean();
  const queries = await Query.find({ organizationId: orgId, userId: user.id })
    .sort({ createdAt: -1 })
    .lean();

  const convIdNode = new Map<string, string>();
  for (const c of conversations) {
    const id = builder.getOrAddNode({
      type: 'conversation',
      name: c.title || 'Conversation',
      source: 'chat',
      confidence: 0.9,
      properties: { queryCount: c.queryCount, agentsUsed: c.metadata?.agentsUsed, totalTokens: c.metadata?.totalTokens },
      timestamp: c.lastMessageAt || c.createdAt,
      preferId: `conv:${c._id.toString()}`,
    });
    convIdNode.set(c._id.toString(), id);
  }

  // Topics observed across the user's chats (from real query intents)
  const topics = new Map<string, number>();
  for (const q of queries) {
    const t = q.queryUnderstanding?.intent || q.intent;
    if (t) topics.set(t, (topics.get(t) || 0) + 1);
  }
  const topicIds = new Map<string, string>();
  for (const [topic, count] of topics) {
    topicIds.set(topic, builder.getOrAddNode({
      type: 'topic',
      name: topic.replace(/_/g, ' '),
      source: 'chat',
      confidence: 0.8,
      properties: { queryCount: count },
    }));
  }

  for (const q of queries) {
    const isDecision = (q.agentsUsed || []).includes('executive') || /^evaluate decision/i.test((q.originalQuery || '').trim());
    const nodeType: string = isDecision ? 'decision' : 'query';
    const name = isDecision
      ? (q.originalQuery || '').replace(/^evaluate\s+decision\s*:?\s*/i, '').slice(0, 60) || 'Decision'
      : (q.originalQuery || 'Query').slice(0, 90);
    const id = builder.getOrAddNode({
      type: nodeType,
      name,
      source: isDecision ? 'decision' : 'universal_search',
      confidence: Math.max(0.5, q.result?.confidence ?? 0.6),
      properties: {
        intent: q.intent || q.queryUnderstanding?.intent,
        agents: q.agentsUsed,
        executionTimeMs: q.executionTimeMs,
        error: q.errorMessage,
        confidence: q.result?.confidence,
        recommendation: decisionPart(q)?.recommendation,
        summary: decisionPart(q)?.summary,
        risks: decisionPart(q)?.risks,
        opportunities: decisionPart(q)?.opportunities,
      },
      timestamp: q.createdAt,
      preferId: isDecision ? `decision:${q._id.toString()}` : `query:${q._id.toString()}`,
    });

    const convStr = q.conversationId ? q.conversationId.toString() : '';
    const convId = convStr ? convIdNode.get(convStr) : undefined;
    if (convId) {
      builder.addEdge({ from: convId, to: id, type: 'created_from', label: 'created from', confidence: 0.95, source: 'chat', timestamp: q.createdAt });
      if (isDecision) builder.addEdge({ from: convId, to: id, type: 'involves', label: 'involves', confidence: 0.9, source: 'decision', timestamp: q.createdAt });
    }

    const topicId = q.queryUnderstanding?.intent ? topicIds.get(q.queryUnderstanding.intent) : q.intent ? topicIds.get(q.intent) : undefined;
    if (topicId) builder.addEdge({ from: id, to: topicId, type: 'associated_with', label: 'associated with', confidence: 0.8, source: 'chat', timestamp: q.createdAt });

    // Link the query to entities it mentions — dedupes by canonical name so chat
    // knowledge joins the existing graph instead of duplicating it.
    const mentioned = (q.queryUnderstanding?.entities || []).map((e: string) => e.trim()).filter(Boolean);
    for (const m of mentioned) {
      const target = builder.getOrAddNode({
        type: 'concept',
        name: m,
        source: 'chat',
        confidence: 0.6,
        properties: { mentionedInChat: true },
      });
      builder.addEdge({ from: id, to: target, type: 'mentions', label: 'mentions', confidence: 0.7, source: isDecision ? 'decision' : 'universal_search', timestamp: q.createdAt });
      if (isDecision) builder.addEdge({ from: id, to: target, type: 'involves', label: 'involves', confidence: 0.75, source: 'decision', timestamp: q.createdAt });
    }
  }
}

export interface BuildResult {
  data: UnifiedGraphData;
  breakdown: { nodesByType: Record<string, number>; edgesByType: Record<string, number> };
}

async function buildUnifiedGraph(
  organizationId: string,
  filters: UnifiedGraphFilters,
  includeBreakdown = false
): Promise<BuildResult> {
  const orgId = new mongoose.Types.ObjectId(organizationId);
  const roles = filters.roles || ['employee'];
  const accessLevels = [...new Set(roles.flatMap((r) => ROLE_ACCESS_LEVELS[r] || ['public', 'internal']))];

  const builder = new GraphBuilderImpl();
  const ctx: AggregationContext = {
    orgId,
    user: { id: filters.userId, roles },
    accessLevels,
    builder,
  };

  await addStoredGraph(ctx);
  await addDocuments(ctx);
  await addEnterpriseRecords(ctx);
  await addChatAndDecisions(ctx);

  // Apply filters
  const typeFilter = filters.entityTypes?.length ? new Set(filters.entityTypes.map(canonicalType)) : null;
  const sourceFilter = filters.sources?.length ? new Set(filters.sources) : null;
  const minConf = filters.minConfidence ?? 0;

  let nodes = [...builder.nodes.values()];
  if (typeFilter) nodes = nodes.filter((n) => typeFilter.has(canonicalType(n.type)));
  if (sourceFilter) nodes = nodes.filter((n) => sourceFilter.has(n.source));
  if (minConf > 0) nodes = nodes.filter((n) => n.confidence >= minConf);

  const nodeIdSet = new Set(nodes.map((n) => n.id));
  let edges = [...builder.edges.values()].filter((e) => nodeIdSet.has(e.from) && nodeIdSet.has(e.to));
  if (minConf > 0) edges = edges.filter((e) => e.confidence >= minConf);

  const totalNodes = nodes.length;
  const totalEdges = edges.length;

  const limit = filters.limit && filters.limit > 0 ? filters.limit : totalNodes;
  let appliedNodes = nodes;
  if (nodes.length > limit) {
    // Prefer high-confidence + high-degree nodes for the overview so the visible
    // graph is meaningful; the user can expand with neighbor loads.
    const deg = new Map<string, number>();
    edges.forEach((e) => {
      deg.set(e.from, (deg.get(e.from) || 0) + 1);
      deg.set(e.to, (deg.get(e.to) || 0) + 1);
    });
    appliedNodes = [...nodes]
      .sort((a, b) => (b.confidence + Math.min((deg.get(b.id) || 0) * 0.05, 0.15)) - (a.confidence + Math.min((deg.get(a.id) || 0) * 0.05, 0.15)))
      .slice(0, limit);
  }
  const appliedNodeSet = new Set(appliedNodes.map((n) => n.id));
  const appliedEdges = edges.filter((e) => appliedNodeSet.has(e.from) && appliedNodeSet.has(e.to));

  const breakdown: BuildResult['breakdown'] = { nodesByType: {}, edgesByType: {} };
  if (includeBreakdown) {
    for (const n of appliedNodes) { breakdown.nodesByType[canonicalType(n.type)] = (breakdown.nodesByType[canonicalType(n.type)] || 0) + 1; }
    for (const e of appliedEdges) { breakdown.edgesByType[canonicalType(e.type)] = (breakdown.edgesByType[canonicalType(e.type)] || 0) + 1; }
  }

  return {
    data: { nodes: appliedNodes, edges: appliedEdges, totalNodes, totalEdges },
    breakdown,
  };
}

export const unifiedKnowledgeGraphService = {
  async getGraph(organizationId: string, filters: UnifiedGraphFilters): Promise<BuildResult> {
    return buildUnifiedGraph(organizationId, filters, false);
  },

  async getGraphWithBreakdown(organizationId: string, filters: UnifiedGraphFilters): Promise<BuildResult> {
    return buildUnifiedGraph(organizationId, filters, true);
  },

  async getEntityNeighbors(
    organizationId: string,
    entityId: string,
    userId: string,
    roles: string[]
  ): Promise<UnifiedGraphData> {
    const { data } = await buildUnifiedGraph(organizationId, { userId, roles });
    const node = data.nodes.find((n) => n.id === entityId);
    if (!node) return { nodes: [], edges: [], totalNodes: 0, totalEdges: 0 };

    const nodeIds = new Set([entityId]);
    const edgeSet = data.edges.filter((e) => e.from === entityId || e.to === entityId);
    edgeSet.forEach((e) => { nodeIds.add(e.from); nodeIds.add(e.to); });
    const nodes = data.nodes.filter((n) => nodeIds.has(n.id));
    const edges = data.edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));
    return { nodes, edges, totalNodes: nodes.length, totalEdges: edges.length };
  },

  async searchEntities(organizationId: string, query: string, userId: string, roles: string[]): Promise<UnifiedGraphNode[]> {
    const { data } = await buildUnifiedGraph(organizationId, { userId, roles, limit: 1500 });
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return data.nodes
      .filter((n) => n.name.toLowerCase().includes(q) || canonicalType(n.type).includes(q))
      .slice(0, 20);
  },
};