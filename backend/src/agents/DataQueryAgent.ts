import { AgentResult, QueryUnderstanding, Source } from '../types';
import { openai, AI_MODEL } from '../config/openai';
import { logger } from '../config/logger';
import mongoose from 'mongoose';
import { Customer } from '../models/Customer';
import { SalesRecord } from '../models/SalesRecord';

interface DataQueryContext { organizationId: string }

export class DataQueryAgent {
  async execute(context: DataQueryContext, queryUnderstanding: QueryUnderstanding): Promise<AgentResult> {
    const t0 = Date.now();
    try {
      const orgId = new mongoose.Types.ObjectId(context.organizationId);

      // Build a MongoDB aggregation pipeline from the query understanding
      const aiPipelineResponse = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          {
            role: 'system',
            content: `You are a MongoDB query expert. Based on the user's query understanding, generate a MongoDB aggregation pipeline for the most relevant collection.
Available collections: customers, salesrecords, employees, departments, projects.
Respond ONLY with valid JSON: {"collection": "collectionName", "pipeline": [...aggregation stages...]}
Keep the pipeline simple and use only valid MongoDB operators.`,
          },
          {
            role: 'user',
            content: JSON.stringify({ intent: queryUnderstanding.intent, query: queryUnderstanding.refinedQuery, entities: queryUnderstanding.entities }),
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 800,
      });

      const plan = JSON.parse(aiPipelineResponse.choices[0].message.content || '{}');
      let queryResults: unknown[] = [];

      if (plan.collection && plan.pipeline) {
        // Add organizationId filter to first stage
        const orgFilter = { $match: { organizationId: orgId } };
        const pipeline = [orgFilter, ...plan.pipeline.slice(0, 5)]; // Limit stages for safety

        const collectionMap: Record<string, mongoose.Model<mongoose.Document>> = {
          customers: Customer as unknown as mongoose.Model<mongoose.Document>,
          salesrecords: SalesRecord as unknown as mongoose.Model<mongoose.Document>,
        };

        const model = collectionMap[plan.collection.toLowerCase()];
        if (model) {
          queryResults = await (model as unknown as { aggregate: (pipeline: unknown[]) => Promise<unknown[]> }).aggregate(pipeline);
        }
      }

      const insights = queryResults.length > 0
        ? [`Found ${queryResults.length} records matching the query criteria`]
        : ['No data found for the specified query parameters'];

      const sources: Source[] = [
        { id: 'data-query', title: `${plan.collection || 'Business'} Database`, type: 'database', relevanceScore: 0.85 },
      ];

      return { agentType: 'data_query', success: true, data: { results: queryResults, collection: plan.collection }, insights, confidence: queryResults.length > 0 ? 0.85 : 0.5, sources, executionTimeMs: Date.now() - t0 };
    } catch (error) {
      logger.error('[DataQueryAgent] Failed:', error);
      return { agentType: 'data_query', success: false, confidence: 0, sources: [], executionTimeMs: Date.now() - t0, error: (error as Error).message };
    }
  }
}
