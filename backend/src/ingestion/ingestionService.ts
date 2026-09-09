import mongoose from 'mongoose';
import { DocumentModel, IDocument } from '../models/Document';
import { DocumentChunk } from '../models/DocumentChunk';
import { KnowledgeEntity } from '../models/KnowledgeEntity';
import { KnowledgeRelationship } from '../models/KnowledgeRelationship';
import { parseDocument } from './documentParser';
import { chunkDocument } from './chunker';
import { extractEntitiesAndRelationships } from './entityExtractor';
import { embeddingService } from '../services/embeddingService';
import { IngestionResult } from '../types';
import { logger } from '../config/logger';

export async function ingestDocument(documentId: string): Promise<IngestionResult> {
  const doc = await DocumentModel.findById(documentId);
  if (!doc) throw new Error(`Document ${documentId} not found`);

  await DocumentModel.findByIdAndUpdate(documentId, { processingStatus: 'processing' });

  try {
    // Step 1: Parse
    logger.info(`[Ingestion] Parsing document: ${doc.title}`);
    const parsed = await parseDocument(doc.filePath, doc.mimeType);
    if (!parsed.content.trim()) {
      throw new Error('Unable to extract readable content from this document.');
    }

    // Step 2: Update metadata from parsing
    await DocumentModel.findByIdAndUpdate(documentId, {
      'metadata.pageCount': parsed.metadata.pageCount,
      'metadata.wordCount': parsed.metadata.wordCount,
    });

    // Step 3: Chunk
    const chunks = chunkDocument(parsed.content);
    if (chunks.length === 0) {
      throw new Error('Unable to extract readable content from this document.');
    }
    logger.info(`[Ingestion] Created ${chunks.length} chunks`);

    // Step 4: Generate embeddings in batch
    const texts = chunks.map((c) => c.content);
    const embeddings = await embeddingService.generateBatchEmbeddings(texts);

    // Step 5: Save chunks to MongoDB
    const chunkDocs = chunks.map((chunk, i) => ({
      documentId: doc._id,
      organizationId: doc.organizationId,
      content: chunk.content,
      embedding: embeddings[i],
      chunkIndex: chunk.chunkIndex,
      totalChunks: chunk.totalChunks,
      metadata: {
        documentId: doc._id.toString(),
        organizationId: doc.organizationId.toString(),
        department: doc.departmentId?.toString(),
        author: doc.metadata.author,
        createdDate: doc.metadata.createdDate,
        modifiedDate: doc.metadata.modifiedDate,
        accessLevel: doc.accessLevel,
        documentType: doc.documentType,
        source: doc.title,
        confidence: 1.0,
        chunkIndex: chunk.chunkIndex,
        totalChunks: chunk.totalChunks,
      },
    }));

    // Delete existing chunks for re-ingestion
    await DocumentChunk.deleteMany({ documentId: doc._id });
    await DocumentChunk.insertMany(chunkDocs);

    // Step 6: Entity & relationship extraction (on first 3000 chars)
    const { entities, relationships } = await extractEntitiesAndRelationships(
      parsed.content.slice(0, 3000),
      doc.title
    );

    // Step 7: Save entities to knowledge graph
    const savedEntities: Record<string, mongoose.Types.ObjectId> = {};
    for (const entity of entities) {
      const existing = await KnowledgeEntity.findOne({
        organizationId: doc.organizationId,
        name: entity.name,
        type: entity.type,
      });
      if (existing) {
        savedEntities[entity.name] = existing._id as mongoose.Types.ObjectId;
        await KnowledgeEntity.findByIdAndUpdate(existing._id, {
          $addToSet: { sourceDocumentIds: doc._id },
        });
      } else {
        const saved = await KnowledgeEntity.create({
          organizationId: doc.organizationId,
          name: entity.name,
          type: entity.type,
          description: entity.description,
          sourceDocumentIds: [doc._id],
        });
        savedEntities[entity.name] = saved._id as mongoose.Types.ObjectId;
      }
    }

    // Step 8: Save relationships
    for (const rel of relationships) {
      const fromId = savedEntities[rel.from];
      const toId = savedEntities[rel.to];
      if (!fromId || !toId) continue;
      await KnowledgeRelationship.findOneAndUpdate(
        { organizationId: doc.organizationId, fromEntityId: fromId, toEntityId: toId, relationshipType: rel.type },
        { $addToSet: { sourceDocumentIds: doc._id }, label: rel.label },
        { upsert: true }
      );
    }

    // Step 9: Mark complete
    await DocumentModel.findByIdAndUpdate(documentId, {
      processingStatus: 'completed',
      chunksCount: chunks.length,
    });

    logger.info(`[Ingestion] Completed: ${doc.title} — ${chunks.length} chunks, ${entities.length} entities`);

    // Risk Intelligence auto-refresh: new document evidence may change risk signals
    try {
      const { riskIntelligenceService } = await import('../risk-intelligence/riskIntelligenceService');
      riskIntelligenceService.refreshAsync(doc.organizationId.toString());
    } catch (e) {
      // non-blocking
    }

    return {
      documentId,
      chunksCreated: chunks.length,
      entitiesExtracted: entities.length,
      relationshipsExtracted: relationships.length,
      success: true,
    };
  } catch (error) {
    await DocumentModel.findByIdAndUpdate(documentId, {
      processingStatus: 'failed',
      processingError: (error as Error).message,
    });
    logger.error(`[Ingestion] Failed for document ${documentId}:`, error);
    return {
      documentId,
      chunksCreated: 0,
      entitiesExtracted: 0,
      relationshipsExtracted: 0,
      success: false,
      errors: [(error as Error).message],
    };
  }
}
