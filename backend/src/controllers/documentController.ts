import { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'path';
import { DocumentModel } from '../models/Document';
import { DocumentChunk } from '../models/DocumentChunk';
import { ingestDocument } from '../ingestion/ingestionService';
import { AppError } from '../middleware/errorHandler';
import { ApiResponse } from '../types';
import { logger } from '../config/logger';

export const documentController = {
  async uploadDocument(req: Request, res: Response): Promise<void> {
    if (!req.file) throw new AppError('No file uploaded', 400);

    const {
      title,
      description,
      accessLevel = 'internal',
      tags,
      departmentId,
    } = req.body;

    const ext = path.extname(req.file.originalname).slice(1).toLowerCase();
    const docTypeMap: Record<string, string> = {
      pdf: 'pdf', docx: 'docx', doc: 'doc', xlsx: 'xlsx', xls: 'xlsx',
      csv: 'csv', txt: 'txt', eml: 'email',
    };

    const doc = await DocumentModel.create({
      title: title || req.file.originalname,
      description,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      documentType: docTypeMap[ext] || 'txt',
      filePath: req.file.path,
      organizationId: req.user!.organizationId,
      uploadedBy: req.user!._id,
      departmentId,
      accessLevel,
      tags: tags ? JSON.parse(tags) : [],
      processingStatus: 'pending',
    });

    // Trigger ingestion asynchronously
    ingestDocument(doc._id.toString()).catch(console.error);

    res.status(201).json({ success: true, message: 'Document uploaded. Processing started.', data: { document: doc } } as ApiResponse);
  },

  async getDocuments(req: Request, res: Response): Promise<void> {
    const { page = 1, limit = 20, status, type, search } = req.query;
    const filter: Record<string, unknown> = {
      organizationId: req.user!.organizationId,
      isDeleted: false,
    };
    if (status) filter.processingStatus = status;
    if (type) filter.documentType = type;
    if (search) filter.$text = { $search: search as string };

    const [docs, total] = await Promise.all([
      DocumentModel.find(filter)
        .populate('uploadedBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip((+page - 1) * +limit)
        .limit(+limit),
      DocumentModel.countDocuments(filter),
    ]);

    res.json({ success: true, data: { documents: docs, total, page: +page, limit: +limit, totalPages: Math.ceil(total / +limit) } } as ApiResponse);
  },

  async getDocument(req: Request, res: Response): Promise<void> {
    const doc = await DocumentModel.findOne({
      _id: req.params.id,
      organizationId: req.user!.organizationId,
      isDeleted: false,
    }).populate('uploadedBy', 'firstName lastName email');
    if (!doc) throw new AppError('Document not found', 404);
    res.json({ success: true, data: { document: doc } } as ApiResponse);
  },

  async deleteDocument(req: Request, res: Response): Promise<void> {
    const doc = await DocumentModel.findOne({
      _id: req.params.id,
      organizationId: req.user!.organizationId,
    });
    if (!doc) throw new AppError('Document not found', 404);

    await doc.updateOne({ isDeleted: true });
    await DocumentChunk.deleteMany({ documentId: req.params.id });

    if (doc.filePath) {
      fs.promises.unlink(doc.filePath).catch((err: NodeJS.ErrnoException) => {
        if (err.code !== 'ENOENT') {
          logger.warn(`[Documents] Failed to remove file for deleted document ${doc._id}: ${err.message}`);
        }
      });
    }

    res.json({ success: true, message: 'Document deleted' } as ApiResponse);
  },

  async reprocessDocument(req: Request, res: Response): Promise<void> {
    const doc = await DocumentModel.findOne({ _id: req.params.id, organizationId: req.user!.organizationId });
    if (!doc) throw new AppError('Document not found', 404);
    ingestDocument(doc._id.toString()).catch(console.error);
    res.json({ success: true, message: 'Reprocessing started' } as ApiResponse);
  },
};
