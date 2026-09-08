import { AgentResult, QueryUnderstanding, Source } from '../types';
import { SalesRecord } from '../models/SalesRecord';
import { openai, AI_MODEL } from '../config/openai';
import { logger } from '../config/logger';
import mongoose from 'mongoose';

interface SalesContext {
  organizationId: string;
}

export class SalesAgent {
  async execute(context: SalesContext, queryUnderstanding: QueryUnderstanding): Promise<AgentResult> {
    const t0 = Date.now();
    try {
      const orgId = new mongoose.Types.ObjectId(context.organizationId);

      // Aggregate sales data based on entities/timeRange from query understanding
      const pipeline: mongoose.PipelineStage[] = [
        { $match: { organizationId: orgId } },
        {
          $group: {
            _id: { region: '$region', quarter: '$period.quarter', year: '$period.year' },
            totalRevenue: { $sum: '$amount' },
            dealCount: { $sum: 1 },
            avgDealSize: { $avg: '$amount' },
            wonDeals: { $sum: { $cond: [{ $eq: ['$stage', 'closed_won'] }, 1, 0] } },
          },
        },
        { $sort: { '_id.year': -1, '_id.quarter': -1 } },
        { $limit: 20 },
      ];

      const salesData = await SalesRecord.aggregate(pipeline);

      // Use AI to interpret the sales data
      const aiResponse = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a sales intelligence analyst. Analyze the provided sales data and generate key insights relevant to the user query.',
          },
          {
            role: 'user',
            content: `Query: ${queryUnderstanding.refinedQuery}\n\nSales Data:\n${JSON.stringify(salesData, null, 2)}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 1000,
      });

      const insights = aiResponse.choices[0].message.content?.split('\n').filter(Boolean) || [];
      const sources: Source[] = [
        {
          id: 'sales-db',
          title: 'Sales Database',
          type: 'database',
          relevanceScore: 0.9,
          metadata: { recordCount: salesData.length },
        },
      ];

      return {
        agentType: 'sales',
        success: true,
        data: salesData,
        insights,
        confidence: salesData.length > 0 ? 0.88 : 0.4,
        sources,
        executionTimeMs: Date.now() - t0,
      };
    } catch (error) {
      logger.error('[SalesAgent] Failed:', error);
      return {
        agentType: 'sales',
        success: false,
        confidence: 0,
        sources: [],
        executionTimeMs: Date.now() - t0,
        error: (error as Error).message,
      };
    }
  }
}
