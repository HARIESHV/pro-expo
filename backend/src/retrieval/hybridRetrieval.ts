import { embeddingService } from '../services/embeddingService';
import { vectorSearchService } from '../services/vectorSearchService';
import { HybridRetrievalResult, AccessLevel } from '../types';

export interface HybridRetrievalOptions {
  organizationId: string;
  query: string;
  accessLevels?: AccessLevel[];
  departments?: string[];
  topK?: number;
  vectorWeight?: number;
  keywordWeight?: number;
  documentIds?: string[];
}

export async function hybridRetrieval(options: HybridRetrievalOptions): Promise<HybridRetrievalResult> {
  const {
    organizationId,
    query,
    accessLevels,
    departments,
    topK = 10,
    vectorWeight = 0.7,
    keywordWeight = 0.3,
    documentIds,
  } = options;

  const [queryEmbedding] = await Promise.all([embeddingService.generateEmbedding(query)]);

  // Run vector + keyword search in parallel
  const [vectorResults, keywordResults] = await Promise.all([
    vectorSearchService.vectorSearch({
      organizationId,
      queryEmbedding,
      limit: topK * 2,
      accessLevels,
      departments,
      documentIds,
    }),
    vectorSearchService.keywordSearch({
      organizationId,
      query,
      limit: topK * 2,
      accessLevels,
      documentIds,
    }),
  ]);

  // Reciprocal Rank Fusion (RRF)
  const scoreMap = new Map<string, {
    content: string;
    metadata: HybridRetrievalResult['chunks'][0]['metadata'];
    vectorScore?: number;
    keywordScore?: number;
    fusedScore: number;
  }>();

  const k = 60; // RRF constant

  vectorResults.forEach((chunk, rank) => {
    const key = chunk.content.slice(0, 100);
    const rrfScore = vectorWeight / (k + rank + 1);
    const existing = scoreMap.get(key);
    if (existing) {
      existing.fusedScore += rrfScore;
      existing.vectorScore = chunk.vectorScore;
    } else {
      scoreMap.set(key, { ...chunk, fusedScore: rrfScore });
    }
  });

  keywordResults.forEach((chunk, rank) => {
    const key = chunk.content.slice(0, 100);
    const rrfScore = keywordWeight / (k + rank + 1);
    const existing = scoreMap.get(key);
    if (existing) {
      existing.fusedScore += rrfScore;
      existing.keywordScore = chunk.keywordScore;
    } else {
      scoreMap.set(key, { ...chunk, fusedScore: rrfScore });
    }
  });

  const merged = Array.from(scoreMap.values())
    .sort((a, b) => b.fusedScore - a.fusedScore)
    .slice(0, topK);

  return { chunks: merged, totalFound: scoreMap.size };
}
