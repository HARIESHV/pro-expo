import { Request, Response } from 'express';
import { ApiResponse } from '../types';
import { getAccessLevelsForRoles } from '../config/accessControl';
import {
  evaluateDecision,
  listDecisions,
  getDecision,
  createDecision,
  updateDecision,
  deleteDecision,
  getDecisionRecommendations,
  getDecisionInsights,
} from '../services/decisionService';

export const decisionController = {
  /** GET /api/decisions — list decisions for the org (paginated, filterable). */
  async list(req: Request, res: Response): Promise<void> {
    const { status, department, page, limit } = req.query as Record<string, string | undefined>;
    const data = await listDecisions(req.user!.organizationId.toString(), {
      status,
      department,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.json({ success: true, data } as ApiResponse);
  },

  /** GET /api/decisions/insights — aggregated KPIs, trend, and forecast for the DI landing view. */
  async insights(req: Request, res: Response): Promise<void> {
    const { from, to, department } = req.query as Record<string, string | undefined>;
    const data = await getDecisionInsights(req.user!.organizationId.toString(), { from, to, department });
    res.json({ success: true, data } as ApiResponse);
  },

  /** GET /api/decisions/:id */
  async getOne(req: Request, res: Response): Promise<void> {
    const decision = await getDecision(req.user!.organizationId.toString(), req.params.id);
    if (!decision) {
      res.status(404).json({ success: false, message: 'Decision not found' } as ApiResponse);
      return;
    }
    res.json({ success: true, data: { decision } } as ApiResponse);
  },

  /** POST /api/decisions — create a draft decision manually. */
  async create(req: Request, res: Response): Promise<void> {
    const decision = await createDecision(
      req.user!.organizationId.toString(),
      req.user!._id.toString(),
      req.body || {}
    );
    res.status(201).json({ success: true, data: { decision } } as ApiResponse);
  },

  /** POST /api/decisions/evaluate — run the AI decision simulator + persist. */
  async evaluate(req: Request, res: Response): Promise<void> {
    const { decision, department, budget, riskTolerance } = req.body;
    if (!decision) {
      res.status(400).json({ success: false, message: 'Decision description is required' } as ApiResponse);
      return;
    }
    const userRoles = req.user!.roles;
    const result = await evaluateDecision(
      req.user!.organizationId.toString(),
      req.user!._id.toString(),
      { decision, department, budget, riskTolerance },
      { accessLevels: getAccessLevelsForRoles(userRoles), roles: userRoles }
    );
    res.json({ success: true, data: result } as ApiResponse);
  },

  /** POST /api/decisions/recommendations — AI synthesized recommended actions. */
  async recommendations(req: Request, res: Response): Promise<void> {
    const recommendations = await getDecisionRecommendations(
      req.user!.organizationId.toString()
    );
    res.json({ success: true, data: { recommendations } } as ApiResponse);
  },

  /** PUT /api/decisions/:id — update status/outcome/fields. */
  async update(req: Request, res: Response): Promise<void> {
    const decision = await updateDecision(req.user!.organizationId.toString(), req.params.id, req.body || {});
    if (!decision) {
      res.status(404).json({ success: false, message: 'Decision not found' } as ApiResponse);
      return;
    }
    res.json({ success: true, data: { decision } } as ApiResponse);
  },

  /** DELETE /api/decisions/:id */
  async remove(req: Request, res: Response): Promise<void> {
    const deleted = await deleteDecision(req.user!.organizationId.toString(), req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, message: 'Decision not found' } as ApiResponse);
      return;
    }
    res.json({ success: true, data: { deleted: true } } as ApiResponse);
  },
};