import { QueryUnderstanding, AgentResult, AgentType, IntelligenceResponse, SubTask } from '../types';
import { hybridRetrieval } from '../retrieval/hybridRetrieval';
import { aiDataAccessService } from '../services/aiDataAccessService';
import { unifiedKnowledgeGraphService } from '../knowledge-graph/unifiedGraphService';
import { understandQuery } from '../rag/queryUnderstanding';
import { planAgents } from '../rag/agentPlanner';
import { generateIntelligenceResponse, isNoAnswerResponse } from '../rag/responseGenerator';
import { RAGAgent } from './RAGAgent';
import { AnalyticsAgent } from './AnalyticsAgent';
import { SalesAgent } from './SalesAgent';
import { CustomerIntelligenceAgent } from './CustomerIntelligenceAgent';
import { FinanceAgent } from './FinanceAgent';
import { RiskAgent } from './RiskAgent';
import { ExecutiveAgent } from './ExecutiveAgent';
import { DataIntelligenceAgent } from './DataIntelligenceAgent';
import { WebResearchAgent } from './WebResearchAgent';
import { KnowledgeGraphAgent } from './KnowledgeGraphAgent';
import { CompanyKnowledgeAgent } from './CompanyKnowledgeAgent';
import { openai, AI_MODEL, generateGroundedFallbackAnswer } from '../config/openai';
import { logger } from '../config/logger';
import { structuredQueryService } from '../services/structuredQueryService';
import { buildCompanyEvidenceFromQuery } from '../services/companyEvidenceService';
import { v4 as uuidv4 } from 'uuid';

interface MasterAgentContext {
  organizationId: string;
  userId: string;
  conversationId: string;
  userRoles: string[];
  accessLevels: string[];
  departments?: string[];
  searchMode?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  documentIds?: string[];
}

export class MasterIntelligenceAgent {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private agentRegistry: Map<AgentType, { execute: (ctx: any, qu: QueryUnderstanding) => Promise<AgentResult> }>;

  constructor() {
    this.agentRegistry = new Map([
      ['rag', new RAGAgent()],
      ['analytics', new AnalyticsAgent()],
      ['sales', new SalesAgent()],
      ['customer_intelligence', new CustomerIntelligenceAgent()],
      ['finance', new FinanceAgent()],
      ['risk', new RiskAgent()],
      ['executive', new ExecutiveAgent()],
      ['data_intelligence', new DataIntelligenceAgent()],
      ['web_research', new WebResearchAgent()],
      ['company', new CompanyKnowledgeAgent()],
      ['knowledge_graph' as AgentType, new KnowledgeGraphAgent()],
    ]);
  }

