import { Request, Response } from 'express';
import { knowledgeGraphService } from '../knowledge-graph/graphService';
import { unifiedKnowledgeGraphService } from '../knowledge-graph/unifiedGraphService';
import { GraphSource } from '../types';
import { ApiResponse } from '../types';

const KNOWN_SOURCES = new Set<GraphSource>(['knowledge', 'document', 'database', 'chat', 'decision', 'universal_search']);

export const knowledgeGraphController = {
  async getGraph(req: Request, res: Response): Promise<void> {
    const { types, sources, minConfidence, limit } = req.query;
    const entityTypes = types ? (types as string).split(',').filter(Boolean) : undefined;
    const sourceList = sources
      ? ((sources as string).split(',').filter((s) => KNOWN_SOURCES.has(s as GraphSource)) as GraphSource[])
      : undefined;

    const result = await unifiedKnowledgeGraphService.getGraph(
      req.user!.organizationId.toString(),
      {
        entityTypes,
        sources: sourceList,
        minConfidence: minConfidence ? +minConfidence : undefined,
        limit: limit ? +limit : undefined,
        userId: req.user!._id.toString(),
        roles: req.user!.roles,
      }
    );

    res.json({ success: true, data: result.data, breakdown: result.breakdown } as ApiResponse);
  },

  async getGraphBreakdown(req: Request, res: Response): Promise<void> {
    const { types, sources } = req.query;
    const entityTypes = types ? (types as string).split(',').filter(Boolean) : undefined;
    const sourceList = sources
      ? ((sources as string).split(',').filter((s) => KNOWN_SOURCES.has(s as GraphSource)) as GraphSource[])
      : undefined;

    const result = await unifiedKnowledgeGraphService.getGraphWithBreakdown(
      req.user!.organizationId.toString(),
      {
        entityTypes,
        sources: sourceList,
        userId: req.user!._id.toString(),
        roles: req.user!.roles,
      }
    );

    res.json({ success: true, data: result.data, breakdown: result.breakdown, totalNodes: result.data.totalNodes, totalEdges: result.data.totalEdges } as ApiResponse);
  },

  async getEntityNeighbors(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const data = await unifiedKnowledgeGraphService.getEntityNeighbors(
      req.user!.organizationId.toString(),
      id,
      req.user!._id.toString(),
      req.user!.roles
    );
    res.json({ success: true, data } as ApiResponse);
  },

  async searchEntities(req: Request, res: Response): Promise<void> {
    const { q } = req.query;
    if (!q) { res.json({ success: true, data: { entities: [] } } as ApiResponse); return; }
    const entities = await unifiedKnowledgeGraphService.searchEntities(
      req.user!.organizationId.toString(),
      q as string,
      req.user!._id.toString(),
      req.user!.roles
    );
    res.json({ success: true, data: { entities } } as ApiResponse);
  },

  /** Compatibility path used by the AI agents (limit-capped stored graph). */
  async getStoredGraph(req: Request, res: Response): Promise<void> {
    const { types, limit } = req.query;
    const entityTypes = types ? (types as string).split(',') : undefined;
    const graph = await knowledgeGraphService.getGraph(
      req.user!.organizationId.toString(),
      entityTypes,
      limit ? +limit : 100
    );
    res.json({ success: true, data: graph } as ApiResponse);
  },

  async evaluateGraph(req: Request, res: Response): Promise<void> {
    const orgId = req.user!.organizationId.toString();
    const { KnowledgeEntity } = await import('../models/KnowledgeEntity');
    const { KnowledgeRelationship } = await import('../models/KnowledgeRelationship');

    const [entities, relationships] = await Promise.all([
      KnowledgeEntity.find({ organizationId: orgId, isActive: true }),
      KnowledgeRelationship.find({ organizationId: orgId, isActive: true }),
    ]);

    const totalNodes = entities.length;
    const totalRels = relationships.length;

    if (totalNodes === 0) {
      res.json({
        success: true,
        data: {
          healthScore: 100,
          entityQuality: 100,
          relationshipQuality: 100,
          sourceCoverage: 100,
          duplicateCount: 0,
          disconnectedCount: 0,
          lowConfidenceCount: 0,
          issues: [],
        },
      } as ApiResponse);
      return;
    }

    // 1. Calculate disconnected nodes
    const connectedNodeIds = new Set<string>();
    relationships.forEach((r) => {
      connectedNodeIds.add(r.fromEntityId.toString());
      connectedNodeIds.add(r.toEntityId.toString());
    });

    const disconnectedEntities = entities.filter((e) => !connectedNodeIds.has(e._id.toString()));
    const disconnectedCount = disconnectedEntities.length;

    // 2. Identify potential duplicate entities
    const duplicatesMap = new Map<string, string[]>();
    entities.forEach((e) => {
      const normalizedName = e.name.toLowerCase().trim();
      if (duplicatesMap.has(normalizedName)) {
        duplicatesMap.get(normalizedName)!.push(e.name);
      } else {
        duplicatesMap.set(normalizedName, [e.name]);
      }
    });

    let duplicateCount = 0;
    duplicatesMap.forEach((names) => {
      if (names.length > 1) {
        duplicateCount += (names.length - 1);
      }
    });

    // 3. Identify low-confidence items
    const lowConfidenceEntities = entities.filter((e) => e.confidence < 0.7);
    const lowConfidenceRels = relationships.filter((r) => r.confidence < 0.7);
    const lowConfidenceCount = lowConfidenceEntities.length + lowConfidenceRels.length;

    // 4. Source coverage
    const entitiesWithSource = entities.filter((e) => e.sourceDocumentIds && e.sourceDocumentIds.length > 0);
    const sourceCoverage = Math.round((entitiesWithSource.length / totalNodes) * 100);

    // 5. Overall confidence / Quality metrics
    const avgEntityConf = entities.reduce((acc, curr) => acc + curr.confidence, 0) / totalNodes;
    const entityQuality = Math.round(avgEntityConf * 100);

    const avgRelConf = totalRels > 0
      ? relationships.reduce((acc, curr) => acc + curr.confidence, 0) / totalRels
      : 1.0;
    const relationshipQuality = Math.round(avgRelConf * 100);

    // 6. Graph Health Score
    let healthScore = 100 - (disconnectedCount * 3) - (duplicateCount * 5) - (lowConfidenceCount * 4);
    if (healthScore < 0) healthScore = 0;

    // 7. Compile Issues List
    const issues: Array<{ id: string; type: string; entity: string; explanation: string; severity: string; recommendedFix: string }> = [];

    disconnectedEntities.forEach((e, idx) => {
      issues.push({
        id: `disconnected-${idx}-${e._id}`,
        type: 'disconnected_node',
        entity: e.name,
        explanation: `The node "${e.name}" has no relationships connected to any other entities in the knowledge base.`,
        severity: 'medium',
        recommendedFix: 'Create a relationship to connect this entity to the graph, or link it via AI Document Processing.',
      });
    });

    duplicatesMap.forEach((names, normalizedName) => {
      if (names.length > 1) {
        issues.push({
          id: `duplicate-${normalizedName}`,
          type: 'duplicate_entity',
          entity: names[0],
          explanation: `Multiple entities exist with the same name: ${names.join(', ')}.`,
          severity: 'high',
          recommendedFix: `Merge duplicate entities using the Entity Resolution tool.`,
        });
      }
    });

    lowConfidenceEntities.forEach((e, idx) => {
      issues.push({
        id: `low-conf-node-${idx}-${e._id}`,
        type: 'low_confidence',
        entity: e.name,
        explanation: `The entity "${e.name}" was extracted with a low confidence score of ${Math.round(e.confidence * 100)}%.`,
        severity: 'low',
        recommendedFix: 'Review the source documents to verify this entity details and manually accept or reject it.',
      });
    });

    res.json({
      success: true,
      data: {
        healthScore,
        entityQuality,
        relationshipQuality,
        sourceCoverage,
        duplicateCount,
        disconnectedCount,
        lowConfidenceCount,
        issues,
      },
    } as ApiResponse);
  },
};