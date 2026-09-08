import { env } from '../config/env';

// ---------------------------------------------------------------------------
// AI Provider abstraction.
//
// Every provider receives the same normalized input (messages + optional
// JSON mode) and returns a normalized text response. This decouples the
// retrieval/evidence layer from any single vendor, so the same company
// evidence can be answered by OpenAI, Google Gemini, Anthropic Claude, or
// the currently-configured default (Groq) without maintaining per-provider
// company databases.
//
// The active provider is chosen by a single env flag (default: groq, the only
// key guaranteed present). OpenAI/Gemini/Claude adapters are provided for when
// their keys are set.
// ---------------------------------------------------------------------------

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIProvider {
  readonly id: string;
  /** Complete a chat conversation. Returns the assistant text (or JSON string). */
  complete(messages: AIChatMessage[], opts?: { json?: boolean; temperature?: number; maxTokens?: number }): Promise<string>;
  /** Whether this provider actually has credentials configured. */
  isConfigured(): boolean;
}

// ---- Groq adapter (current production default) ---------------------------
import { openai, AI_MODEL } from '../config/openai';

class GroqProvider implements AIProvider {
  readonly id = 'groq';
  complete(messages: AIChatMessage[], opts: { json?: boolean; temperature?: number; maxTokens?: number } = {}) {
    return openai.chat.completions.create({
      model: AI_MODEL,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: opts.temperature ?? 0.3,
      max_completion_tokens: opts.maxTokens ?? 2000,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    }).then((res: any) => String(res.choices?.[0]?.message?.content || ''));
  }
  isConfigured() {
    return Boolean(env.GROQ_API_KEY);
  }
}

// ---- OpenAI adapter -------------------------------------------------------
class OpenAIProvider implements AIProvider {
  readonly id = 'openai';
  async complete(messages: AIChatMessage[], opts: { json?: boolean; temperature?: number; maxTokens?: number } = {}) {
    const key = env.OPENAI_API_KEY;
    if (!key) return "I couldn't find reliable information for that field.";
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || 'gpt-4o',
        messages,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 2000,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    const data: any = await res.json();
    return String(data?.choices?.[0]?.message?.content || '');
  }
  isConfigured() {
    return Boolean(env.OPENAI_API_KEY);
  }
}

// ---- Google Gemini adapter ------------------------------------------------
class GeminiProvider implements AIProvider {
  readonly id = 'gemini';
  async complete(messages: AIChatMessage[], opts: { json?: boolean; temperature?: number; maxTokens?: number } = {}) {
    const key = env.GEMINI_API_KEY;
    if (!key) return "I couldn't find reliable information for that field.";
    // Recent Gemini REST API expects a single contents list with role parts.
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    const system = messages.find((m) => m.role === 'system');
    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: opts.temperature ?? 0.3,
        maxOutputTokens: opts.maxTokens ?? 2000,
        ...(opts.json ? { responseMimeType: 'application/json' } : {}),
      },
    };
    if (system) body.systemInstruction = { parts: [{ text: system.content }] };
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL || 'gemini-1.5-flash'}:generateContent?key=${key}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    const data: any = await res.json();
    return String(data?.candidates?.[0]?.content?.parts?.[0]?.text || '');
  }
  isConfigured() {
    return Boolean(env.GEMINI_API_KEY);
  }
}

// ---- Anthropic Claude adapter ---------------------------------------------
class ClaudeProvider implements AIProvider {
  readonly id = 'claude';
  async complete(messages: AIChatMessage[], opts: { json?: boolean; temperature?: number; maxTokens?: number } = {}) {
    const key = env.ANTHROPIC_API_KEY;
    if (!key) return "I couldn't find reliable information for that field.";
    const system = messages.filter((m) => m.role === 'system').map((s) => s.content).join('\n');
    const nonSystem = messages.filter((m) => m.role !== 'system');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
        system: system || undefined,
        messages: nonSystem.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: opts.maxTokens ?? 2000,
        ...(opts.json ? {} : {}),
      }),
    });
    const data: any = await res.json();
    return String((data?.content || []).map((b: any) => b.text || '').join(''));
  }
  isConfigured() {
    return Boolean(env.ANTHROPIC_API_KEY);
  }
}

const providers: Record<string, AIProvider> = {
  groq: new GroqProvider(),
  openai: new OpenAIProvider(),
  gemini: new GeminiProvider(),
  claude: new ClaudeProvider(),
};

/** Select the active provider: explicit env override, else the first
 *  configured provider, else Groq. */
export function getActiveProvider(): AIProvider {
  const want = env.AI_PROVIDER?.toLowerCase();
  if (want && providers[want]) return providers[want];
  for (const p of Object.values(providers)) {
    if (p.isConfigured()) return p;
  }
  return providers.groq;
}

export const activeAIProvider = getActiveProvider();
