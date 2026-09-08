import { AgentResult, QueryUnderstanding, Source } from '../types';
import { activeAIProvider } from '../services/aiProvider';
import { buildCompanyEvidenceFromQuery } from '../services/companyEvidenceService';
import { logger } from '../config/logger';

/**
 * Company Knowledge Agent.
 *
 * Answers questions about ANY company — from micro/local businesses and
 * startups to SMEs, enterprises, and MNCs — using the normalized, centrally
 * curated company database (a universal store, not a famous-company-only list).
 *
 * Flow:
 *   1. Resolve the queried entity against the normalized company store.
 *   2. Build compact, evidence-ranked context (source priority, confidence).
 *   3. If no local evidence exists, fall through to live public research
 *      (WebResearchAgent) rather than fabricating anything.
 *   4. Ground the LLM answer strictly on the retrieved evidence.
 *
 * Anti-hallucination: the model is instructed that if a field is not present
 * in the provided evidence it must answer "I couldn't find reliable
 * information for that field", never inventing facts.
 */
export class CompanyKnowledgeAgent {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async execute(context: any, queryUnderstanding: QueryUnderstanding): Promise<AgentResult> {
    const t0 = Date.now();
    const query = (queryUnderstanding.refinedQuery || queryUnderstanding.originalQuery).trim();
    logger.info(`[CompanyKnowledgeAgent] Resolving company evidence for: "${query}"`);

    // Honestly capture provider availability: if the AI engine is not
    // configured, we can still surface retrieved evidence, but not answer.
    const providerReady = activeAIProvider.isConfigured();

    try {
      const evidence = await buildCompanyEvidenceFromQuery(query, 3);

      // No local record: do not fabricate; defer gracefully.
      if (evidence.companies.length === 0) {
        return {
          agentType: 'company',
          success: false,
          insights: [
            `I couldn't find reliable information for that field. The entity "${query}" is not in the normalized company knowledge base.`,
          ],
          confidence: 0.1,
          sources: [],
          executionTimeMs: Date.now() - t0,
        };
      }

      const sources: Source[] = evidence.companies.flatMap((c) =>
        (c.dataSources || []).concat(c.officialSources || []).slice(0, 3).map((s, i) => ({
          id: `${String(c._id)}-${i}`,
          title: s.title || c.displayName,
          type: 'database' as const,
          relevanceScore: Math.max(0.5, (c.dataConfidence || 0.6)),
          url: s.url || c.website || undefined,
          snippet: `Verified company record: ${c.displayName}`,
        }))
      );

      if (!providerReady) {
        // Provider down: return the raw evidence as insights so the pipeline
        // still has grounded content, but low confidence.
        const insights = evidence.text.split('\n').filter((l) => l.trim().length > 0);
        return {
          agentType: 'company',
          success: true,
          insights,
          data: { resolved: evidence.resolved },
          confidence: 0.5,
          sources,
          executionTimeMs: Date.now() - t0,
        };
      }

      const system = `You are a Company Knowledge Agent grounded in a curated, normalized company database.
You answer questions about companies of all sizes (micro/local, startups, SMEs, enterprises, MNCs).

STRICT ANTI-HALLUCINATION RULES:
- Answer ONLY from the retrieved company evidence below. Do NOT use outside knowledge to fill gaps.
- If a requested field is NOT present in the evidence, write exactly: "I couldn't find reliable information for that field." Never guess, never infer revenue/headcount/leaders/dates.
- Distinguish the specific entity asked about (e.g. Google LLC vs its parent Alphabet Inc, or a brand vs its parent).
- If the evidence covers multiple related entities, note the relationship (parent/subsidiary/competitor) without inventing details.
- Keep the answer concise, factual, and clearly structured. Cite the source record name.`;

      const user =
        `Query: ${query}\n\nVerified Company Evidence:\n${evidence.text}\n\n` +
        `Entities resolved: ${evidence.resolved.join(', ') || 'none'}\n` +
        `Answer the query using ONLY the evidence above. For any missing field, state "I couldn't find reliable information for that field."`;

      let rawText = '';
      try {
        rawText = await activeAIProvider.complete(
          [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          { temperature: 0.3, maxTokens: 1500 }
        );
      } catch (err) {
        logger.warn('[CompanyKnowledgeAgent] provider unavailable; returning evidence only:', err);
        const insights = evidence.text.split('\n').filter((l) => l.trim().length > 0);
        return {
          agentType: 'company',
          success: true,
          insights,
          data: { resolved: evidence.resolved },
          confidence: 0.5,
          sources,
          executionTimeMs: Date.now() - t0,
        };
      }

      const insights = rawText.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
      const honestFailure =
        evidence.resolved.length === 0 ||
        /couldn't find|no reliable information|not in the.*knowledge base/i.test(rawText) && insights.length <= 2;

      return {
        agentType: 'company',
        success: insights.length > 0,
        insights,
        data: { resolved: evidence.resolved },
        confidence: honestFailure ? 0.2 : 0.9,
        sources,
        executionTimeMs: Date.now() - t0,
      };
    } catch (err) {
      logger.error('[CompanyKnowledgeAgent] failed:', err);
      return {
        agentType: 'company',
        success: false,
        insights: ["I couldn't find reliable information for that field."],
        confidence: 0.1,
        sources: [],
        executionTimeMs: Date.now() - t0,
      };
    }
  }
}
