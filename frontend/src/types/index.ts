// ============================================================
// Enterprise Intelligent Platform — Frontend Shared Types
// ============================================================

export type UserRole =
  | 'ceo' | 'manager' | 'employee'
  | 'analyst' | 'hr' | 'finance' | 'sales';

export type AgentType =
  | 'master' | 'rag' | 'data_intelligence' | 'analytics' | 'finance'
  | 'sales' | 'customer_intelligence' | 'document_intelligence'
  | 'data_query' | 'risk' | 'executive'
  | 'web_research' | 'knowledge_graph';

export type IntentType =
  | 'analytical' | 'search' | 'comparison' | 'forecast'
  | 'risk_assessment' | 'report' | 'knowledge_retrieval' | 'decision_support'
  | 'web_research';

export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatar?: string;
  roles: UserRole[];
  organizationId: string;
  departmentId?: string;
  status: 'active' | 'inactive' | 'suspended';
  lastLoginAt?: string;
  preferences: { theme: 'light' | 'dark'; notifications: boolean; language: string };
  createdAt: string;
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface Organization {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  industry?: string;
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  isActive: boolean;
}

export interface QueryUnderstanding {
  originalQuery: string;
  refinedQuery: string;
  intent: IntentType;
  entities: string[];
  timeRange?: { start?: string; end?: string };
  departments?: string[];
  filters?: Record<string, unknown>;
}

export interface Source {
  id: string;
  title: string;
  type: 'document' | 'database' | 'api' | 'knowledge_graph';
  relevanceScore: number;
  excerpt?: string;
  url?: string;
}

export interface Citation {
  sourceId: string;
  title: string;
  excerpt: string;
  page?: number;
  relevanceScore: number;
}

export interface Evidence {
  key: string;
  value: string;
  source: Source;
  confidence: number;
}

export interface SubTask {
  id: string;
  description: string;
  agentType: AgentType;
  priority: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface IntelligenceResponse {
  queryId: string;
  answer: string;
  summary: string;
  keyFindings: string[];
  evidence: Evidence[];
  sources: Source[];
  citations: Citation[];
  confidence: number;
  hasAnswer?: boolean;
  recommendations: string[];
  expectedImpact: string;
  risks: string[];
  agentsUsed: AgentType[];
  executionTimeMs: number;
  queryUnderstanding: QueryUnderstanding;
  subTasks: SubTask[];
}

export interface Message {
  _id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  answer?: string;
  summary?: string;
  keyFindings?: string[];
  evidence?: Evidence[];
  sources?: Source[];
  citations?: Citation[];
  confidence?: number;
  hasAnswer?: boolean;
  recommendations?: string[];
  expectedImpact?: string;
  risks?: string[];
  agentsUsed?: AgentType[];
  executionTimeMs?: number;
  queryUnderstanding?: QueryUnderstanding;
  subTasks?: SubTask[];
  createdAt: string;
}

export interface Conversation {
  _id: string;
  title: string;
  userId: string;
  queryCount: number;
  lastMessageAt?: string;
  createdAt: string;
}

export interface Document {
  _id: string;
  title: string;
  description?: string;
  fileName: string;
  fileSize: number;
  documentType: string;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  accessLevel: string;
  chunksCount: number;
  tags: string[];
  uploadedBy: { firstName: string; lastName: string; email: string };
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface KnowledgeGraphNode {
  id: string;
  name: string;
  type: string;
  source?: string;
  confidence?: number;
  timestamp?: string;
  properties: Record<string, unknown>;
}

export interface KnowledgeGraphEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  type: string;
  weight: number;
  confidence?: number;
  source?: string;
  timestamp?: string;
}

export interface GraphData {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  totalNodes?: number;
  totalEdges?: number;
}

export interface DashboardMetrics {
  revenue: { current: number; previous: number; growth: number };
  customers: Array<{ _id: string; count: number; avgLTV: number }>;
  risks: Array<{ _id: string; count: number }>;
  totalQueries: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

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

export interface SearchResult {
  id: string;
  type: SearchResultType;
  category: string;
  title: string;
  snippet: string;
  description?: string;
  source: string;
  relevance: number;
  timestamp?: string;
  url: string;
  permissions: string[];
  metadata: Record<string, unknown>;
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

export const SEARCH_CATEGORY_LABEL: Record<SearchResultType, string> = {
  document: 'Documents',
  chat: 'AI Chat',
  knowledge: 'Knowledge Graph',
  user: 'Users',
  dashboard: 'Dashboards',
  decision: 'Decision Intelligence',
  report: 'Reports',
  analytics: 'Analytics',
  company: 'Companies',
};

export const SEARCH_CATEGORY_ORDER: SearchResultType[] = [
  'document',
  'company',
  'chat',
  'decision',
  'knowledge',
  'dashboard',
  'report',
  'analytics',
  'user',
];

/**
 * Categories visible to non-admin (employee / user-tier) roles.
 * The backend enforces this restriction too; this is purely for UI filtering.
 */
export const USER_SEARCH_CATEGORY_ORDER: SearchResultType[] = [
  'document',
  'chat',
  'decision',
];

/** Returns true if the role array contains an admin-tier role. */
export function isAdminRole(roles: string[] | undefined): boolean {
  if (!roles || roles.length === 0) return false;
  return roles.some((r) => r.toLowerCase().trim() === 'super_admin');
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Customer {
  _id: string;
  name: string;
  region: string;
  segment: string;
  status: string;
  lifetimeValue: number;
  riskScore: number;
}

export interface AuditLog {
  _id: string;
  action: string;
  resource: string;
  method: string;
  path: string;
  statusCode: number;
  ipAddress: string;
  duration: number;
  success: boolean;
  userId?: { firstName: string; lastName: string; email: string };
  createdAt: string;
}

// ---- Universal Company Knowledge (read-only profile) ----
export interface CompanyProfile {
  id: string;
  legalName?: string;
  displayName: string;
  aliases: string[];
  category?: string;
  ownership?: string;
  industry?: string;
  subIndustry?: string;
  description?: string;
  foundedYear?: number;
  founders: Array<{ name: string; role?: string }>;
  headquarters?: { city?: string; state?: string; country?: string; region?: string };
  countries: string[];
  website?: string;
  officialDomains: string[];
  parentCompanyName?: string;
  subsidiaries: string[];
  brands: string[];
  competitors: string[];
  employeeRange?: { min?: number; max?: number; approx?: string };
  revenue?: { amount?: number; currency?: string; year?: number; note?: string };
  marketCap?: { amount?: number; currency?: string };
  stockTicker?: string;
  stockExchange?: string;
  products: string[];
  services: string[];
  technologies: string[];
  leadership: Array<{ name: string; role?: string }>;
  careersUrl?: string;
  dataConfidence?: number;
  status?: string;
  lastVerifiedAt?: string;
}

export interface CompanySearchResponse {
  query: string;
  results: Array<{ matchedBy: string; company: CompanyProfile }>;
  total: number;
}

