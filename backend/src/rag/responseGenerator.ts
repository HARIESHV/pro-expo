import { openai, AI_MODEL, generateGroundedFallbackAnswer } from '../config/openai';
import { IntelligenceResponse, AgentResult, QueryUnderstanding, Source, Citation, Evidence } from '../types';
import { logger } from '../config/logger';

// Never surface an internal RAG failure message as a user-facing answer.
// The absence of a matching record must NOT be the answer when relevant data
// may simply not have been found yet — fall through to a grounded response.
export function isNoAnswerResponse(answer?: string): boolean {
  if (!answer) return true;
  const a = answer.toLowerCase();
  const patterns = [
    "couldn't retrieve",
    "couldn't find",
    'no matching record',
    'no relevant information',
    'information is unavailable',
    'search results appear empty',
    'unable to find any relevant',
    'could not find',
    'i couldn',
    'searched sources',
    'key findings 0',
  ];
  return patterns.some((p) => a.includes(p));
}

/**
 * Build grounded evidence text from agent results + retrieved context so the
 * LLM (or a deterministic fallback) can answer from real data.
 */
function assembleGroundedAnswer(query: string, agentResults: AgentResult[], retrievedContext: string): string {
  const lines: string[] = [];
  for (const r of agentResults) {
    if (r.insights && r.insights.length) {
      lines.push(...r.insights.map((i) => i.trim()).filter(Boolean));
    }
    const data = r.data as Record<string, unknown> | undefined;
    if (data && typeof data === 'object') {
      try {
        const str = JSON.stringify(data);
        if (str && str.length < 500) lines.push(str);
      } catch {
        // ignore
      }
    }
  }
  if (retrievedContext.trim()) {
    lines.push(retrievedContext.trim().slice(0, 2000));
  }
  const body = lines.join('\n').trim();
  if (!body) {
    return NO_DATA_RESPONSE;
  }
  return `Based on the available enterprise records, here is the relevant information for "${query}":\n\n${body}`;
}

/** Honest, graceful "no data" response — never an internal retrieval failure,
 * and never asks the user to rephrase, list capabilities, or "try again". This
 * is only used when genuinely no relevant enterprise evidence exists. */
const NO_DATA_RESPONSE =
  `I don't have enough verified enterprise data to answer that accurately.`;

export function isNoDataResponse(text?: string): boolean {
  return !!text && text.trim().startsWith("I don't have enough verified enterprise data");
}

