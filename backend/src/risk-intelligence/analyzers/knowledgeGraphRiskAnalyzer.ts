import mongoose from 'mongoose';
import { KnowledgeEntity } from '../../models/KnowledgeEntity';
import { KnowledgeRelationship } from '../../models/KnowledgeRelationship';
import { RiskSignal } from '../types';

/**
 * Knowledge Graph risk signals — relationship & dependency based.
 * Uses actual graph relationships to detect third-party dependency risk,
 * disconnected/critical entities, duplicate entities, and low-confidence
 * (data reliability) relationships. All queries org-scoped.
 */
export async function analyzeKnowledgeGraphRisk(orgId: string): Promise<RiskSignal[]> {
  const signals: RiskSignal[] = [];
  const oid = new mongoose.Types.ObjectId(orgId);

  try {
    const [entities, relationships] = await Promise.all([
      KnowledgeEntity.find({ organizationId: oid, isActive: true }).lean(),
      KnowledgeRelationship.find({ organizationId: oid, isActive: true }).lean(),
    ]);

    if (entities.length === 0) return signals; // No meaningful graph — no conclusive risk

    // Build adjacency for dependency-chain analysis
    const byId = new Map(entities.map((e) => [e._id.toString(), e]));
    const relsByFrom = new Map<string, typeof relationships[number][]>();
    relationships.forEach((r) => {
      const key = r.fromEntityId.toString();
      if (!relsByFrom.has(key)) relsByFrom.set(key, []);
      relsByFrom.get(key)!.push(r);
    });

    // ── Third-Party / Dependency Chain Risk ───────────────────────────────
    // Detect a chain: customer -> product -> single vendor-like entity, where a
    // leaf entity is referenced by many relationships (a single point of failure).
    const incomingCount = new Map<string, number>();
    relationships.forEach((r) => {
      const key = r.toEntityId.toString();
      incomingCount.set(key, (incomingCount.get(key) || 0) + 1);
    });

    const criticalHubs = [...incomingCount.entries()]
      .filter(([, count]) => count >= 3)
      .map(([id]) => byId.get(id))
      .filter(Boolean);

    if (criticalHubs.length > 0) {
      const hub = criticalHubs[0]!;
      const depChain = relationships.filter((r) => r.toEntityId.toString() === hub._id.toString())
        .map((r) => byId.get(r.fromEntityId.toString())?.name || '?');
      signals.push({
        sourceType: 'knowledge_graph',
        sourceId: `kg::dependency::${hub._id}`,
        signalType: 'dependency_chain',
        title: 'Third-Party Dependency Risk',
        description: `Knowledge graph shows ${criticalHubs.length} critical hub entit(y/ies) with many incoming dependencies. "${hub.name}" is depended on by ${depChain.length} entit(y/ies) (${depChain.slice(0, 4).join(', ')}${depChain.length > 4 ? '...' : ''}), representing a single point of failure / concentrated dependency.`,
        category: 'Dependency',
        evidence: [
          { label: 'Knowledge Graph', detail: `"${hub.name}" has ${depChain.length} dependent entit(y/ies) via inbound relationships.` },
        ],
        confidence: 0.55,
        probability: 45,
        impact: 70,
      });
    }

    // ── Data Reliability Risk (low-confidence relationships / missing sources)
    const lowConfRels = relationships.filter((r) => (r.confidence ?? 1) < 0.7);
    const relsMissingSource = relationships.filter((r) => !r.sourceDocumentIds || r.sourceDocumentIds.length === 0);
    if (relationships.length > 0 && (lowConfRels.length + relsMissingSource.length) / relationships.length > 0.2) {
      signals.push({
        sourceType: 'knowledge_graph',
        sourceId: `kg::reliability::${Date.now()}`,
        signalType: 'data_reliability',
        title: 'Data Reliability Risk',
        description: `${lowConfRels.length} relationship(s) have low confidence and ${relsMissingSource.length} lack a source document, out of ${relationships.length} total — the graph's factual reliability is questionable.`,
        category: 'Data Quality',
        evidence: [
          { label: 'Knowledge Graph', detail: `${lowConfRels.length} low-confidence + ${relsMissingSource.length} unsourced relationships of ${relationships.length}.` },
        ],
        confidence: 0.5,
        probability: 40,
        impact: 55,
      });
    }

    // ── Duplicate Entity Risk ─────────────────────────────────────────────
    const names = new Map<string, number>();
    entities.forEach((e) => {
      const key = e.name.toLowerCase().trim();
      names.set(key, (names.get(key) || 0) + 1);
    });
    const duplicateGroups = [...names.entries()].filter(([, count]) => count > 1);
    if (duplicateGroups.length > 0) {
      signals.push({
        sourceType: 'knowledge_graph',
        sourceId: `kg::duplicates::${Date.now()}`,
        signalType: 'duplicate_entities',
        title: 'Duplicate Entity Risk',
        description: `${duplicateGroups.length} normalized name(s) are represented by multiple graph entities (e.g. "${duplicateGroups[0][0]}"), which corrupts analysis and reporting.`,
        category: 'Data Quality',
        evidence: [
          { label: 'Knowledge Graph', detail: `${duplicateGroups.length} duplicate name group(s) detected (e.g. "${duplicateGroups[0][0]}").` },
        ],
        confidence: 0.6,
        probability: 45,
        impact: 45,
      });
    }
  } catch {
    // Knowledge Graph unavailable — skip.
  }

  return signals;
}
