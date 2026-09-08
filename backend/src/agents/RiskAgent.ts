import { AgentResult, QueryUnderstanding, Source } from '../types';
import { Risk } from '../models/Risk';
import { openai, AI_MODEL } from '../config/openai';
import { logger } from '../config/logger';
import mongoose from 'mongoose';

interface RiskContext { organizationId: string }

export class RiskAgent {
  async execute(context: RiskContext, queryUnderstanding: QueryUnderstanding): Promise<AgentResult> {
    const t0 = Date.now();
    try {
      const orgId = new mongoose.Types.ObjectId(context.organizationId);
      const risks = await Risk.find({ organizationId: orgId, status: { $ne: 'resolved' } })
        .sort({ riskScore: -1 }).limit(20).lean();

      const aiAnalysis = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: 'You are an enterprise risk analyst. Identify, assess, and prioritize risks. Provide mitigation strategies.' },
          { role: 'user', content: `Query: ${queryUnderstanding.refinedQuery}\n\nExisting Risks:\n${JSON.stringify(risks, null, 2)}` },
        ],
        temperature: 0.2,
        max_tokens: 1000,
      });

      const insights = aiAnalysis.choices[0].message.content?.split('\n').filter(Boolean) || [];
      const sources: Source[] = [{ id: 'risk-db', title: 'Risk Register', type: 'database', relevanceScore: 0.92 }];

      return { agentType: 'risk', success: true, data: { risks }, insights, confidence: 0.88, sources, executionTimeMs: Date.now() - t0 };
    } catch (error) {
      logger.error('[RiskAgent] Failed:', error);
      return { agentType: 'risk', success: false, confidence: 0, sources: [], executionTimeMs: Date.now() - t0, error: (error as Error).message };
    }
  }
}