  /**
   * Main entry point: given a raw user query, orchestrate intent detection,
   * fast general AI responses (ChatGPT-style) vs grounded Enterprise Intelligence.
   */
  async execute(rawQuery: string, context: MasterAgentContext): Promise<IntelligenceResponse> {
    const startTime = Date.now();
    const queryId = uuidv4();
    const isDocumentScoped = !!context.documentIds?.length;

    logger.info(`[MasterAgent] Processing query: "${rawQuery.slice(0, 100)}..."`);

    // Step 1: Intent Detection
    let queryUnderstanding: QueryUnderstanding = {
      originalQuery: rawQuery,
      refinedQuery: rawQuery,
      intent: 'search',
      isEnterprise: false,
      entities: [],
      timeRange: undefined,
      departments: [],
      filters: {},
    };

    if (!isDocumentScoped) {
      try {
        queryUnderstanding = await understandQuery(rawQuery, context.history || []);
      } catch (err) {
        logger.error('[MasterAgent] Query understanding failed, using fallback:', err);
      }
    }

    logger.info(
      `[MasterAgent] Intent: ${queryUnderstanding.intent}, isEnterprise: ${queryUnderstanding.isEnterprise}, Entities: ${queryUnderstanding.entities.join(', ')}`
    );

    // A document analysis request must always use the document retrieval path.
    // Otherwise a generic prompt can exit through the structured/general fast
    // paths before the uploaded document chunks are ever consulted.
    if (isDocumentScoped) {
      queryUnderstanding = {
        ...queryUnderstanding,
        isEnterprise: true,
        intent: 'knowledge_retrieval',
        refinedQuery: rawQuery,
      };
    }

    // =========================================================================
    // STRUCTURED DATA FAST-PATH
    // Deterministic DB resolver for common business questions (revenue,
    // headcount, customers, projects, risks). Runs BEFORE the LLM so a real,
    // grounded answer is always produced regardless of provider availability.
    //
    // IMPORTANT: This fast-path is deliberately gated on enterprise intent so
    // that ordinary "general knowledge / technical" questions are never hijacked
    // by the resolver. Without this gate, a normal question such as
    // "What is machine learning?" could be matched to the revenue resolver and
    // return unrelated business figures instead of a real AI answer. It runs
    // whenever the query is classified enterprise OR it mentions a documented
    // enterprise customer/entity, while general questions always proceed to the
    // conversational AI path below.
    // =========================================================================
    const looksEnterprise = !!queryUnderstanding.isEnterprise ||
      (queryUnderstanding.entities && queryUnderstanding.entities.length > 0);
    if (!isDocumentScoped && looksEnterprise) {
      try {
        const structured = await structuredQueryService.resolve(rawQuery, {
          organizationId: context.organizationId,
          history: context.history,
        });
        if (structured.matched && structured.answer && structured.answer.trim().length > 0) {
        logger.debug(`[MasterAgent Debug]
  QUERY: ${rawQuery}
  INTENT: ${structured.intent || 'n/a'}
  ENTITY: ${(structured.entities || []).join(', ') || '(none)'}
  REWRITTEN QUERY: ${rawQuery}
  EXPANDED QUERIES: (deterministic synonym expansion)
  COLLECTIONS SEARCHED: salesrecords, employees, customers, projects, risks, supporttickets, departments
  SEARCH METHODS: structuredResolver
  RESULT COUNT: structured answer (conf ${structured.confidence})
  VERIFIED EVIDENCE: yes
  ANSWER GENERATED: yes
  CONFIDENCE: ${structured.confidence.toFixed(2)}`);
        logger.info(`[MasterAgent] Answered via structured data resolver (confidence ${structured.confidence}).`);
        return {
          queryId,
          answer: structured.answer,
          summary: '',
          keyFindings: structured.keyFindings || [],
          evidence: [],
          sources: structured.sources || [],
          citations: [],
          confidence: structured.confidence,
          hasAnswer: true,
          recommendations: [],
          expectedImpact: '',
          risks: [],
          agentsUsed: ['master'],
          executionTimeMs: Date.now() - startTime,
          queryUnderstanding,
          subTasks: [],
        };
        }
      } catch (err) {
        logger.error('[MasterAgent] Structured data resolver failed:', err);
      }
    }

    // =========================================================================
    // ROUTE 1: General Questions (ChatGPT-Style Conversational AI)
    // =========================================================================
    if (!isDocumentScoped && !queryUnderstanding.isEnterprise) {
      logger.info(`[MasterAgent] General AI Question detected. Executing ChatGPT-style LLM strategy...`);

      const systemPrompt = `You are a world-class, intelligent, clear, and highly structured conversational AI assistant (like ChatGPT).
Answer the user's question directly, accurately, naturally, and with appropriate elaboration.

Structure your responses cleanly using Markdown formatting (headings, subheadings, bold text, bullet points, numbered steps, code blocks with language tags, and tables when comparing options):

1. **Direct Answer / Overview**: Start with a clear, direct answer or high-level summary.
2. **Explanation**: Provide a logical, conceptual, or architectural explanation.
3. **Key Points**: Use bullet points to highlight critical concepts, features, or components.
4. **Examples / Code / Steps**:
   - **For technical / programming questions**: Explain the problem, identify likely causes, provide complete, runnable code examples with syntax tags (e.g., \`\`\`python, \`\`\`js, \`\`\`bash), explain where to place the code, list installation commands, and detail common pitfalls.
   - **For troubleshooting / how-to questions** (e.g., connection errors): Provide step-by-step diagnostic instructions and terminal commands.
   - **For general knowledge / definitions** (e.g., "What is artificial intelligence?"): Explain how it works, main types, practical applications, pros & cons, real-world examples, and a practical illustration.
5. **Conclusion**: Provide a brief summary or recommended next steps for lengthy answers.

Guidelines:
- NEVER respond with phrases such as "I understand your request...", "How would you like me to elaborate?", or "Would you like more details?". Provide the requested answer directly.
- Match technical depth to the query (simple for beginners, deep for advanced technical questions).
- Maintain conversation history context. Understand follow-ups like "why?", "explain this", "give an example", or "what are its types?".
- Never respond with generic placeholders like "AI response goes here."
- Do NOT mention internal databases or "no enterprise document found" when answering general questions.`;

      const historyMsgs = (context.history || []).slice(-6).map((h) => ({
        role: h.role,
        content: h.content,
      }));

      let answerText = '';
      try {
        const aiResponse = await openai.chat.completions.create({
          model: AI_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            ...historyMsgs,
            { role: 'user', content: rawQuery },
          ],
          temperature: 0.7,
          max_completion_tokens: 3000,
        });

        answerText = aiResponse.choices[0]?.message?.content || '';
        if (!answerText.trim() || answerText.includes("couldn't find")) {
          answerText = await this.groundedGeneralFallback(rawQuery, context);
        }
      } catch (error) {
        logger.error('[MasterAgent] General AI LLM call failed, executing fallback:', error);
        answerText = await this.groundedGeneralFallback(rawQuery, context);
      }

      const executionTimeMs = Date.now() - startTime;

      const lower = answerText.toLowerCase();
      const isFailure = !answerText.trim() ||
        lower.includes("couldn't retrieve") ||
        lower.includes("couldn't find");

      return {
        queryId,
        answer: answerText,
        summary: '',
        keyFindings: [],
        evidence: [],
        sources: [],
        citations: [],
        confidence: isFailure ? 0 : 0.95,
        hasAnswer: !isFailure,
        recommendations: [],
        expectedImpact: '',
        risks: [],
        agentsUsed: ['master'],
        executionTimeMs,
        queryUnderstanding,
        subTasks: [],
      };
    }

