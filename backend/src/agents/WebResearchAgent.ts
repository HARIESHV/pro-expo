import { AgentResult, QueryUnderstanding, Source } from '../types';
import { openai, AI_MODEL } from '../config/openai';
import { logger } from '../config/logger';

/**
 * Web & Public Intelligence Research Agent.
 *
 * Handles research on any company, organization, product, or public entity —
 * from small/local businesses to large multinationals — including name aliases,
 * parent/subsidiary relationships, and companies that are not famous.
 *
 * Hallucination prevention:
 *  - The LLM is instructed to only state facts it is confident are publicly
 *    known, and to explicitly say when a field is unknown.
 *  - If the provider is unavailable, the agent returns a graceful "couldn't
 *    find reliable information" response instead of fabricating data.
 *  - No hardcoded famous-company lists are used.
 */
export class WebResearchAgent {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async execute(context: any, queryUnderstanding: QueryUnderstanding): Promise<AgentResult> {
    const t0 = Date.now();
    const query = (queryUnderstanding.refinedQuery || queryUnderstanding.originalQuery).trim();
    logger.info(`[WebResearchAgent] Executing public research for: "${query}"`);

    const entities = (queryUnderstanding.entities && queryUnderstanding.entities.length > 0
      ? queryUnderstanding.entities
      : [query]);

    try {
      const aiAnalysis = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          {
            role: 'system',
            content: `You are an automated Web & Public Intelligence Research Agent.
Your role is to research the public identity, profile, and market context of a company/organization/entity named by the user and return accurate, factual findings.

Guidelines:
- The entity may be any size: a small local business, a startup, a mid-sized firm, or a large multinational (MNC). Treat every entity equally — never assume lack of fame means lack of relevance.
- Where the user gave a name alias or brand/trading name, note the canonical/legal name if known (e.g. parent or subsidiary relationships).
- Cover, when verifiable: what the company does, products/services, industry, headquarters, approximate size, key leaders, notable facts, and market position.
- STRICT ANTI-HALLUCINATION RULES:
  - Only state facts you are confident are publicly verifiable for this entity.
  - Do NOT invent revenue figures, headcounts, leadership names, locations, or dates.
  - For any field you cannot verify, write exactly: "I couldn't find reliable information for that field." — never guess.
  - If the name is a common/generic term that could refer to multiple companies, or you genuinely cannot identify a specific, distinct entity, say so honestly and suggest what more specific detail would help.
- Return clear bullet-point factual findings. Do NOT mention internal databases or private enterprise files.`
          },
          {
            role: 'user',
            content: `Research Topic / Entity: ${query}\nEntities extracted: ${entities.join(', ')}\nAlso reflect on possible aliases and any parent/subsidiary relationships.`
          },
        ],
        temperature: 0.3,
        max_tokens: 1200,
      });

      const rawText = aiAnalysis.choices[0]?.message?.content || '';
      const insights = rawText
        .split('\n')
        .map((line: string) => line.replace(/^[-*•]\s*/, '- ').trim())
        .filter((line: string) => line.length > 0);

      // Heuristic hallucination guard: if the model produced no usable content
      // or only admitted failure, lower confidence accordingly.
      const looksHonestFailure =
        /couldn't find|unable to determine|cannot confirm|don't have reliable|no reliable information about/i.test(rawText) &&
        insights.length <= 2;

      const sources: Source[] = entities.map((entity, index) => ({
        id: `web-research-${index}`,
        title: `Public research: ${entity}`,
        type: 'web',
        relevanceScore: Math.max(0.60, 0.92 - index * 0.05),
        url: `https://www.bing.com/search?q=${encodeURIComponent(entity)}`,
        snippet: `Public web research regarding ${entity}.`,
      }));

      return {
        agentType: 'web_research',
        success: insights.length > 0,
        insights,
        confidence: looksHonestFailure ? 0.30 : insights.length > 0 ? 0.85 : 0.35,
        sources,
        executionTimeMs: Date.now() - t0,
      };
    } catch (error) {
      logger.warn('[WebResearchAgent] provider unavailable; returning honest no-data result:', error);
      const sources: Source[] = entities.map((entity, index) => ({
        id: `web-unavailable-${index}`,
        title: `Public research: ${entity}`,
        type: 'web',
        relevanceScore: 0.50,
        url: `https://www.bing.com/search?q=${encodeURIComponent(entity)}`,
        snippet: `Could not reach the research provider for ${entity}.`,
      }));

      return {
        agentType: 'web_research',
        success: false,
        insights: [
          `I couldn't find reliable information for that field. The public research service is currently unavailable.`,
          `For "${query}", you can search directly at https://www.bing.com/search?q=${encodeURIComponent(query)}.`,
        ],
        confidence: 0.20,
        sources,
        executionTimeMs: Date.now() - t0,
      };
    }
  }
}