export async function generateIntelligenceResponse(
  queryUnderstanding: QueryUnderstanding,
  agentResults: AgentResult[],
  retrievedContext: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<Partial<IntelligenceResponse>> {
  const systemPrompt = `You are an Enterprise Intelligence AI assistant equipped with Hybrid RAG & Web Research capabilities.

Your primary responsibility is to answer the user's question directly, accurately, and naturally using the retrieved evidence from internal enterprise sources and public web research that is provided in the user message.

CORE GUIDELINES & RESPONSE STRUCTURE:
1. DIRECT NATURAL ANSWER:
   - Provide a direct, natural, conversational answer to the user's question.
   - Do NOT wrap your answer in internal system headers like "Answer:", "Evidence:", "Source:", "Confidence:", "Searched Sources:", "Key findings:", or "Suggestions:". Answer the question directly in standard markdown prose.
   - For numerical or financial questions, perform any necessary calculation (e.g., sum of Q1 and Q2 revenue) and clearly explain the calculation steps in plain language.
   - For technical, general knowledge, or conversational questions, provide a clear, helpful, direct response.

2. GROUNDED IN RETRIEVED EVIDENCE:
   - Base findings strictly on the retrieved internal enterprise evidence or public web research provided in the user message.
   - Never invent enterprise names, revenue, sales, headcount, dates, or financial facts.
   - If the retrieved evidence contains the figure the user asked about, answer with it directly.

3. NUMERICAL CALCULATIONS & UNCERTAINTY:
   - For revenue, sales, profit, headcount, expenses, calculate totals, differences, or percentages when requested and state the verified numbers from the evidence.
   - Never manufacture numbers not present in the evidence.

4. ANSWER WITH RELATED / CALCULATED DATA:
   - If the exact figure is not stored but can be derived from related verified records, calculate it (e.g., sum Q1 + Q2 revenue) and present it.
   - Use semantic interpretation of the question (e.g., "money made" = revenue, "people working there" = headcount). Map natural language to the equivalent metric in the retrieved evidence.
   - Use conversation context to resolve pronouns (e.g., "they" = a previously mentioned company) before answering.
   - Do NOT respond with generic retrieval-failure placeholders. Do NOT ask the user to rephrase a question that can reasonably be understood. Do NOT list what the assistant "can help with" instead of answering.
   - Only if no information is relevant at all, give a short, honest response such as "I don't have enough verified enterprise data to answer that accurately."

Respond ONLY with valid JSON:
{
  "answer": "Direct natural response text",
  "summary": "",
  "keyFindings": ["finding1", "finding2"],
  "evidence": [{"key": "metric", "value": "value", "source": {"id": "id", "title": "title", "type": "document|database|knowledge_graph|web", "relevanceScore": 0.9}, "confidence": 0.9}],
  "sources": [{"id": "id", "title": "title", "type": "document|database|knowledge_graph|web", "relevanceScore": 0.9, "url": "optional_url"}],
  "citations": [{"sourceId": "id", "title": "title", "excerpt": "relevant text", "relevanceScore": 0.9}],
  "confidence": 0.85,
  "recommendations": [],
  "expectedImpact": "",
  "risks": []
}`;

  const historyMsgs = history.slice(-6).map((h) => ({
    role: h.role,
    content: h.content,
  }));

  const userMessage = `
Query: ${queryUnderstanding.originalQuery}
Refined Query: ${queryUnderstanding.refinedQuery}
Intent: ${queryUnderstanding.intent}
Entities: ${queryUnderstanding.entities.join(', ')}

Agent Findings:
${agentResults.map((r) => `[${r.agentType.toUpperCase()}] (confidence: ${r.confidence}): ${JSON.stringify(r.insights || r.data)}`).join('\n')}

Retrieved Context:
${retrievedContext.slice(0, 12000)}
`;

  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...historyMsgs,
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_completion_tokens: 4000,
    });

    let parsed: any = {};
    try {
      parsed = JSON.parse(response.choices[0].message.content || '{}');
    } catch {
      logger.error('Response generation: failed to parse JSON from AI response');
    }

    // Collect all sources from specialized agents
    const aggregatedSources: Source[] = [];
    agentResults.forEach((r) => {
      if (r.sources && Array.isArray(r.sources)) {
        aggregatedSources.push(...r.sources);
      }
    });

    const parsedSources = parsed.sources && Array.isArray(parsed.sources) ? parsed.sources : [];
    const mergedSources = [...parsedSources, ...aggregatedSources];
    // Deduplicate sources by id or title
    const uniqueSourcesMap = new Map<string, Source>();
    mergedSources.forEach((s) => {
      const key = s.id || s.title;
      if (!uniqueSourcesMap.has(key)) {
        uniqueSourcesMap.set(key, s);
      }
    });
    const finalSources = Array.from(uniqueSourcesMap.values());

    let answer = parsed.answer;
    let hasAnswer: boolean;
    let calculatedConfidence = parsed.confidence;

    // If the LLM produced no usable answer, or it accidentally emitted a
    // retrieval-failure placeholder, generate a grounded answer from the
    // evidence we passed into the prompt.
    if (isNoAnswerResponse(answer)) {
      const grounded = assembleGroundedAnswer(queryUnderstanding.originalQuery, agentResults, retrievedContext);
      answer = grounded;
      hasAnswer = !isNoDataResponse(grounded);
      calculatedConfidence = hasAnswer ? 0.82 : 0.3;
    } else {
      hasAnswer = true;
      if (typeof calculatedConfidence !== 'number' || calculatedConfidence === 0) {
        if (agentResults.length > 0) {
          const topConfidence = Math.max(...agentResults.map((r) => r.confidence || 0));
          calculatedConfidence = topConfidence > 0 ? topConfidence : 0.88;
        } else if (retrievedContext.trim().length > 100) {
          calculatedConfidence = 0.90;
        } else {
          calculatedConfidence = 0.85;
        }
      }
    }

    return {
      answer: answer || '',
      summary: '',
      keyFindings: hasAnswer ? (parsed.keyFindings || []) : [],
      evidence: (parsed.evidence || []) as Evidence[],
      sources: finalSources,
      citations: (parsed.citations || []) as Citation[],
      confidence: hasAnswer ? calculatedConfidence : 0,
      hasAnswer,
      recommendations: parsed.recommendations || [],
      expectedImpact: parsed.expectedImpact || '',
      risks: parsed.risks || [],
    };
  } catch (error) {
    logger.error('Response generation failed:', error);

    // LLM/provider failure: still produce a grounded answer from the real
    // evidence so the user is never shown an internal retrieval error.
    const webAgent = agentResults.find((r) => r.agentType === 'web_research');
    let fallbackAnswer = '';
    let confidence = 0.30;

    if (webAgent && webAgent.success && webAgent.insights && webAgent.insights.length > 0) {
      fallbackAnswer = webAgent.insights.join('\n\n');
      confidence = webAgent.confidence || 0.80;
    } else if (!queryUnderstanding.isEnterprise) {
      fallbackAnswer = generateGroundedFallbackAnswer(queryUnderstanding.originalQuery);
      confidence = 0.90;
    } else {
      fallbackAnswer = assembleGroundedAnswer(queryUnderstanding.originalQuery, agentResults, retrievedContext);
      const noData = isNoDataResponse(fallbackAnswer);
      confidence = noData ? 0.3 : 0.82;
    }

    const fallbackSources: Source[] = [];
    agentResults.forEach((r) => {
      if (r.sources) fallbackSources.push(...r.sources);
    });

    return {
      answer: fallbackAnswer,
      summary: '',
      keyFindings: [],
      evidence: [],
      sources: fallbackSources,
      citations: [],
      confidence,
      hasAnswer: confidence >= 0.5,
      recommendations: [],
      expectedImpact: '',
      risks: [],
    };
  }
}
