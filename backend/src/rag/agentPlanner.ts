import { openai, AI_MODEL } from '../config/openai';
import { AgentType, QueryUnderstanding, SubTask } from '../types';
import { v4 as uuidv4 } from 'uuid';

const AGENT_DESCRIPTIONS: Record<AgentType, string> = {
  master: 'Orchestrates all agents and synthesizes final responses',
  rag: 'Retrieves information from documents using vector and keyword search',
  data_intelligence: 'Analyzes structured business data and databases',
  analytics: 'Performs statistical analysis, trend analysis, and generates charts',
  finance: 'Handles financial data, P&L, revenue, costs, budgets',
  sales: 'Analyzes sales data, pipeline, forecasts, rep performance',
  customer_intelligence: 'Customer behavior, churn, segmentation, CLV analysis',
  document_intelligence: 'Deep document analysis, extraction, comparison',
  data_query: 'Queries business databases and structured data in MongoDB',
  risk: 'Risk identification, assessment, and mitigation planning',
  executive: 'Synthesizes executive-level summaries and strategic insights',
  web_research: 'Researches public web information about companies, news, competitors, and internet data',
  company: 'Answers questions about any company using the normalized, curated company knowledge base (all sizes: micro/local, startups, SMEs, enterprises, MNCs)',
  knowledge_graph: 'Queries the Knowledge Graph to find relationships and connections between entities',
};

export interface AgentPlan {
  selectedAgents: AgentType[];
  subTasks: SubTask[];
  executionOrder: AgentType[][];
}

export async function planAgents(queryUnderstanding: QueryUnderstanding, searchMode?: string): Promise<AgentPlan> {
  const systemPrompt = `You are an AI orchestration system. Given a user query understanding, select the right specialized agents to answer it and create execution subtasks.

Available agents:
${Object.entries(AGENT_DESCRIPTIONS).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

Respond ONLY with valid JSON:
{
  "selectedAgents": ["agentType1", "agentType2"],
  "reasoning": "why these agents",
  "executionGroups": [["parallel_agent1", "parallel_agent2"], ["sequential_agent3"]]
}

Rules:
- SELECT ONLY 1-2 TARGETED AGENTS that directly match the query intent. Do NOT select unnecessary agents.
- For financial/revenue queries ("revenue", "sales", "Q1", "Q2"): select "finance" or "analytics".
- For risk queries ("risk", "churn", "threat"): select "risk".
- For document/policy/bylaws queries ("document", "bylaw", "agreement", "policy"): select "rag".
- For customer queries ("customer", "account", "client"): select "customer_intelligence".
- For project queries ("project", "product"): select "data_intelligence".
- For headcount/HR queries ("headcount", "employee", "staff"): select "analytics".
- For company/organization/entity research queries (any company — large or small, e.g. Google, a local bakery, "what does X do", "employees at X", competitor research): select "company" (grounded in the normalized company knowledge base) and, when the company is not in the knowledge base or fresh/live info is needed, also "web_research" (live public research; never fabricate).
- For general public web/news queries (recent news, definitions, market news): select "web_research".
- ONLY for comprehensive company overview / executive summary queries ("complete company overview", "full enterprise summary"): select "executive", "rag", "analytics", and "risk".
- executionGroups defines parallel execution batches (agents in same group run in parallel)`;

  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: JSON.stringify({
          intent: queryUnderstanding.intent,
          refinedQuery: queryUnderstanding.refinedQuery,
          entities: queryUnderstanding.entities,
          departments: queryUnderstanding.departments,
        }),
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_completion_tokens: 600,
  });

  let parsed: any = {};
  try {
    parsed = JSON.parse(response.choices[0].message.content || '{}');
  } catch {
    // Return safe fallback — default to RAG agent only
  }
  let selectedAgents: AgentType[] = (parsed.selectedAgents as AgentType[]) || ['rag'];

  // Apply search mode overrides
  if (searchMode === 'web') {
    selectedAgents = ['web_research'];
  } else if (searchMode === 'enterprise') {
    selectedAgents = selectedAgents.filter((a) => a !== 'web_research' && a !== 'rag');
    if (selectedAgents.length === 0) selectedAgents = ['analytics'];
  } else if (searchMode === 'company') {
    selectedAgents = selectedAgents.filter((a) => a !== 'rag');
    if (selectedAgents.length === 0) selectedAgents = ['company'];
  }

  const executionGroups: AgentType[][] = (parsed.executionGroups || [selectedAgents])
    .map((group: AgentType[]) => 
      group.filter((a) => selectedAgents.includes(a))
    )
    .filter((group: AgentType[]) => group.length > 0);

  const finalExecutionGroups = executionGroups.length > 0 ? executionGroups : [selectedAgents];

  const subTasks: SubTask[] = selectedAgents.map((agentType, index) => ({
    id: uuidv4(),
    description: `Execute ${agentType} agent for: ${queryUnderstanding.refinedQuery}`,
    agentType,
    priority: index + 1,
    dependencies: [],
    status: 'pending',
  }));

  return { selectedAgents, subTasks, executionOrder: finalExecutionGroups };
}
