// ============================================================
// Enterprise Intelligent Platform — Shared TypeScript Types
// ============================================================

export type UserRole =
  | 'super_admin'
  | 'ceo'
  | 'manager'
  | 'employee'
  | 'analyst'
  | 'hr'
  | 'finance'
  | 'sales';

export type DocumentType =
  | 'pdf'
  | 'docx'
  | 'doc'
  | 'xlsx'
  | 'csv'
  | 'txt'
  | 'email'
  | 'transcript'
  | 'api_data';

export type AccessLevel = 'public' | 'internal' | 'confidential' | 'restricted' | 'top_secret';

export type AgentStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type RelationshipType =
  | 'purchased'
  | 'contacted'
  | 'belongs_to'
  | 'works_for'
  | 'works_on'
  | 'reports_to'
  | 'manages'
  | 'partners_with'
  | 'competes_with'
  | 'related_to'
  | 'caused_by'
  | 'causes'
  | 'impacts'
  | 'owns'
  | 'depends_on'
  | 'mentions'
  | 'references'
  | 'created_from'
  | 'supports'
  | 'contradicts'
  | 'derived_from'
  | 'associated_with'
  | 'part_of'
  | 'located_in'
  | 'involves';

export type EntityType =
  | 'customer'
  | 'employee'
  | 'product'
  | 'project'
  | 'department'
  | 'organization'
  | 'region'
  | 'concept'
  | 'event'
  | 'metric'
  | 'document'
  | 'decision'
  | 'risk'
  | 'insight'
  | 'query'
  | 'conversation'
  | 'topic';

/** Provenance buckets a node/edge can come from. */
export type GraphSource =
  | 'knowledge'
  | 'document'
  | 'database'
  | 'chat'
  | 'decision'
  | 'universal_search';

export interface JWTPayload {
  userId: string;
  organizationId: string;
  roles: UserRole[];
  iat?: number;
  exp?: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

// ---- AI / RAG Types ----

export type IntentType =
  | 'GENERAL_INFORMATION'
  | 'COMPANY_OVERVIEW'
  | 'FINANCIAL_ANALYSIS'
  | 'REVENUE'
  | 'PROJECT_ANALYSIS'
  | 'CUSTOMER_ANALYSIS'
  | 'RISK_ANALYSIS'
  | 'EMPLOYEE_ANALYSIS'
  | 'DOCUMENT_SEARCH'
  | 'DOCUMENT_ANALYSIS'
  | 'GOVERNANCE'
  | 'BYLAWS'
  | 'OPERATING_AGREEMENT'
  | 'COMPETITOR_ANALYSIS'
  | 'PERFORMANCE_ANALYSIS'
  | 'EXECUTIVE_SUMMARY'
  | 'COMPARISON'
  | 'TREND_ANALYSIS'
  | 'analytical'
  | 'search'
  | 'comparison'
  | 'forecast'
  | 'risk_assessment'
  | 'report'
  | 'knowledge_retrieval'
  | 'decision_support'
  | 'web_research';

export interface QueryUnderstanding {
  originalQuery: string;
  refinedQuery: string;
  intent: IntentType;
  category?: 'general' | 'enterprise';
  isEnterprise?: boolean;
  entities: string[];
  expansions?: string[];
  timeRange?: { start?: string; end?: string };
  departments?: string[];
  filters?: Record<string, unknown>;
}

export interface SubTask {
  id: string;
  description: string;
  agentType: AgentType;
  priority: number;
  dependencies: string[];
  status: TaskStatus;
  result?: AgentResult;
}

export type AgentType =
  | 'master'
  | 'rag'
  | 'data_intelligence'
  | 'analytics'
  | 'finance'
  | 'sales'
  | 'customer_intelligence'
  | 'document_intelligence'
  | 'data_query'
  | 'risk'
  | 'executive'
  | 'web_research'
  | 'knowledge_graph'
  | 'company';

export interface AgentResult {
  agentType: AgentType;
  success: boolean;
  data?: unknown;
  insights?: string[];
  confidence: number;
  sources?: Source[];
  error?: string;
  executionTimeMs: number;
}

export interface Source {
  id: string;
  title: string;
  type: 'document' | 'database' | 'api' | 'knowledge_graph' | 'web';
  relevanceScore: number;
  excerpt?: string;
  snippet?: string;
  url?: string;
  metadata?: Record<string, unknown>;
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

export interface DocumentChunkMetadata {
  documentId: string;
  organizationId: string;
  department?: string;
  author?: string;
  createdDate?: Date;
  modifiedDate?: Date;
  accessLevel: AccessLevel;
  documentType: DocumentType;
  source: string;
  confidence: number;
  chunkIndex: number;
  totalChunks: number;
}

export interface WebSocketMessage {
  type:
    | 'agent_started'
    | 'agent_completed'
    | 'agent_failed'
    | 'query_update'
    | 'ingestion_update'
    | 'notification';
  payload: unknown;
  timestamp: string;
}

export interface IngestionResult {
  documentId: string;
  chunksCreated: number;
  entitiesExtracted: number;
  relationshipsExtracted: number;
  success: boolean;
  errors?: string[];
}

export interface HybridRetrievalResult {
  chunks: Array<{
    content: string;
    metadata: DocumentChunkMetadata;
    vectorScore?: number;
    keywordScore?: number;
    fusedScore: number;
  }>;
  totalFound: number;
}
