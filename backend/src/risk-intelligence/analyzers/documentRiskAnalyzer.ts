import mongoose from 'mongoose';
import { DocumentModel } from '../../models/Document';
import { DocumentChunk } from '../../models/DocumentChunk';
import { RiskSignal } from '../types';
import { canonicalizeDocumentRiskTitle, categoryForCanonicalTitle } from '../dedupe';
import { openai, AI_MODEL } from '../../config/openai';

interface Rule {
  category: string;
  risk: string;
  title: string;
  // category keyword sets
  eval: (text: string, meta: { title: string; description?: string; tags: string[] }) => { desc: string; keywords: string[] } | null;
}

const RULES: Rule[] = [
  {
    category: 'Customer',
    risk: 'Customer Churn Risk',
    title: 'Customer Churn Risk',
    eval: (text) =>
      /renewal\s*rate\s*decreas|churn\s*increas|customers?\s*leaving|losing\s*customers|retention\s*(fell|dropped|decreased)/i.test(text)
        ? { desc: 'Document content indicates declining customer renewal/retention, which can drive churn.', keywords: ['churn', 'renewal', 'retention'] }
        : null,
  },
  {
    category: 'Financial',
    risk: 'Revenue Decline Risk',
    title: 'Revenue Decline Risk',
    eval: (text) =>
      /revenue\s*(decreas|fell|dropped|declin)|sales\s*(decreas|fell|dropped)|revenue\s*target\s*(miss|short)|shortfall/i.test(text)
        ? { desc: 'Document content references declining revenue or a missed revenue target.', keywords: ['revenue', 'decline', 'sales'] }
        : null,
  },
  {
    category: 'Operational',
    risk: 'Operational Delivery Risk',
    title: 'Operational Delivery Risk',
    eval: (text) =>
      /delayed?\s*project|project\s*behind\s*schedule|missed\s*deadline|operational\s*(issue|failure|problem|bottleneck)|delivery\s*risk/i.test(text)
        ? { desc: 'Document content indicates delayed projects or operational delivery issues.', keywords: ['delay', 'project', 'operational'] }
        : null,
  },
  {
    category: 'Compliance',
    risk: 'Compliance Risk',
    title: 'Compliance Risk',
    eval: (text, meta) => {
      const flagged = /non-?compliance|regulation|legal\s*risk|regulatory|audit\s*findings?|policy\s*violation/i.test(text);
      const sensitive = /gdpr|sox|hipaa|pci|iso\s*27001|data\s*privacy/i.test(text);
      if (flagged || (sensitive && /risk|penalt|violat/i.test(text))) {
        return { desc: `Document content indicates potential ${flagged ? 'non-compliance' : 'regulatory/sensitive-data'} exposure.`, keywords: ['compliance', 'regulation', 'legal'] };
      }
      return null;
    },
  },
  {
    category: 'Competitive',
    risk: 'Competitive Risk',
    title: 'Competitive Risk',
    eval: (text) =>
      /competitor\s*(pricing\s*change|launch|move|pressure)|losing\s*market\s*share|market\s*share\s*(fell|dropped)|competitive\s*threat/i.test(text)
        ? { desc: 'Document content references competitor activity or market-share pressure.', keywords: ['competitor', 'market share'] }
        : null,
  },
  {
    category: 'Strategic',
    risk: 'Strategic Risk',
    title: 'Strategic Risk',
    eval: (text) =>
      /strategic\s*risk|strategy\s*(shift|gap)|uncertain\s*(demand|market)|partnership\s*risk|strategic\s*uncertainty/i.test(text)
        ? { desc: 'Document content references strategic uncertainty or partnership risk.', keywords: ['strategy', 'uncertainty', 'partnership'] }
        : null,
  },
  {
    category: 'Technology',
    risk: 'Technology Obsolescence Risk',
    title: 'Technology Obsolescence Risk',
    eval: (text) =>
      /legacy\s*(system|software|stack)|technology\s*(debt|obsolesc|risk|outdated)|outdated\s*platform|system\s*downtime/i.test(text)
        ? { desc: 'Document content indicates technology debt, outdated platforms, or system stability concerns.', keywords: ['legacy', 'technology', 'outdated'] }
        : null,
  },
  {
    category: 'Security',
    risk: 'Security Risk',
    title: 'Security Risk',
    eval: (text) =>
      /security\s*(breach|incident|vulnerab|risk|exposure)|data\s*breach|unauthori[sz]ed\s*access|malware|ransomware/i.test(text)
        ? { desc: 'Document content references a security incident, breach, or vulnerability.', keywords: ['security', 'breach', 'vulnerability'] }
        : null,
  },
  {
    category: 'Resource',
    risk: 'Resource Risk',
    title: 'Resource Risk',
    eval: (text) =>
      /staffing\s*(shortage|gap|risk)|resource\s*(constraint|shortage|risk)|understaffed|hiring\s*freeze|skill\s*gap|key\s*person\s*risk/i.test(text)
        ? { desc: 'Document content indicates resource/staffing shortages or key-person risk.', keywords: ['staffing', 'resource', 'shortage'] }
        : null,
  },
  {
    category: 'Dependency',
    risk: 'Supplier Dependency Risk',
    title: 'Supplier Dependency Risk',
    eval: (text) =>
      /(single|sole|key)\s*supplier|vendor\s*(dependency|depend|risk|concentration)|supply\s*chain\s*risk|reliant\s*on\s*(one|single)/i.test(text)
        ? { desc: 'Document content indicates reliance on a single or key supplier/vendor.', keywords: ['supplier', 'vendor', 'dependency'] }
        : null,
  },
  {
    category: 'Financial',
    risk: 'Contractual Risk',
    title: 'Contractual Risk',
    eval: (text) =>
      /contract\s*(dispute|risk|renewal\s*risk|breach|liabilit)|penalties?\s*for\s*delay|termination\s*clause|contractual\s*obligation/i.test(text)
        ? { desc: 'Document content indicates contractual disputes, risks, or onerous obligations.', keywords: ['contract', 'dispute', 'penalty'] }
        : null,
  },
];

