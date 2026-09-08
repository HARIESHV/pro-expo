import { AgentResult, QueryUnderstanding, Source } from '../types';
import { openai, AI_MODEL } from '../config/openai';
import { logger } from '../config/logger';

interface ExecutiveContext { organizationId: string; userId: string }

export class ExecutiveAgent {
  async execute(context: ExecutiveContext, queryUnderstanding: QueryUnderstanding): Promise<AgentResult> {
    const t0 = Date.now();
    try {
      const aiAnalysis = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: 'You are an executive intelligence advisor. Synthesize information into strategic executive-level insights, strategic recommendations, and board-ready summaries.' },
          { role: 'user', content: `Query: ${queryUnderstanding.refinedQuery}\nIntent: ${queryUnderstanding.intent}` },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });
      const insights = aiAnalysis.choices[0].message.content?.split('\n').filter(Boolean) || [];
      const sources: Source[] = [{ id: 'executive-intelligence', title: 'Executive Intelligence', type: 'database', relevanceScore: 0.9 }];
      return { agentType: 'executive', success: true, data: {}, insights, confidence: 0.85, sources, executionTimeMs: Date.now() - t0 };
    } catch (error) {
      logger.error('[ExecutiveAgent] Failed:', error);
      return { agentType: 'executive', success: false, confidence: 0, sources: [], executionTimeMs: Date.now() - t0, error: (error as Error).message };
    }
  }
}
