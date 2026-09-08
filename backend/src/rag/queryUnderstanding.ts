import { openai, AI_MODEL } from '../config/openai';
import { QueryUnderstanding, IntentType } from '../types';

export const ENTITY_ALIAS_MAP: Record<string, { fullName: string; expansions: string[] }> = {
  abc: { fullName: 'ABC Technologies Pvt Ltd', expansions: ['ABC', 'ABC Technologies', 'ABC Technologies Pvt Ltd'] },
  'abc tech': { fullName: 'ABC Technologies Pvt Ltd', expansions: ['ABC', 'ABC Technologies', 'ABC Technologies Pvt Ltd'] },
  stark: { fullName: 'Stark Industries', expansions: ['Stark', 'Stark Industries', 'Stark Industries Account'] },
  'product x': { fullName: 'Product X Engine', expansions: ['Product X', 'PROJ-X', 'Product X Engine'] },
  'proj-x': { fullName: 'Product X Engine', expansions: ['Product X', 'PROJ-X', 'Product X Engine'] },
  charles: { fullName: 'Dr. Charles Stark', expansions: ['Charles', 'Dr. Charles', 'Dr. Charles Stark'] },
  'dr. charles': { fullName: 'Dr. Charles Stark', expansions: ['Charles', 'Dr. Charles', 'Dr. Charles Stark'] },
};

export const DOMAIN_SYNONYMS: Record<string, string[]> = {
  revenue: ['income', 'sales', 'turnover', 'earnings', 'total revenue', 'financial performance'],
  income: ['revenue', 'sales', 'turnover', 'earnings', 'financial performance'],
  sales: ['revenue', 'income', 'turnover', 'earnings', 'transactions'],
  employees: ['staff', 'workforce', 'headcount', 'personnel', 'team members'],
  headcount: ['employees', 'staff', 'workforce', 'personnel'],
  staff: ['employees', 'headcount', 'workforce', 'personnel'],
  customer: ['client', 'account', 'buyer'],
  client: ['customer', 'account', 'buyer'],
  account: ['customer', 'client'],
  project: ['initiative', 'product', 'module', 'engine'],
};

/**
 * Fast heuristic detection to distinguish enterprise data questions from general AI questions.
 */
export function isEnterpriseQueryHeuristic(query: string): boolean {
  const q = query.toLowerCase().trim();

  // Math expressions, arithmetic, equations
  const mathPattern = /\b(\d+\s*[+\-*/x×÷]\s*\d+|\d+%\s*of\s*\d+|calculate|solve|equation|square root|factorial)\b/i;
  if (mathPattern.test(q)) return false;

  // Technical, software, programming, database, and system design terms
  const techTerms = [
    'python', 'javascript', 'typescript', 'react', 'java', 'c++', 'c#', 'rust', 'golang', 'php',
    'html', 'css', 'sql', 'mongodb', 'nosql', 'postgres', 'postgresql', 'redis', 'docker', 'kubernetes',
    'aws', 'azure', 'gcp', 'git', 'github', 'node', 'express', 'django', 'fastapi', 'spring',
    'graphql', 'rest api', 'microservices', 'write a program', 'write a function', 'write a script',
    'code snippet', 'reverse a string', 'binary search', 'recursion', 'sorting algorithm',
    'advantages of', 'benefits of', 'how to use', 'what is', 'explain'
  ];
  const isPureGeneralTech = techTerms.some((term) => q.includes(term)) &&
    !['our revenue', 'our team', 'our company', 'stark', 'proj-x', 'bylaw', 'abc'].some((e) => q.includes(e));
  if (isPureGeneralTech) return false;

  // General definitions, world knowledge, creative writing, general productivity
  const generalKnowledgeTerms = [
    'artificial intelligence', 'machine learning', 'deep learning', 'cloud computing', 'quantum',
    'capital of', 'ideas for employee productivity', 'how to improve productivity',
    'write an email', 'write a poem', 'summarize this', 'rewrite this', 'give me ideas'
  ];
  if (generalKnowledgeTerms.some((term) => q.includes(term))) return false;

  // Casual greetings (match as whole-ish phrases so words containing "hi"
  // like "which", "chips", or "this" don't wrongly trigger a greeting).
  const casualGreetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'how are you', 'who are you', 'thanks', 'thank you'];
  if (casualGreetings.some((g) => new RegExp(`\\b${g.replace(/ /g, '\\s+')}\\b`, 'i').test(q))) return false;

  // Strong explicit enterprise triggers (only when referring to private internal organizational data)
  const enterpriseTerms = [
    'our revenue', 'our sales', 'our q1', 'our q2', 'our q3', 'our q4', 'stark industries', 'product x engine',
    'our department', 'employee policy', 'our risks', 'ticket tkt', 'customer account', 'our project',
    'our budget', 'our document', 'internal report', 'our team', 'our headcount', 'company bylaws', 'operating agreement',
    'company\'s q1', 'company\'s q2', 'company\'s q3', 'company\'s q4', 'company revenue', 'our company',
    'revenue of abc', 'abc technologies', 'abc revenue', 'abc', 'how much did the company make', 'how much money did the company make',
    'money did the company make', 'how many people work there', 'show total income', 'what were the sales', 'give me the revenue figure',
    // Additional enterprise data phrasings (synonyms / natural references).
    // These reference the company's own records, not the general topic.
    'total revenue', 'the total revenue', 'what is the revenue', 'the company make', 'make money',
    'how much money', 'financial performance', 'business performance', 'company performance',
    'financials', 'q1 revenue', 'q2 revenue', 'q3 revenue', 'q4 revenue', 'compare q1',
    'perform better', 'performed better', 'which quarter', 'compare q2', 'quarterly revenue',
    'annual revenue', 'last quarter', 'this quarter', 'did the company make', 'did they make',
    'did they earn', 'did the company earn', 'money did the company', 'money did they',
    'what did the company make', 'how did the business', 'how did the company', 'how were sales',
    'how did sales', 'how are sales', 'how many people', 'how many employees', 'people work',
    'people working there', 'employee count', 'headcount', 'how big is the team',
    'who are the customers', 'customer accounts', 'who are our', 'who are their', 'their customers',
    'their clients', 'customer base', 'who are our customers',
    'our projects', 'active projects', 'what are they working on', 'what are you working on',
    'are working on', 'working on', 'what is the company working',
    'our risks', 'active risks', 'open support', 'support tickets', 'open tickets',
    'company overview', 'tell me about the company', 'tell me about this enterprise',
    'about this enterprise', 'overview of the company', 'what are their',
  ];
  if (enterpriseTerms.some((term) => q.includes(term))) return true;

  // Default to false for general questions
  return false;
}

