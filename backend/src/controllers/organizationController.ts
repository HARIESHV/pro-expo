import { Request, Response } from 'express';
import { Organization } from '../models/Organization';
import { User } from '../models/User';
import { DocumentModel } from '../models/Document';
import { Query } from '../models/Query';
import { AppError } from '../middleware/errorHandler';
import { ApiResponse } from '../types';
import mongoose from 'mongoose';

export const organizationController = {
  async getCurrentOrganization(req: Request, res: Response): Promise<void> {
    const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);
    
    const [organization, memberCount, documentCount, queryCount] = await Promise.all([
      Organization.findById(orgId),
      User.countDocuments({ organizationId: orgId }),
      DocumentModel.countDocuments({ organizationId: orgId, isDeleted: false }),
      Query.countDocuments({ organizationId: orgId }),
    ]);

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    res.json({
      success: true,
      data: {
        organization,
        stats: {
          memberCount,
          documentCount,
          queryCount,
        },
      },
    } as ApiResponse);
  },

  async getOrganizationMembers(req: Request, res: Response): Promise<void> {
    const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);
    const members = await User.find({ organizationId: orgId })
      .select('firstName lastName email roles status createdAt displayName')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: { members } } as ApiResponse);
  },

  async updateOrganizationSettings(req: Request, res: Response): Promise<void> {
    const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);
    const { name, description, industry, website, settings } = req.body;

    const organization = await Organization.findById(orgId);
    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    // Restrict configuration modifications to administrators
    const userRoles = req.user!.roles;
    if (!userRoles.includes('super_admin')) {
      throw new AppError('Access denied: Admin permissions required', 403);
    }

    if (name) organization.name = name;
    if (description !== undefined) organization.description = description;
    if (industry !== undefined) organization.industry = industry;
    if (website !== undefined) organization.website = website;
    if (settings) {
      organization.settings = {
        ...organization.settings,
        ...settings,
      };
    }

    await organization.save();

    res.json({
      success: true,
      message: 'Organization settings updated successfully',
      data: { organization },
    } as ApiResponse);
  },
};
