import { openai, EMBEDDING_MODEL } from '../config/openai';
import { logger } from '../config/logger';

export const embeddingService = {
  /**
   * Generate embedding vector for a text string.
   * Returns a float[] of 3072 dimensions (text-embedding-3-large).
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const sanitized = text.replace(/\n+/g, ' ').trim().slice(0, 8000);
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: sanitized,
      });
      return response.data[0].embedding;
    } catch (error) {
      logger.error('Embedding generation failed:', error);
      throw new Error(`Failed to generate embedding: ${(error as Error).message}`);
    }
  },

  /**
   * Generate embeddings for multiple texts in batch.
   */
  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    const batchSize = 20;
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize).map((t) => t.replace(/\n+/g, ' ').trim().slice(0, 8000));
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch,
      });
      results.push(...response.data.map((d: { embedding: number[] }) => d.embedding));
    }

    return results;
  },

  /**
   * Calculate cosine similarity between two vectors.
   */
  cosineSimilarity(a: number[], b: number[]): number {
    const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
    const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
    const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
    return dot / (magA * magB);
  },
};
