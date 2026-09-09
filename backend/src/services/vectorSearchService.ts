import mongoose from 'mongoose';
import { DocumentChunk } from '../models/DocumentChunk';
import { env } from '../config/env';
import { HybridRetrievalResult, AccessLevel } from '../types';
import { logger } from '../config/logger';

export interface VectorSearchOptions {
  organizationId: string;
  queryEmbedding: number[];
  limit?: number;
  minScore?: number;
  accessLevels?: AccessLevel[];
  departments?: string[];
  documentIds?: string[];
}

export interface KeywordSearchOptions {
  organizationId: string;
  query: string;
  limit?: number;
  accessLevels?: AccessLevel[];
  documentIds?: string[];
}

export const vectorSearchService = {
  /**
   * MongoDB Atlas Vector Search — semantic search over document chunks.
   * Falls back to cosine similarity scan for local MongoDB (no Atlas).
   */
  async vectorSearch(options: VectorSearchOptions): Promise<HybridRetrievalResult['chunks']> {
    const { organizationId, queryEmbedding, limit = 20, minScore = 0.7, accessLevels, departments, documentIds } = options;

    const filter: Record<string, unknown> = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
    };
    if (accessLevels?.length) {
      filter['metadata.accessLevel'] = { $in: accessLevels };
    }
    if (departments?.length) {
      filter['metadata.department'] = { $in: departments };
    }
    if (documentIds?.length) {
      filter.documentId = { $in: documentIds.map((id) => new mongoose.Types.ObjectId(id)) };
    }
    try {
      // Try MongoDB Atlas $vectorSearch aggregation
      const pipeline: mongoose.PipelineStage[] = [
        {
          $vectorSearch: {
            index: env.VECTOR_SEARCH_INDEX_NAME,
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: limit * 10,
            limit,
            filter,
          },
        } as unknown as mongoose.PipelineStage,
        {
          $project: {
            content: 1,
            metadata: 1,
            chunkIndex: 1,
            vectorScore: { $meta: 'vectorSearchScore' },
          },
        },
        { $match: { vectorScore: { $gte: minScore } } },
      ];

      const results = await DocumentChunk.aggregate(pipeline);
      return results.map((r) => ({
        content: r.content,
        metadata: r.metadata,
        vectorScore: r.vectorScore,
        fusedScore: r.vectorScore,
      }));
    } catch (atlasError) {
      // Fallback: in-memory cosine similarity for local MongoDB
      logger.warn('Atlas Vector Search not available, falling back to in-memory search');
      return vectorSearchService._fallbackVectorSearch(organizationId, queryEmbedding, limit, filter);
    }
  },

  async _fallbackVectorSearch(
    organizationId: string,
    queryEmbedding: number[],
    limit: number,
    filter: Record<string, unknown>
  ): Promise<HybridRetrievalResult['chunks']> {
    const chunks = await DocumentChunk.find({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      ...filter,
    }).limit(1000).lean();

    const scored = chunks.map((chunk) => {
      const embedding = chunk.embedding as number[];
      const score = cosineSimilarity(queryEmbedding, embedding);
      return { ...chunk, vectorScore: score, fusedScore: score };
    });

    return scored
      .sort((a, b) => b.vectorScore - a.vectorScore)
      .slice(0, limit)
      .map((c) => ({
        content: c.content,
        metadata: c.metadata,
        vectorScore: c.vectorScore,
        fusedScore: c.fusedScore,
      }));
  },

  /**
   * MongoDB full-text keyword search.
   */
  async keywordSearch(options: KeywordSearchOptions): Promise<HybridRetrievalResult['chunks']> {
    const { organizationId, query, limit = 20, accessLevels, documentIds } = options;

    const filter: Record<string, unknown> = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
      $text: { $search: query },
    };
    if (accessLevels?.length) {
      filter['metadata.accessLevel'] = { $in: accessLevels };
    }
    if (documentIds?.length) {
      filter.documentId = { $in: documentIds.map((id) => new mongoose.Types.ObjectId(id)) };
    }

    const results = await DocumentChunk.find(filter, {
      score: { $meta: 'textScore' },
    })
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .lean();

    return results.map((r: Record<string, unknown>) => ({
      content: r.content as string,
      metadata: r.metadata as HybridRetrievalResult['chunks'][0]['metadata'],
      keywordScore: r.score as number | undefined,
      fusedScore: (r.score as number) / 10, // Normalize
    }));
  },
};

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}
