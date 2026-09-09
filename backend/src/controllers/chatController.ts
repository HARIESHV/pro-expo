import { Request, Response } from 'express';
import { MasterIntelligenceAgent } from '../agents/MasterIntelligenceAgent';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { Query } from '../models/Query';
import { AppError } from '../middleware/errorHandler';
import { ApiResponse } from '../types';
import { logger } from '../config/logger';
import { getAccessLevelsForRoles } from '../config/accessControl';
import { DocumentModel } from '../models/Document';

const masterAgent = new MasterIntelligenceAgent();

function hasValidAnalysisAnswer(response: { answer?: string; hasAnswer?: boolean }): boolean {
  const answer = response.answer?.trim() || '';
  if (!answer || response.hasAnswer === false) return false;
  const lower = answer.toLowerCase();
  return ![
    "couldn't retrieve",
    "couldn't find",
    'no matching record',
    'no relevant information',
    'information is unavailable',
    "i don't have enough verified enterprise data",
  ].some((pattern) => lower.includes(pattern));
}

export const chatController = {
  async createConversation(req: Request, res: Response): Promise<void> {
    const { title } = req.body;
    const conversation = await Conversation.create({
      title: title || 'New Conversation',
      userId: req.user!._id,
      organizationId: req.user!.organizationId,
    });
    logger.info(`[AIChat] Created conversation ${conversation._id} for user ${req.user!._id}`);
    res.status(201).json({ success: true, data: { conversation } } as ApiResponse);
  },

  async getConversations(req: Request, res: Response): Promise<void> {
    const conversations = await Conversation.find({
      userId: req.user!._id,
      organizationId: req.user!.organizationId,
      isActive: true,
    })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .limit(50);
    res.json({ success: true, data: { conversations } } as ApiResponse);
  },

  async getConversationMessages(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const conversation = await Conversation.findOne({
      _id: id,
      userId: req.user!._id,
      organizationId: req.user!.organizationId,
    });
    if (!conversation) throw new AppError('Conversation not found', 404);

    const messages = await Message.find({ conversationId: id }).sort({ createdAt: 1 });
    res.json({ success: true, data: { conversation, messages } } as ApiResponse);
  },

  async sendMessage(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const rawContent = (req.body.content || req.body.message || req.body.query || '').toString().trim();

    logger.info('[AI CHAT] Request received');

    if (!rawContent) {
      logger.warn('[AI CHAT ERROR] Empty input received');
      throw new AppError('Please enter a valid question.', 400);
    }

    if (!req.user) {
      logger.error('[AI CHAT ERROR] Unauthenticated request');
      throw new AppError('Your session has expired. Please log in again.', 401);
    }

    logger.info(`[AI CHAT] User authenticated: ${req.user._id} (${req.user.email})`);

    let conversationId = req.body.conversationId;
    const documentId = typeof req.body.documentId === 'string' ? req.body.documentId : undefined;
    const analyzeDocument = req.body.analyzeDocument === true;
    let conversation;

    let analysisDocument;
    if (documentId) {
      analysisDocument = await DocumentModel.findOne({
        _id: documentId,
        organizationId: req.user.organizationId,
        isDeleted: false,
      });
      if (!analysisDocument) throw new AppError('Document not found', 404);
      if (analysisDocument.processingStatus !== 'completed') {
        throw new AppError('Document is still being processed. Please wait and try again.', 409);
      }

    }

    if (conversationId) {
      conversation = await Conversation.findOne({
        _id: conversationId,
        userId: req.user._id,
        organizationId: req.user.organizationId,
      });
      if (!conversation) throw new AppError('Conversation not found', 404);
    } else {
      conversation = await Conversation.create({
        title: rawContent.slice(0, 50),
        userId: req.user._id,
        organizationId: req.user.organizationId,
      });
      conversationId = conversation._id.toString();
    }

    logger.info(`[AI CHAT] Conversation loaded: ${conversationId}`);

    const previousMessages = await Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    const history = previousMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content || m.answer || '',
    }));

    await Message.create({
      conversationId,
      userId: req.user._id,
      organizationId: req.user.organizationId,
      role: 'user',
      content: rawContent,
    });

    const queryRecord = await Query.create({
      conversationId,
      userId: req.user._id,
      organizationId: req.user.organizationId,
      originalQuery: rawContent,
      status: 'processing',
    });

    if (documentId && analyzeDocument) {
      const claimedDocument = await DocumentModel.findOneAndUpdate(
        {
          _id: documentId,
          organizationId: req.user.organizationId,
          isDeleted: false,
          analysisStatus: { $in: ['pending', 'failed', null] },
        },
        {
          $set: { analysisStatus: 'processing' },
          $unset: { analysisError: 1 },
        },
        { new: true }
      );
      if (!claimedDocument) {
        const currentDocument = await DocumentModel.findById(documentId).select('analysisStatus');
        if (currentDocument?.analysisStatus === 'completed') throw new AppError('Document analysis is already completed.', 409);
        throw new AppError('Document analysis is already in progress.', 409);
      }
      analysisDocument = claimedDocument;
    }

    const userRoles = req.user.roles;
    const accessLevels = getAccessLevelsForRoles(userRoles);

    logger.info('[AI CHAT] Calling AI provider');

    try {
      const intelligenceResponse = await masterAgent.execute(rawContent, {
        organizationId: req.user.organizationId.toString(),
        userId: req.user._id.toString(),
        conversationId,
        userRoles,
        accessLevels,
        history,
        documentIds: documentId ? [documentId] : undefined,
      });

      logger.info('[AI CHAT] AI response received');

      if (analysisDocument && analyzeDocument && !hasValidAnalysisAnswer(intelligenceResponse)) {
        throw new AppError('AI did not return a valid document answer. Please retry the analysis.', 502);
      }

      const assistantMessage = await Message.create({
        conversationId,
        userId: req.user._id,
        organizationId: req.user.organizationId,
        role: 'assistant',
        content: intelligenceResponse.answer,
        queryId: queryRecord._id,
        answer: intelligenceResponse.answer,
        summary: intelligenceResponse.summary,
        keyFindings: intelligenceResponse.keyFindings,
        evidence: intelligenceResponse.evidence,
        sources: intelligenceResponse.sources,
        citations: intelligenceResponse.citations,
        confidence: intelligenceResponse.confidence,
        hasAnswer: intelligenceResponse.hasAnswer,
        recommendations: intelligenceResponse.recommendations,
        expectedImpact: intelligenceResponse.expectedImpact,
        risks: intelligenceResponse.risks,
        agentsUsed: intelligenceResponse.agentsUsed,
        executionTimeMs: intelligenceResponse.executionTimeMs,
        queryUnderstanding: intelligenceResponse.queryUnderstanding,
        subTasks: intelligenceResponse.subTasks,
      });

      if (analysisDocument && analyzeDocument) {
        analysisDocument = await DocumentModel.findOneAndUpdate(
          { _id: analysisDocument._id, analysisStatus: 'processing' },
          {
            $set: {
              analysisStatus: 'completed',
              analysisResponse: intelligenceResponse.answer,
              analyzedAt: new Date(),
              analysisConversationId: conversationId,
              analysisMessageId: assistantMessage._id,
            },
            $unset: { analysisError: 1 },
          },
          { new: true }
        );
      }

      await Query.findByIdAndUpdate(queryRecord._id, {
        status: 'completed',
        intent: intelligenceResponse.queryUnderstanding?.intent || 'search',
        agentsUsed: intelligenceResponse.agentsUsed,
        result: intelligenceResponse,
        executionTimeMs: intelligenceResponse.executionTimeMs,
      });

      await Conversation.findByIdAndUpdate(conversationId, {
        $inc: { queryCount: 1 },
        title: conversation.title === 'New Conversation' ? rawContent.slice(0, 50) : conversation.title,
        lastMessageAt: new Date(),
      });

      const duration = Date.now() - startTime;
      logger.info(`[AI CHAT] Response returned (duration: ${duration}ms)`);

      try {
        const { riskIntelligenceService } = await import('../risk-intelligence/riskIntelligenceService');
        riskIntelligenceService.refreshAsync(req.user.organizationId.toString());
      } catch (e) {
        // non-blocking
      }

      res.json({
        success: true,
        conversationId,
        message: assistantMessage.content,
        data: { message: assistantMessage, intelligence: intelligenceResponse, document: analysisDocument },
      } as ApiResponse);
    } catch (err: any) {
      logger.error('[AI CHAT ERROR]', {
        conversationId,
        userId: req.user._id.toString(),
        error: err?.message || 'Unknown error',
        stack: err?.stack,
      });
      await Query.findByIdAndUpdate(queryRecord._id, {
        status: 'failed',
        errorMessage: err?.message || 'AI service error',
      });

      if (analysisDocument && analyzeDocument) {
        analysisDocument = await DocumentModel.findOneAndUpdate(
          { _id: analysisDocument._id, analysisStatus: 'processing' },
          {
            $set: {
              analysisStatus: 'failed',
              analysisError: err?.message || 'AI service error',
            },
          },
          { new: true }
        );
      }
      
      if (analysisDocument && analyzeDocument) {
        res.status(502).json({
          success: false,
          message: err?.message || 'Document analysis failed.',
          data: { document: analysisDocument },
        } as ApiResponse);
        return;
      }

      const fallbackErrorMessage = 'The AI service encountered a temporary error. Please try asking your question again.';
      const fallbackMsg = await Message.create({
        conversationId,
        userId: req.user._id,
        organizationId: req.user.organizationId,
        role: 'assistant',
        content: fallbackErrorMessage,
        queryId: queryRecord._id,
        confidence: 0.0,
        hasAnswer: false,
      });

      res.status(200).json({
        success: true,
        conversationId,
        message: fallbackErrorMessage,
        data: { message: fallbackMsg, document: analysisDocument },
      } as ApiResponse);
    }
  },

  async deleteConversation(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const conversation = await Conversation.findOne({
      _id: id,
      userId: req.user!._id,
      organizationId: req.user!.organizationId,
      isActive: true,
    });
    if (!conversation) throw new AppError('Conversation not found', 404);

    await Promise.all([
      Message.deleteMany({ conversationId: conversation._id }),
      Query.deleteMany({ conversationId: conversation._id }),
      DocumentModel.updateMany(
        { analysisConversationId: conversation._id },
        {
          $set: { analysisStatus: 'pending' },
          $unset: {
            analysisResponse: 1,
            analyzedAt: 1,
            analysisConversationId: 1,
            analysisMessageId: 1,
            analysisError: 1,
          },
        }
      ),
    ]);
    await Conversation.deleteOne({ _id: conversation._id });

    res.json({ success: true, message: 'Conversation and associated AI records deleted' } as ApiResponse);
  },
};