    // =========================================================================
    // ROUTE 2: Enterprise Questions (Universal Search + Knowledge Graph + Hybrid RAG + Multi-Agent)
    // =========================================================================
    logger.info(`[MasterAgent] Enterprise Data Query detected. Executing Enterprise Intelligence pipeline...`);

    // Step 2: Plan which agents to use
    let agentPlan = { selectedAgents: ['rag'] as AgentType[], subTasks: [] as SubTask[], executionOrder: [['rag'] as AgentType[]] };
    try {
      agentPlan = await planAgents(queryUnderstanding, context.searchMode);
    } catch (err) {
      logger.error('[MasterAgent] Agent planning failed, defaulting to RAG:', err);
    }

    // Step 3: Concurrently fetch Universal Search + Knowledge Graph + Hybrid RAG
    let retrievedContext = '';
    try {
      const dummyUser = {
        _id: context.userId,
        organizationId: context.organizationId,
        roles: context.userRoles,
      } as any;

      const stopWordsRegex = /\b(who|what|where|how|why|is|are|the|leads|lead|many|employees|in|tell|me|about|give|an|documents|mention|do|say|about|decision|making)\b/gi;
      const cleanKeyword = rawQuery.replace(stopWordsRegex, ' ').replace(/\s+/g, ' ').trim();
      const searchKeyword = (queryUnderstanding.entities && queryUnderstanding.entities.length > 0 && queryUnderstanding.entities[0].length > 2)
        ? queryUnderstanding.entities[0]
        : (cleanKeyword || rawQuery);

      const [retrievalResult, aiDataRes, graphRes] = await Promise.allSettled([
        hybridRetrieval({
          organizationId: context.organizationId,
          query: searchKeyword,
          accessLevels: context.accessLevels as never[],
          departments: context.departments,
          topK: 12,
                  documentIds: context.documentIds,
        }),
        // Universal Search reuse: discovery + authorized dashboard data for the
        // AI. SearchService stays independent; this is the AI consuming it.
        aiDataAccessService.buildContext(dummyUser, searchKeyword),
        unifiedKnowledgeGraphService.getGraph(context.organizationId, {
          userId: context.userId,
          roles: context.userRoles,
          limit: 50,
        }),
      ]);

      let chunksText = '';
      if (retrievalResult.status === 'fulfilled') {
        chunksText = retrievalResult.value.chunks
          .map((c) => `[Document Chunk: ${c.metadata.source || 'Document'}]\n${c.content}`)
          .join('\n\n---\n\n');
      }

      let aiContextText = '';
      if (aiDataRes.status === 'fulfilled') {
        aiContextText = aiDataRes.value.text;
      }

      let graphText = '';
      if (graphRes.status === 'fulfilled' && graphRes.value.data) {
        const graphData = graphRes.value.data;
        const queryTerm = (queryUnderstanding.entities[0] || queryUnderstanding.refinedQuery).toLowerCase();
        const matchingNodes = graphData.nodes.filter(
          (n: any) => n.name.toLowerCase().includes(queryTerm) || queryTerm.includes(n.name.toLowerCase())
        );
        const nodeIds = new Set(matchingNodes.map((n: any) => n.id));
        const connectedEdges = graphData.edges.filter((e: any) => nodeIds.has(e.from) || nodeIds.has(e.to));

        if (matchingNodes.length > 0) {
          graphText = `Matching Entities in Knowledge Graph:\n` +
            matchingNodes.map((n: any) => `- ${n.name} (Type: ${n.type}, Properties: ${JSON.stringify(n.properties)})`).join('\n') +
            `\n\nRelationships:\n` +
            connectedEdges.map((e: any) => `- Node(${e.from}) --[${e.label}]--> Node(${e.to})`).join('\n');
        }
      }

      // Company knowledge evidence (universal store) — grounds answers about
      // any company/institution present in the normalized database without
      // ever dumping the whole store to the model.
      let companyEvidenceText = '';
      try {
        const companyEvidence = await buildCompanyEvidenceFromQuery(rawQuery, 3);
        if (companyEvidence.text) {
          companyEvidenceText = companyEvidence.text;
        }
      } catch (err) {
        logger.debug('[MasterAgent] Company evidence retrieval skipped:', err);
      }

      retrievedContext = [
        aiContextText ? `=== UNIVERSAL SEARCH + DASHBOARD CONTEXT ===\n${aiContextText}` : '',
        graphText ? `=== KNOWLEDGE GRAPH CONTEXT ===\n${graphText}` : '',
        companyEvidenceText ? `=== COMPANY KNOWLEDGE BASE ===\n${companyEvidenceText}` : '',
        chunksText ? `=== DOCUMENT CONTENT CHUNKS ===\n${chunksText}` : '',
      ].filter(Boolean).join('\n\n=================================\n\n');

    } catch (err) {
      logger.error('[MasterAgent] Unified context retrieval failed:', err);
    }

