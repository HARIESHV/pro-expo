import { AgentResult, QueryUnderstanding, Source } from '../types';
import { AnalyticsResult } from '../models/AnalyticsResult';
import { SalesRecord } from '../models/SalesRecord';
import { openai, AI_MODEL } from '../config/openai';
import { logger } from '../config/logger';
import mongoose from 'mongoose';

interface AnalyticsContext {
  organizationId: string;
}

export class AnalyticsAgent {
  async execute(context: AnalyticsContext, queryUnderstanding: QueryUnderstanding): Promise<AgentResult> {
    const t0 = Date.now();
    try {
      const orgId = new mongoose.Types.ObjectId(context.organizationId);

      const trendData = await SalesRecord.aggregate([
        { $match: { organizationId: orgId } },
        {
          $group: {
            _id: { year: '$period.year', quarter: '$period.quarter', region: '$region' },
            revenue: { $sum: '$amount' },
            deals: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.quarter': 1 } },
      ]);

      const aiAnalysis = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a business analytics expert. Analyze the trend data, identify patterns, anomalies, and generate statistical insights.',
          },
          {
            role: 'user',
            content: `Query: ${queryUnderstanding.refinedQuery}\n\nTrend Data:\n${JSON.stringify(trendData, null, 2)}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 1200,
      });

      const insights = aiAnalysis.choices[0].message.content?.split('\n').filter(Boolean) || [];

      const sources: Source[] = [
        { id: 'analytics-engine', title: 'Analytics Engine', type: 'database', relevanceScore: 0.9 },
      ];

      return {
        agentType: 'analytics',
        success: true,
        data: { trendData },
        insights,
        confidence: 0.85,
        sources,
        executionTimeMs: Date.now() - t0,
      };
    } catch (error) {
      logger.error('[AnalyticsAgent] Failed:', error);
      return {
        agentType: 'analytics',
        success: false,
        confidence: 0,
        sources: [],
        executionTimeMs: Date.now() - t0,
        error: (error as Error).message,
      };
    }
  }
}
