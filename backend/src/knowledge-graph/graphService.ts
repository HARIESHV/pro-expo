import { KnowledgeEntity } from '../models/KnowledgeEntity';
import { KnowledgeRelationship } from '../models/KnowledgeRelationship';
import mongoose from 'mongoose';

export interface GraphNode {
  id: string;
  name: string;
  type: string;
  properties: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  type: string;
  weight: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const knowledgeGraphService = {
  async getGraph(organizationId: string, entityTypes?: string[], limit = 100): Promise<GraphData> {
    const orgId = new mongoose.Types.ObjectId(organizationId);
    const entityFilter: Record<string, unknown> = { organizationId: orgId, isActive: true };
    if (entityTypes?.length) entityFilter.type = { $in: entityTypes };

    const [entities, relationships] = await Promise.all([
      KnowledgeEntity.find(entityFilter).limit(limit).lean(),
      KnowledgeRelationship.find({ organizationId: orgId, isActive: true }).limit(limit * 2).lean(),
    ]);

    const entityIds = new Set(entities.map((e) => e._id.toString()));

    const nodes: GraphNode[] = entities.map((e) => ({
      id: e._id.toString(),
      name: e.name,
      type: e.type,
      properties: e.properties,
    }));

    const edges: GraphEdge[] = relationships
      .filter((r) => entityIds.has(r.fromEntityId.toString()) && entityIds.has(r.toEntityId.toString()))
      .map((r) => ({
        id: r._id.toString(),
        from: r.fromEntityId.toString(),
        to: r.toEntityId.toString(),
        label: r.label,
        type: r.relationshipType,
        weight: r.weight,
      }));

    return { nodes, edges };
  },

  async getEntityNeighbors(organizationId: string, entityId: string, depth = 2): Promise<GraphData> {
    const orgId = new mongoose.Types.ObjectId(organizationId);
    const entityObjId = new mongoose.Types.ObjectId(entityId);
    const visited = new Set<string>([entityId]);
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    let frontier = [entityObjId];

    for (let d = 0; d < depth; d++) {
      const rels = await KnowledgeRelationship.find({
        organizationId: orgId,
        $or: [{ fromEntityId: { $in: frontier } }, { toEntityId: { $in: frontier } }],
        isActive: true,
      }).lean();

      const neighborIds = rels.flatMap((r) => [r.fromEntityId.toString(), r.toEntityId.toString()])
        .filter((id) => !visited.has(id));

      const uniqueNeighborIds = [...new Set(neighborIds)];
      uniqueNeighborIds.forEach((id) => visited.add(id));

      if (uniqueNeighborIds.length === 0) break;

      const neighborEntities = await KnowledgeEntity.find({
        _id: { $in: uniqueNeighborIds.map((id) => new mongoose.Types.ObjectId(id)) },
      }).lean();

      nodes.push(...neighborEntities.map((e) => ({
        id: e._id.toString(),
        name: e.name,
        type: e.type,
        properties: e.properties,
      })));

      edges.push(...rels.map((r) => ({
        id: r._id.toString(),
        from: r.fromEntityId.toString(),
        to: r.toEntityId.toString(),
        label: r.label,
        type: r.relationshipType,
        weight: r.weight,
      })));

      frontier = uniqueNeighborIds.map((id) => new mongoose.Types.ObjectId(id));
    }

    // Add origin entity
    const origin = await KnowledgeEntity.findById(entityId).lean();
    if (origin) {
      nodes.unshift({ id: origin._id.toString(), name: origin.name, type: origin.type, properties: origin.properties });
    }

    return { nodes, edges };
  },

  async searchEntities(organizationId: string, query: string): Promise<GraphNode[]> {
    const entities = await KnowledgeEntity.find({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      $text: { $search: query },
      isActive: true,
    }).limit(20).lean();

    return entities.map((e) => ({
      id: e._id.toString(),
      name: e.name,
      type: e.type,
      properties: e.properties,
    }));
  },
};
