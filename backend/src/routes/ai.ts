import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { chatController } from '../controllers/chatController';
import { MasterIntelligenceAgent } from '../agents/MasterIntelligenceAgent';
import { ApiResponse } from '../types';
import { Query } from '../models/Query';
import { getAccessLevelsForRoles } from '../config/accessControl';
import { evaluateDecision } from '../services/decisionService';
import mongoose from 'mongoose';

const router = Router();
const masterAgent = new MasterIntelligenceAgent();

router.use(authenticate);

// Service layer route alias for AI chat
router.post('/chat', chatController.sendMessage);

router.post('/query', async (req: Request, res: Response) => {
  const { query, filters } = req.body;
  
  if (!query) {
    return res.status(400).json({ success: false, message: 'Query is required' } as ApiResponse);
  }

  // Determine user's access levels from roles
  const userRoles = req.user!.roles;
  const accessLevels = getAccessLevelsForRoles(userRoles);

  const conversationId = new mongoose.Types.ObjectId();

  const queryRecord = await Query.create({
    conversationId,
    userId: req.user!._id,
    organizationId: req.user!.organizationId,
    originalQuery: query,
    status: 'processing',
  });

  try {
    const intelligenceResponse = await masterAgent.execute(query, {
      organizationId: req.user!.organizationId.toString(),
      userId: req.user!._id.toString(),
      conversationId: conversationId.toString(),
      userRoles,
      accessLevels,
      searchMode: filters?.searchMode,
    });

    await Query.findByIdAndUpdate(queryRecord._id, {
      status: 'completed',
      intent: intelligenceResponse.queryUnderstanding?.intent,
      agentsUsed: intelligenceResponse.agentsUsed,
      result: intelligenceResponse,
      executionTimeMs: intelligenceResponse.executionTimeMs,
    });

    // Risk Intelligence auto-refresh on universal search / AI analysis
    try {
      const { riskIntelligenceService } = await import('../risk-intelligence/riskIntelligenceService');
      riskIntelligenceService.refreshAsync(req.user!.organizationId.toString());
    } catch (e) {
      // non-blocking
    }

    res.json({ success: true, data: intelligenceResponse } as ApiResponse);
  } catch (err: any) {
    await Query.findByIdAndUpdate(queryRecord._id, {
      status: 'failed',
      errorMessage: err.message,
    });
    throw err;
  }
});

router.post('/evaluate-decision', async (req: Request, res: Response) => {
  const { decision, department, budget, riskTolerance } = req.body;
  if (!decision) {
    return res.status(400).json({ success: false, message: 'Decision description is required' } as ApiResponse);
  }

  const userRoles = req.user!.roles;
  const result = await evaluateDecision(
    req.user!.organizationId.toString(),
    req.user!._id.toString(),
    { decision, department, budget, riskTolerance },
    { accessLevels: getAccessLevelsForRoles(userRoles), roles: userRoles }
  );

  res.json({ success: true, data: result } as ApiResponse);
});

export default router;
