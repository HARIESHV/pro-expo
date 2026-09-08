import { Request, Response } from 'express';
import { User } from '../models/User';
import { AppError } from '../middleware/errorHandler';
import { ApiResponse } from '../types';

export const userController = {
  async getUsers(req: Request, res: Response): Promise<void> {
    const { page = 1, limit = 20, search, role } = req.query;
    const filter: Record<string, unknown> = { organizationId: req.user!.organizationId };
    if (search) filter.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
    if (role) filter.roles = role;

    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip((+page - 1) * +limit).limit(+limit),
      User.countDocuments(filter),
    ]);
    res.json({ success: true, data: { users, total, page: +page, limit: +limit } } as ApiResponse);
  },

  async getUser(req: Request, res: Response): Promise<void> {
    const user = await User.findOne({ _id: req.params.id, organizationId: req.user!.organizationId });
    if (!user) throw new AppError('User not found', 404);
    res.json({ success: true, data: { user } } as ApiResponse);
  },

  async updateUser(req: Request, res: Response): Promise<void> {
    const { firstName, lastName, roles, departmentId, isActive } = req.body;
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user!.organizationId },
      { firstName, lastName, roles, departmentId, isActive },
      { new: true }
    );
    if (!user) throw new AppError('User not found', 404);
    res.json({ success: true, data: { user } } as ApiResponse);
  },

  async deleteUser(req: Request, res: Response): Promise<void> {
    await User.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user!.organizationId },
      { isActive: false }
    );
    res.json({ success: true, message: 'User deactivated' } as ApiResponse);
  },
};
