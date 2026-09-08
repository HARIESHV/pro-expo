import api from './axios';
import { ApiResponse, GraphData, KnowledgeGraphNode } from '../types';

export interface GraphFilters {
  types?: string;
  sources?: string;
  minConfidence?: number;
  limit?: number;
}

export const knowledgeGraphApi = {
  getGraph: (params?: GraphFilters) =>
    api.get<ApiResponse<GraphData>>('/knowledge-graph', { params }),

  getBreakdown: (params?: GraphFilters) =>
    api.get<{ success: boolean; data: GraphData; breakdown?: { nodesByType: Record<string, number>; edgesByType: Record<string, number> }; totalNodes?: number; totalEdges?: number }>('/knowledge-graph/breakdown', { params }),

  getEntityNeighbors: (id: string, depth?: number) =>
    api.get<ApiResponse<GraphData>>(`/knowledge-graph/entity/${id}`, { params: { depth } }),

  searchEntities: (q: string) =>
    api.get<ApiResponse<{ entities: KnowledgeGraphNode[] }>>('/knowledge-graph/search', { params: { q } }),
};