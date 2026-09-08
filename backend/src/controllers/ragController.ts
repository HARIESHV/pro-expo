import { Request, Response } from 'express';
import { DocumentModel } from '../models/Document';
import { embeddingService } from '../services/embeddingService';
import { vectorSearchService } from '../services/vectorSearchService';
import { activeAIProvider, AIChatMessage } from '../services/aiProvider';
import { getAccessLevelsForRoles } from '../config/accessControl';
import { HybridRetrievalResult, ApiResponse } from '../types';

interface FusedChunk {
  content: string;
  metadata: HybridRetrievalResult['chunks'][0]['metadata'];
  chunkIndex?: number;
  vectorScore?: number;
  keywordScore?: number;
  fusedScore: number;
}

/**
 * RAG retrieval — MongoDB hybrid search (Atlas vector + keyword) with
 * access-level and department filtering, fused + reranked, returning
 * evidence sources/citations. Scoped to the requesting user's organization.
 */
export const ragController = {
  async hybridSearch(req: Request, res: Response): Promise<void> {
    const q = (req.query.q as string || '').trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 10, 1), 50);
    const departments = (req.query.departments as string || '')
      .split(',').map((s) => s.trim()).filter(Boolean);

    if (!q) {
      res.status(400).json({ success: false, message: 'Query parameter "q" is required' } as ApiResponse);
      return;
    }

    const organizationId = req.user!.organizationId.toString();
    const accessLevels = getAccessLevelsForRoles(req.user!.roles);

    const queryEmbedding = await embeddingService.generateEmbedding(q);
    const [vectorChunks, keywordChunks] = await Promise.all([
      vectorSearchService.vectorSearch({ organizationId, queryEmbedding, limit, accessLevels, departments }),
      vectorSearchService.keywordSearch({ organizationId, query: q, limit, accessLevels }),
    ]);

    // Retrieval fusion + reranking (dedupe on normalized content, blend scores).
    const fused = new Map<string, FusedChunk>();
    const merge = (item: (typeof vectorChunks)[number], kind: 'vector' | 'keyword') => {
      const key = (item.content || '').trim();
      if (!key) return;
      const existing = fused.get(key);
      const score = item.fusedScore ?? (item.vectorScore ?? item.keywordScore ?? 0);
      if (!existing) {
        fused.set(key, {
          content: item.content,
          metadata: item.metadata,
          chunkIndex: (item as { chunkIndex?: number }).chunkIndex,
          vectorScore: (item as { vectorScore?: number }).vectorScore,
          keywordScore: (item as { keywordScore?: number }).keywordScore,
          fusedScore: score,
        });
        return;
      }
      existing.fusedScore = Math.max(existing.fusedScore, score);
      if (kind === 'vector' && (item as { vectorScore?: number }).vectorScore != null) {
        existing.vectorScore = (item as { vectorScore?: number }).vectorScore;
      }
      if (kind === 'keyword' && (item as { keywordScore?: number }).keywordScore != null) {
        existing.keywordScore = (item as { keywordScore?: number }).keywordScore;
      }
    };
    vectorChunks.forEach((c) => merge(c, 'vector'));
    keywordChunks.forEach((c) => merge(c, 'keyword'));

    const chunks = [...fused.values()].sort((a, b) => b.fusedScore - a.fusedScore).slice(0, limit);

    // Evidence enrichment: resolve document titles for citations.
    const docIds = [...new Set(chunks.map((c) => c.metadata?.documentId).filter(Boolean))];
    const docs = docIds.length
      ? await DocumentModel.find({ _id: { $in: docIds } }).select('title documentType').lean()
      : [];
    const titleById = new Map(docs.map((d) => [String(d._id), d]));

    const sources = chunks.map((c, i) => ({
      id: `${c.metadata?.documentId || 'doc'}:${c.chunkIndex ?? i}`,
      documentId: c.metadata?.documentId,
      title: titleById.get(String(c.metadata?.documentId))?.title || 'Unknown document',
      documentType: titleById.get(String(c.metadata?.documentId))?.documentType,
      snippet: c.content.slice(0, 300),
      relevanceScore: c.fusedScore,
      vectorScore: c.vectorScore,
      keywordScore: c.keywordScore,
    }));

    res.json({
      success: true,
      data: {
        query: q,
        chunks,
        sources,
        total: chunks.length,
        scopedAccessLevels: accessLevels,
      },
    } as ApiResponse);
  },

  /**
   * Evidence-backed answer — hybrid retrieval followed by AI reasoning over
   * the retrieved context, returning an answer plus its sources/citations.
   */
  async query(req: Request, res: Response): Promise<void> {
    const q = (req.body?.query || '').trim();
    if (!q) {
      res.status(400).json({ success: false, message: 'Body field "query" is required' } as ApiResponse);
      return;
    }

    const organizationId = req.user!.organizationId.toString();
    const accessLevels = getAccessLevelsForRoles(req.user!.roles);

    const queryEmbedding = await embeddingService.generateEmbedding(q);
    const [vectorChunks, keywordChunks] = await Promise.all([
      vectorSearchService.vectorSearch({ organizationId, queryEmbedding, limit: 8, accessLevels }),
      vectorSearchService.keywordSearch({ organizationId, query: q, limit: 8, accessLevels }),
    ]);
    const seen = new Set<string>();
    const context: string[] = [];
    for (const c of [...vectorChunks, ...keywordChunks].sort((a, b) => (b.fusedScore ?? 0) - (a.fusedScore ?? 0))) {
      const key = (c.content || '').trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      context.push(c.content);
      if (context.length >= 8) break;
    }

    const messages: AIChatMessage[] = context.length
      ? [
          {
            role: 'system',
            content:
              'You are an enterprise intelligence assistant over the organization\'s documents. ' +
              'Answer the user\'s question using ONLY the retrieved context below. ' +
              'If the context is insufficient, say so. Be concise and cite source snippets.\n\nContext:\n' +
              context.map((c, i) => `[${i + 1}] ${c}`).join('\n\n'),
          },
          { role: 'user', content: q },
        ]
      : [
          {
            role: 'system',
            content: 'You are an enterprise intelligence assistant. No relevant documents were retrieved for the query.',
          },
          { role: 'user', content: q },
        ];

    const answer = await activeAIProvider.complete(messages, { temperature: 0.3, maxTokens: 800 });

    res.json({
      success: true,
      data: { query: q, answer, sources: context.map((c, i) => ({ id: `ctx:${i}`, snippet: c.slice(0, 300), relevanceScore: i + 1 })), retrievedChunks: context.length },
    } as ApiResponse);
  },
};