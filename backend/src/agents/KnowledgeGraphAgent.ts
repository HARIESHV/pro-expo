import { AgentResult, QueryUnderstanding, Source } from '../types';
import { knowledgeGraphService } from '../knowledge-graph/graphService';
import { openai, AI_MODEL } from '../config/openai';
import { logger } from '../config/logger';

export class KnowledgeGraphAgent {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async execute(context: any, queryUnderstanding: QueryUnderstanding): Promise<AgentResult> {
    const t0 = Date.now();
    try {
      logger.info(`[KnowledgeGraphAgent] Executing graph query for entities: ${queryUnderstanding.entities.join(', ')}`);
      
      // 1. Fetch graph matching the organization
      const graph = await knowledgeGraphService.getGraph(context.organizationId, undefined, 100);

      // 2. Filter nodes and relationships that are semantically related to query entities
      const queryEntitiesLower = queryUnderstanding.entities.map((e) => e.toLowerCase().trim());
      
      const matchingNodes = graph.nodes.filter((node) =>
        queryEntitiesLower.some(
          (qe) =>
            node.name.toLowerCase().includes(qe) ||
            node.type.toLowerCase().includes(qe) ||
            (node.properties && JSON.stringify(node.properties).toLowerCase().includes(qe))
        )
      );

      const matchingNodeIds = new Set(matchingNodes.map((n) => n.id));
      
      // Find edges connected to any of the matching nodes
      const matchingEdges = graph.edges.filter(
        (edge) => matchingNodeIds.has(edge.from) || matchingNodeIds.has(edge.to)
      );

      // Ensure nodes at both ends of matching edges are included in matchingNodes
      const extendedNodeIds = new Set([
        ...matchingNodeIds,
        ...matchingEdges.flatMap((e) => [e.from, e.to]),
      ]);

      const finalNodes = graph.nodes.filter((n) => extendedNodeIds.has(n.id));

      // 3. Formulate analysis and logic prompt
      const aiResponse = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are a Knowledge Graph Analysis Agent. Identify key relationships, dependencies, and cross-department links between entities. Explain how they connect and influence business performance based on the provided graph context. Keep your response factual and source-backed.',
          },
          {
            role: 'user',
            content: `User Query: "${queryUnderstanding.refinedQuery}"
Query Entities: ${queryUnderstanding.entities.join(', ')}

Knowledge Graph Nodes:
${JSON.stringify(finalNodes, null, 2)}

Knowledge Graph Relationships (Edges):
${JSON.stringify(matchingEdges, null, 2)}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 800,
      });

      const insights = aiResponse.choices[0].message.content?.split('\n').filter(Boolean) || [];

      // Create sources from graph edges
      const sources: Source[] = matchingEdges.map((edge, idx) => ({
        id: `kg-relation-${edge.id || idx}`,
        title: `Relationship: ${edge.label}`,
        type: 'knowledge_graph',
        relevanceScore: 0.9,
        excerpt: `Entity [${graph.nodes.find((n) => n.id === edge.from)?.name || edge.from}] has relationship [${edge.label}] with [${graph.nodes.find((n) => n.id === edge.to)?.name || edge.to}].`,
      }));

      // Add a general Knowledge Graph source
      sources.unshift({
        id: 'kg-search',
        title: 'Enterprise Knowledge Graph',
        type: 'knowledge_graph',
        relevanceScore: 0.95,
      });

      return {
        agentType: 'knowledge_graph' as never,
        success: true,
        data: { nodes: finalNodes, edges: matchingEdges },
        insights,
        confidence: finalNodes.length > 0 ? 0.9 : 0.4,
        sources,
        executionTimeMs: Date.now() - t0,
      };
    } catch (error) {
      logger.error('[KnowledgeGraphAgent] Failed execution:', error);
      return {
        agentType: 'knowledge_graph' as never,
        success: false,
        confidence: 0,
        sources: [],
        executionTimeMs: Date.now() - t0,
        error: (error as Error).message,
      };
    }
  }
}
