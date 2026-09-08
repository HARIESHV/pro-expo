import mongoose from 'mongoose';
import { KnowledgeEntity } from '../../models/KnowledgeEntity';
import { KnowledgeRelationship } from '../../models/KnowledgeRelationship';
import { RiskSignal } from '../types';

/**
 * Graph Evaluation risk signals — data quality / knowledge reliability.
 * Mirrors the Evaluate Graph scoring (health, entity/relationship quality,
 * source coverage, disconnected/duplicate counts) and only emits a risk when
 * scores fall below configurable healthy thresholds.
 */
export async function analyzeGraphEvaluationRisk(orgId: string): Promise<RiskSignal[]> {
  const signals: RiskSignal[] = [];
  const oid = new mongoose.Types.ObjectId(orgId);

  try {
    const [entities, relationships] = await Promise.all([
      KnowledgeEntity.find({ organizationId: oid, isActive: true }).lean(),
      KnowledgeRelationship.find({ organizationId: oid, isActive: true }).lean(),
    ]);

    const totalNodes = entities.length;
    const totalRels = relationships.length;
    if (totalNodes === 0) return signals; // healthy/empty — nothing conclusive

    const connectedIds = new Set<string>();
    relationships.forEach((r) => {
      connectedIds.add(r.fromEntityId.toString());
      connectedIds.add(r.toEntityId.toString());
    });
    const disconnectedCount = entities.filter((e) => !connectedIds.has(e._id.toString())).length;

    const nameMap = new Map<string, number>();
    entities.forEach((e) => {
      const key = e.name.toLowerCase().trim();
      nameMap.set(key, (nameMap.get(key) || 0) + 1);
    });
    const duplicateCount = [...nameMap.values()].filter((c) => c > 1).length;

    const lowConfEntities = entities.filter((e) => (e.confidence ?? 1) < 0.7).length;
    const lowConfRels = relationships.filter((r) => (r.confidence ?? 1) < 0.7).length;
    const lowConfidenceCount = lowConfEntities + lowConfRels;

    const entitiesWithSource = entities.filter((e) => e.sourceDocumentIds && e.sourceDocumentIds.length > 0).length;
    const sourceCoverage = Math.round((entitiesWithSource / totalNodes) * 100);

    const entityQuality = Math.round(entities.reduce((a, e) => a + (e.confidence ?? 1), 0) / totalNodes * 100);
    const relationshipQuality = totalRels > 0
      ? Math.round(relationships.reduce((a, r) => a + (r.confidence ?? 1), 0) / totalRels * 100)
      : 100;

    // ── Data Quality Risk (healthy scores -> no risk) ─────────────────────
    if (entityQuality < 60 || relationshipQuality < 60) {
      signals.push({
        sourceType: 'graph_evaluation',
        sourceId: `ge::data_quality::${Date.now()}`,
        signalType: 'data_quality',
        title: 'Data Quality Risk',
        description: `Knowledge graph evaluation shows reduced quality: entity quality ${entityQuality}/100, relationship quality ${relationshipQuality}/100, with ${lowConfidenceCount} low-confidence item(s).`,
        category: 'Data Quality',
        evidence: [
          { label: 'Evaluate Graph', detail: `Entity quality ${entityQuality}%, relationship quality ${relationshipQuality}%.` },
          { label: 'Evaluate Graph', detail: `${lowConfidenceCount} low-confidence entity/relationship(s).` },
        ],
        confidence: 0.55,
        probability: 40,
        impact: 60,
      });
    }

    // ── Knowledge Completeness Risk (disconnected / missing coverage) ─────
    const disconnectedPct = Math.round((disconnectedCount / totalNodes) * 100);
    if (disconnectedPct >= 25) {
      signals.push({
        sourceType: 'graph_evaluation',
        sourceId: `ge::completeness::${Date.now()}`,
        signalType: 'knowledge_completeness',
        title: 'Knowledge Completeness Risk',
        description: `${disconnectedCount} of ${totalNodes} entities (${disconnectedPct}%) are disconnected from the graph, indicating incomplete or missing relationships.`,
        category: 'Knowledge Graph',
        evidence: [
          { label: 'Evaluate Graph', detail: `${disconnectedPct}% of entities are disconnected (${disconnectedCount}/${totalNodes}).` },
        ],
        confidence: 0.6,
        probability: 50,
        impact: 55,
      });
    }

    // ── Evidence Coverage Risk (low source coverage) ──────────────────────
    if (sourceCoverage < 40) {
      signals.push({
        sourceType: 'graph_evaluation',
        sourceId: `ge::coverage::${Date.now()}`,
        signalType: 'evidence_coverage',
        title: 'Evidence Coverage Risk',
        description: `Only ${sourceCoverage}% of knowledge graph entities are linked to a source document, limiting traceability and reliability of the knowledge base.`,
        category: 'Data Quality',
        evidence: [
          { label: 'Evaluate Graph', detail: `Source coverage ${sourceCoverage}% (${entitiesWithSource}/${totalNodes} entities sourced).` },
        ],
        confidence: 0.5,
        probability: 35,
        impact: 45,
      });
    }

    // ── Data Integrity Risk (duplicates) ──────────────────────────────────
    if (duplicateCount > 0) {
      signals.push({
        sourceType: 'graph_evaluation',
        sourceId: `ge::integrity::${Date.now()}`,
        signalType: 'data_integrity',
        title: 'Data Integrity Risk',
        description: `${duplicateCount} potential duplicate entit(y/ies) detected by name, which can produce inconsistent or misleading analysis.`,
        category: 'Data Quality',
        evidence: [
          { label: 'Evaluate Graph', detail: `${duplicateCount} potential duplicate entit(y/ies) by name.` },
        ],
        confidence: 0.55,
        probability: 40,
        impact: 40,
      });
    }
  } catch {
    // Graph evaluation unavailable — skip gracefully.
  }

  return signals;
}
