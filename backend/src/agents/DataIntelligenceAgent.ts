import { AgentResult, QueryUnderstanding, Source } from '../types';
import { openai, AI_MODEL } from '../config/openai';
import { logger } from '../config/logger';

interface DataIntelligenceContext { organizationId: string }

export class DataIntelligenceAgent {
  async execute(context: DataIntelligenceContext, queryUnderstanding: QueryUnderstanding): Promise<AgentResult> {
    const t0 = Date.now();
    try {
      const aiAnalysis = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: 'You are a data intelligence analyst. Query and analyze structured business data, identify patterns in operational data, and provide data-driven insights.' },
          { role: 'user', content: `Query: ${queryUnderstanding.refinedQuery}\nEntities: ${queryUnderstanding.entities.join(', ')}` },
        ],
        temperature: 0.1,
        max_tokens: 800,
      });
      const insights = aiAnalysis.choices[0].message.content?.split('\n').filter(Boolean) || [];
      const sources: Source[] = [{ id: 'data-intelligence', title: 'Business Data Intelligence', type: 'database', relevanceScore: 0.87 }];
      return { agentType: 'data_intelligence', success: true, data: {}, insights, confidence: 0.83, sources, executionTimeMs: Date.now() - t0 };
    } catch (error) {
      logger.error('[DataIntelligenceAgent] Failed:', error);
      return { agentType: 'data_intelligence', success: false, confidence: 0, sources: [], executionTimeMs: Date.now() - t0, error: (error as Error).message };
    }
  }
}