    // Step 4: Execute specialized agents
    const allResults: AgentResult[] = [];
    const subTasks: SubTask[] = agentPlan.subTasks;

    for (const group of agentPlan.executionOrder) {
      const groupResults = await Promise.allSettled(
        group.map(async (agentType) => {
          const agent = this.agentRegistry.get(agentType);
          if (!agent) {
            return {
              agentType,
              success: false,
              confidence: 0,
              sources: [],
              executionTimeMs: 0,
              error: `Agent ${agentType} not found`,
            } as AgentResult;
          }

          const t0 = Date.now();
          try {
            const result = await agent.execute(context, queryUnderstanding);
            result.executionTimeMs = Date.now() - t0;
            return result;
          } catch (err) {
            logger.error(`[MasterAgent] Agent ${agentType} failed:`, err);
            return {
              agentType,
              success: false,
              confidence: 0,
              sources: [],
              executionTimeMs: Date.now() - t0,
              error: (err as Error).message,
            } as AgentResult;
          }
        })
      );

      groupResults.forEach((r) => {
        if (r.status === 'fulfilled') allResults.push(r.value);
      });

      group.forEach((agentType) => {
        const task = subTasks.find((t) => t.agentType === agentType);
        if (task) {
          task.status = 'completed';
          task.result = allResults.find((r) => r.agentType === agentType);
        }
      });
    }

    // Automated Web Research Check:
    // If internal enterprise retrieval returned weak/empty context OR the query
    // is about an external public entity (any company/organization — large or
    // small — or general public/news topic), trigger WebResearchAgent to perform
    // live web research. This makes company research work for companies of all
    // sizes (local SMBs through to global MNCs) instead of only a hardcoded list.
    const nonEnterprise = !queryUnderstanding.isEnterprise;
    const isPublicQuery = nonEnterprise ||
      /company|organization|corporation|inc\b|ltd\b|llc\b|startup|firm|business|competitor|market|who (is|are)|what (does|is) /.test(rawQuery.toLowerCase());
    const isContextWeak = !retrievedContext.trim() || retrievedContext.length < 50;

    if (!isDocumentScoped && (isContextWeak || isPublicQuery) && !allResults.some((r) => r.agentType === 'web_research')) {
      logger.info(`[MasterAgent] Enterprise context weak or public entity detected. Triggering WebResearchAgent fallback...`);
      const webAgent = this.agentRegistry.get('web_research');
      if (webAgent) {
        try {
          const webRes = await webAgent.execute(context, queryUnderstanding);
          if (webRes.success) {
            allResults.push(webRes);
            if (!agentPlan.selectedAgents.includes('web_research')) {
              agentPlan.selectedAgents.push('web_research');
            }
          }
        } catch (webErr) {
          logger.error('[MasterAgent] Web fallback failed:', webErr);
        }
      }
    }

    const validResults = allResults.filter((r) => r.success && r.confidence > 0.3);

    // Step 5: Generate final enterprise response (passing context.history for conversation memory)
    const partialResponse = await generateIntelligenceResponse(
      queryUnderstanding,
      validResults,
      retrievedContext,
      context.history || []
    );

    const executionTimeMs = Date.now() - startTime;