export async function understandQuery(
  rawQuery: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<QueryUnderstanding> {
  const heuristicEnterprise = isEnterpriseQueryHeuristic(rawQuery);

  const historyContext = history.slice(-4).map(h => `${h.role.toUpperCase()}: ${h.content.slice(0, 300)}`).join('\n');

  const systemPrompt = `You are an AI Intent Classifier and Query Parsing Agent for an Enterprise Intelligence Platform.
Analyze the user query along with any previous conversation context to determine the user's intent, entities, refined query, and query expansions.

IMPORTANT INSTRUCTIONS:
1. "isEnterprise": boolean.
   - Set to TRUE ONLY if the query specifically asks about internal company records, private organizational metrics, company financial numbers ("our revenue", "our Q2 revenue", "our headcount", "our bylaws"), or internal uploaded documents/files ("Stark Industries account", "PROJ-X budget", "our contracts").
   - Set to FALSE for general knowledge ("What is AI?"), technical/software questions ("What is Python?", "What are the benefits of MongoDB?", "How does Docker work?"), coding ("Python string reverse"), math ("25 * 40"), or casual greetings.
2. "intent": string. Must be one of the following exact intent classifications:
   - GENERAL_INFORMATION (general QA, definitions, concepts)
   - TECHNICAL_QUESTION (software, programming, databases, technology, architecture)
   - CASUAL_CONVERSATION (greetings, casual chat)
   - COMPANY_OVERVIEW (broad corporate summaries)
   - FINANCIAL_ANALYSIS (revenue figures, financial reports, money)
   - PROJECT_ANALYSIS (projects, milestones, PROJ-X, engineering)
   - CUSTOMER_ANALYSIS (client accounts, Stark Industries, customer churn)
   - RISK_ANALYSIS (operational risks, customer churn, threats, tickets)
   - EMPLOYEE_ANALYSIS (headcount, staffing, R&D headcount, HR)
   - DOCUMENT_ANALYSIS (searching docs, agreements, policies)
   - GOVERNANCE (legal agreements, corporate bylaws, governance rules)
   - EXECUTIVE_SUMMARY (executive level overviews)
   - COMPARISON (comparing Q1 vs Q2, performance variance)
   - UNSUPPORTED_PRIVATE_DATA (request for private internal data not in database)
3. "refinedQuery": string. 
   - If the user query is a follow-up with pronouns or implicit references (e.g., "Why did it decrease?", "What are its benefits?", "Who is its CEO?"), resolve the pronouns using the recent conversation context (e.g., "What are the benefits of MongoDB?").
   - For short queries like "Oracle analysis" or "Bylaws", expand into an explicit search query.
4. "entities": string[] (e.g. ["MongoDB"], ["Python"], ["Stark Industries"], ["Q1 Revenue"], ["Bylaws"]).
5. "expansions": string[] (2-4 alternative search queries/synonyms).

Recent Conversation Context:
${historyContext || 'None'}

Respond ONLY with valid JSON:
{
  "isEnterprise": boolean,
  "intent": "string",
  "refinedQuery": "string",
  "entities": ["string"],
  "expansions": ["string"]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: rawQuery },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_completion_tokens: 400,
    });

    let parsed: any = {};
    try {
      parsed = JSON.parse(response.choices[0].message.content || '{}');
    } catch {
      // ignore
    }

    // Trust enterprise intent if EITHER the LLM classifier OR the conservative
    // keyword heuristic flags it. The LLM tends to mark general phrasing like
    // "What is the total revenue?" as non-enterprise (because it lacks "our"),
    // which would misroute genuine data questions to the general path. Routing
    // on the union guarantees real enterprise questions reach the grounded
    // pipeline instead of the general LLM fallback.
    const llmEnterprise = typeof parsed.isEnterprise === 'boolean' ? parsed.isEnterprise : heuristicEnterprise;
    const isEnterprise = llmEnterprise || heuristicEnterprise;

    // If we ended up enterprise, coerce a general intent into the generic
    // enterprise search intent so the grounded pipeline runs.
    if (isEnterprise && (!parsed.intent || parsed.intent === 'GENERAL_INFORMATION' || parsed.intent === 'TECHNICAL_QUESTION')) {
      parsed.intent = 'search';
    }

    // Detect alias matches in raw query to enrich entities and expansions
    const qLower = rawQuery.toLowerCase();
    const matchedAliases: string[] = [];
    const matchedExpansions: string[] = [];

    Object.entries(ENTITY_ALIAS_MAP).forEach(([key, val]) => {
      if (qLower.includes(key)) {
        matchedAliases.push(val.fullName);
        matchedExpansions.push(...val.expansions);
      }
    });

    // Detect domain synonyms in raw query to enrich expansions
    const synonymExpansions: string[] = [];
    Object.entries(DOMAIN_SYNONYMS).forEach(([term, syns]) => {
      if (qLower.includes(term)) {
        syns.forEach((syn) => {
          synonymExpansions.push(rawQuery.replace(new RegExp(term, 'gi'), syn));
        });
      }
    });

    const combinedEntities = Array.from(new Set([...(parsed.entities || []), ...matchedAliases]));
    const rawExpansions = parsed.expansions && Array.isArray(parsed.expansions) ? parsed.expansions : [rawQuery];
    const combinedExpansions = Array.from(new Set([...rawExpansions, ...matchedExpansions, ...synonymExpansions]));

    return {
      originalQuery: rawQuery,
      refinedQuery: parsed.refinedQuery || rawQuery,
      intent: (parsed.intent as IntentType) || (isEnterprise ? 'search' : 'knowledge_retrieval'),
      category: isEnterprise ? 'enterprise' : 'general',
      isEnterprise,
      entities: combinedEntities,
      expansions: combinedExpansions.length > 0 ? combinedExpansions : [rawQuery],
      timeRange: parsed.timeRange,
      departments: parsed.departments || [],
      filters: parsed.filters || {},
    };
  } catch {
    const qLower = rawQuery.toLowerCase();
    const matchedAliases: string[] = [];
    const matchedExpansions: string[] = [];

    Object.entries(ENTITY_ALIAS_MAP).forEach(([key, val]) => {
      if (qLower.includes(key)) {
        matchedAliases.push(val.fullName);
        matchedExpansions.push(...val.expansions);
      }
    });

    return {
      originalQuery: rawQuery,
      refinedQuery: rawQuery,
      intent: heuristicEnterprise ? 'search' : 'knowledge_retrieval',
      category: heuristicEnterprise ? 'enterprise' : 'general',
      isEnterprise: heuristicEnterprise,
      entities: matchedAliases,
      expansions: matchedExpansions.length > 0 ? matchedExpansions : [rawQuery],
    };
  }
}
