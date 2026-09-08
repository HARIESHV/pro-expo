import { AgentResult, QueryUnderstanding, Source } from '../types';
import { DocumentModel } from '../models/Document';
import { openai, AI_MODEL } from '../config/openai';
import { logger } from '../config/logger';
import mongoose from 'mongoose';

interface DocumentIntelligenceContext { organizationId: string }

export class DocumentIntelligenceAgent {
  async execute(context: DocumentIntelligenceContext, queryUnderstanding: QueryUnderstanding): Promise<AgentResult> {
    const t0 = Date.now();
    try {
      const orgId = new mongoose.Types.ObjectId(context.organizationId);

      // Find relevant documents based on query entities
      const docFilter: Record<string, unknown> = { organizationId: orgId, isDeleted: false, processingStatus: 'completed' };
      if (queryUnderstanding.entities.length > 0) {
        docFilter.$text = { $search: queryUnderstanding.entities.join(' ') };
      }

      const docs = await DocumentModel.find(docFilter)
        .select('title documentType chunksCount accessLevel metadata.author tags createdAt')
        .limit(10)
        .lean();

      const aiAnalysis = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a document intelligence analyst. Analyze document metadata and provide insights about relevant documents for the user query.',
          },
          {
            role: 'user',
            content: `Query: ${queryUnderstanding.refinedQuery}\n\nRelevant Documents:\n${JSON.stringify(docs.map((d) => ({ title: d.title, type: d.documentType, chunks: d.chunksCount })), null, 2)}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 600,
      });

      const insights = aiAnalysis.choices[0].message.content?.split('\n').filter(Boolean) || [];
      const sources: Source[] = docs.map((d, i) => ({
        id: d._id.toString(),
        title: d.title,
        type: 'document',
        relevanceScore: 0.9 - i * 0.05,
      }));

      return { agentType: 'document_intelligence', success: true, data: { docs }, insights, confidence: docs.length > 0 ? 0.85 : 0.4, sources, executionTimeMs: Date.now() - t0 };
    } catch (error) {
      logger.error('[DocumentIntelligenceAgent] Failed:', error);
      return { agentType: 'document_intelligence', success: false, confidence: 0, sources: [], executionTimeMs: Date.now() - t0, error: (error as Error).message };
    }
  }
}
