import { AgentResult, QueryUnderstanding, Source } from '../types';
import { hybridRetrieval } from '../retrieval/hybridRetrieval';
import { logger } from '../config/logger';

interface RAGContext {
  organizationId: string;
  accessLevels: string[];
  departments?: string[];
  documentIds?: string[];
}

export class RAGAgent {
  async execute(context: RAGContext, queryUnderstanding: QueryUnderstanding): Promise<AgentResult> {
    const t0 = Date.now();
    try {
      const result = await hybridRetrieval({
        organizationId: context.organizationId,
        query: queryUnderstanding.refinedQuery,
        accessLevels: context.accessLevels as never[],
        departments: context.departments,
        topK: 15,
        documentIds: context.documentIds,
      });

      const insights = result.chunks.slice(0, 5).map((c) => c.content.slice(0, 300));
      const sources: Source[] = result.chunks.slice(0, 8).map((c, i) => ({
        id: `rag-${i}`,
        title: c.metadata.source || 'Document',
        type: 'document',
        relevanceScore: c.fusedScore,
        excerpt: c.content.slice(0, 200),
      }));

      return {
        agentType: 'rag',
        success: true,
        data: { chunks: result.chunks.length, topContext: insights },
        insights,
        confidence: result.chunks.length > 0 ? 0.85 : 0.3,
        sources,
        executionTimeMs: Date.now() - t0,
      };
    } catch (error) {
      logger.error('[RAGAgent] Failed:', error);
      return {
        agentType: 'rag',
        success: false,
        confidence: 0,
        sources: [],
        executionTimeMs: Date.now() - t0,
        error: (error as Error).message,
      };
    }
  }
}