    // Never surface an internal RAG/retrieval failure string as the answer.
    let answer = partialResponse.answer || '';
    if (isNoAnswerResponse(answer)) {
      answer = '';
    }

    // A real answer exists when we have grounding (retrieved context or valid
    // agent results), regardless of whether the LLM succeeded.
    const hasGrounding = (validResults.length > 0 && validResults.some((r) => r.confidence > 0.4)) ||
      retrievedContext.trim().length > 100 ||
      (partialResponse.keyFindings && partialResponse.keyFindings.length > 0);

    const hasAnswer = partialResponse.hasAnswer === false ? false : hasGrounding;

    // Confidence must reflect an actual answer; if there is genuine grounding
    // but the LLM returned nothing, keep the partial generator's confidence.
    let dynamicConfidence = partialResponse.confidence !== undefined ? partialResponse.confidence : 0;
    if (hasAnswer) {
      if (retrievedContext.length > 300 || validResults.length > 0) {
        dynamicConfidence = Math.min(0.96, Math.max(0.6, (dynamicConfidence || 0.85) + validResults.length * 0.02));
      }
    } else {
      dynamicConfidence = 0;
      if (!answer.trim()) {
        // Genuinely no data found: use a short, honest response. Never an
        // internal retrieval placeholder; never list capabilities or ask the
        // user to rephrase or try again.
        answer = `I don't have enough verified enterprise data to answer that accurately.`;
      }
    }

    logger.debug(`[MasterAgent Debug]
  QUERY: ${rawQuery}
  INTENT: ${queryUnderstanding.intent}
  ENTITY: ${queryUnderstanding.entities.join(', ') || '(none)'}
  REWRITTEN QUERY: ${(queryUnderstanding.refinedQuery || rawQuery).slice(0, 200)}
  EXPANDED QUERIES: ${(queryUnderstanding.expansions || []).join(' | ').slice(0, 400) || '(none)'}
  COLLECTIONS SEARCHED: salesrecords, employees, customers, projects, risks, supporttickets, departments + hybridRetrieval/universalSearch/knowledgeGraph
  SEARCH METHODS: structuredResolver, hybridRetrieval, universalSearch, knowledgeGraph, webFallback
  RESULT COUNT: ${validResults.length} agent result(s), ${retrievedContext.length} context chars
  TOP RESULTS: ${validResults.map((r) => `[${r.agentType}] conf ${r.confidence}`).join(', ') || 'none'}
  VERIFIED EVIDENCE: ${hasGrounding ? 'yes' : 'no'}
  ANSWER GENERATED: ${hasAnswer ? 'yes' : 'no'}
  CONFIDENCE: ${hasAnswer ? dynamicConfidence.toFixed(2) : 'null'}`);

    const finalResponse: IntelligenceResponse = {
      queryId,
      answer,
      summary: '',
      keyFindings: hasAnswer ? (partialResponse.keyFindings || []) : [],
      evidence: partialResponse.evidence || [],
      sources: partialResponse.sources || [],
      citations: partialResponse.citations || [],
      confidence: hasAnswer ? dynamicConfidence : 0,
      hasAnswer,
      recommendations: partialResponse.recommendations || [],
      expectedImpact: partialResponse.expectedImpact || '',
      risks: partialResponse.risks || [],
      agentsUsed: agentPlan.selectedAgents,
      executionTimeMs,
      queryUnderstanding,
      subTasks,
    };

    logger.info(`[MasterAgent] Enterprise query completed in ${executionTimeMs}ms, hasAnswer: ${finalResponse.hasAnswer}, confidence: ${finalResponse.confidence}`);
    return finalResponse;
  }

  /**
   * Last-resort answer for the general path. Re-consults the deterministic
   * enterprise resolver first so that an enterprise phrasing which slipped past
   * intent classification still gets a real grounded answer instead of a generic
   * "I don't have enough data" message. Falls back to the hardcoded general
   * answer generator only when no structured data can answer.
   */
  private async groundedGeneralFallback(rawQuery: string, context: MasterAgentContext): Promise<string> {
    try {
      const structured = await structuredQueryService.resolve(rawQuery, {
        organizationId: context.organizationId,
        history: context.history,
      });
      if (structured.matched && structured.answer && structured.answer.trim().length > 0) {
        logger.debug(`[MasterAgent] General-path fallback answered via structured resolver (conf ${structured.confidence}).`);
        return structured.answer;
      }
    } catch (err) {
      logger.error('[MasterAgent] Structured resolver fallback failed:', err);
    }
    return generateGroundedFallbackAnswer(rawQuery);
  }
}