/**
 * Document risk analyzer.
 * Analyzes each org document's title/description/tags and chunk text using
 * deterministic keyword rules, plus a best-effort AI pass. Every detected risk
 * is linked to its source document. All queries org-scoped.
 */
export async function analyzeDocumentRisk(orgId: string, limit = 20): Promise<RiskSignal[]> {
  const signals: RiskSignal[] = [];
  const oid = new mongoose.Types.ObjectId(orgId);

  let documents;
  try {
    documents = await DocumentModel.find({ organizationId: oid, isDeleted: false, processingStatus: 'completed' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  } catch {
    return signals; // documents unavailable
  }

  if (documents.length === 0) return signals;

  for (const doc of documents) {
    let chunks: string[] = [];
    try {
      const chunkDocs = await DocumentChunk.find({ documentId: doc._id, organizationId: oid })
        .select('content')
        .sort({ chunkIndex: 1 })
        .limit(30)
        .lean();
      chunks = chunkDocs.map((c) => c.content);
    } catch {
      chunks = [];
    }

    const fullText = [
      doc.title,
      doc.description || '',
      (doc.tags || []).join(' '),
      ...chunks,
    ].join('\n');

    for (const rule of RULES) {
      const hit = rule.eval(fullText, { title: doc.title, description: doc.description, tags: doc.tags || [] });
      if (hit) {
        signals.push({
          sourceType: 'document',
          sourceId: doc._id.toString(),
          signalType: rule.risk.toLowerCase().replace(/[^a-z]+/g, '_'),
          title: rule.title,
          description: `${hit.desc} Source document: "${doc.title}".`,
          category: rule.category,
          evidence: [
            { label: 'Document', detail: `Document "${doc.title}" (${doc.documentType}) contains: ${hit.keywords.join(', ')}.`, sourceId: doc._id.toString(), sourceType: 'document' },
          ],
          confidence: 0.55,
          probability: 45,
          impact: 60,
        });
      }
    }

    // Best-effort AI pass on the document (non-blocking)
    try {
      const aiSignals = await aiAnalyzeDocument(fullText.slice(0, 2500), doc.title, doc._id.toString());
      signals.push(...aiSignals);
    } catch {
      // AI unavailable — rely on rule-based signals only
    }
  }

  return signals;
}

async function aiAnalyzeDocument(text: string, docTitle: string, docId: string): Promise<RiskSignal[]> {
  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are an enterprise risk analyst. Given a document excerpt, identify concrete business risks ONLY if there is explicit supporting evidence in the text. ' +
          'Return NO risk if there is no clear evidence. Respond with valid JSON only: ' +
          '{"risks":[{"title":"","category":"Financial|Operational|Compliance|Customer|Competitive|Strategic|Technology|Security|Resource|Dependency","reason":"WHY this risk exists in the document","probability":0-100,"impact":0-100}]} ' +
          'Do not invent risks or use generic text that is not supported by the document.',
      },
      { role: 'user', content: `Document: ${docTitle}\n\n${text}` },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 700,
  });

  const raw = JSON.parse(response.choices[0].message.content || '{"risks":[]}');
  const list: Array<{ title?: string; category?: string; reason?: string; probability?: number; impact?: number }> =
    Array.isArray(raw.risks) ? raw.risks : [];

  return list
    .filter((r) => typeof r.title === 'string' && r.title.length > 0 && typeof r.reason === 'string')
    .map((r) => {
      const title = canonicalizeDocumentRiskTitle(r.title as string);
      const reason = r.reason as string;
      return {
        sourceType: 'ai_analysis' as const,
        sourceId: docId,
        signalType: 'ai_document',
        title,
        description: `${reason} Source document: "${docTitle}".`,
        category: categoryForCanonicalTitle(title),
        evidence: [
          { label: 'AI Analysis', detail: `AI review of "${docTitle}": ${reason}`, sourceId: docId, sourceType: 'document' as const },
        ],
        confidence: 0.5,
        probability: Math.min(100, Math.max(1, Math.round(r.probability || 40))),
        impact: Math.min(100, Math.max(1, Math.round(r.impact || 55))),
      };
    });
}
