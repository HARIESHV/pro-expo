import { openai, AI_MODEL } from '../config/openai';
import { logger } from '../config/logger';

export interface ExtractedEntities {
  entities: Array<{
    name: string;
    type: 'customer' | 'employee' | 'product' | 'project' | 'department' | 'organization' | 'region' | 'concept' | 'event' | 'metric' | 'document' | 'decision' | 'risk' | 'insight' | 'query' | 'conversation' | 'topic';
    description?: string;
  }>;
  relationships: Array<{
    from: string;
    to: string;
    type: string;
    label: string;
  }>;
}

function parseJsonFromText(text: string): any {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    // Strip common markdown fences and try again
    const fenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    try {
      return JSON.parse(fenced);
    } catch {
      // Fall back to extracting the outermost {...} block
      const start = trimmed.indexOf('{');
      const end = trimmed.lastIndexOf('}');
      if (start !== -1 && end > start) {
        try {
          return JSON.parse(trimmed.slice(start, end + 1));
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}

export async function extractEntitiesAndRelationships(
  content: string,
  documentTitle: string
): Promise<ExtractedEntities> {
  const systemPrompt = `Extract named entities and relationships from the document. 
Return ONLY valid JSON:
{
  "entities": [{"name": "string", "type": "customer|employee|product|project|department|organization|region|concept|event|metric|document|decision|risk|insight|query|conversation|topic", "description": "optional"}],
  "relationships": [{"from": "entity name", "to": "entity name", "type": "works_for|reports_to|manages|purchased|belongs_to|related_to|works_on|partners_with|owns|depends_on|mentions|references|supports|contradicts|impacts|causes|derived_from|associated_with|part_of|located_in|involves", "label": "human readable label"}]
}
Extract maximum 15 entities and 20 relationships. Focus on business-relevant entities. Use stable, canonical names so the same entity is never duplicated.`;

  const userPrompt = `Document: ${documentTitle}\n\nContent: ${content.slice(0, 3000)}`;

  // First attempt: strict JSON schema (may fail with json_validate_failed on some models)
  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 1000,
    });
    const parsed = parseJsonFromText(response.choices[0].message.content || '');
    if (parsed && (parsed.entities || parsed.relationships)) {
      return {
        entities: parsed.entities || [],
        relationships: parsed.relationships || [],
      };
    }
  } catch (error) {
    logger.warn('Entity extraction (strict JSON) failed; retrying in plain mode:', error);
  }

  // Retry without response_format so the model isn't constrained to strict JSON
  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: `${systemPrompt}\nDo NOT wrap the JSON in markdown or add any other text.`,
        },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 1000,
    });
    const parsed = parseJsonFromText(response.choices[0].message.content || '');
    return {
      entities: (parsed?.entities as ExtractedEntities['entities']) || [],
      relationships: (parsed?.relationships as ExtractedEntities['relationships']) || [],
    };
  } catch (error) {
    logger.error('Entity extraction failed:', error);
    return { entities: [], relationships: [] };
  }
}
