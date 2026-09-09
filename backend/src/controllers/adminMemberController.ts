import { Request, Response } from 'express';
import { User } from '../models/User';

export const adminMemberController = {
  async stats(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0,0,0,0);
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0,0,0,0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, active, inactive, totalAll] = await Promise.all([
      User.countDocuments({ organizationId: orgId }),
      User.countDocuments({ organizationId: orgId, status: 'active' }),
      User.countDocuments({ organizationId: orgId, status: { $in: ['inactive','suspended'] } }),
      User.countDocuments({}),
    ]);

    const [newToday, newWeek, newMonth] = await Promise.all([
      User.countDocuments({ organizationId: orgId, createdAt: { $gte: startOfDay } }),
      User.countDocuments({ organizationId: orgId, createdAt: { $gte: startOfWeek } }),
      User.countDocuments({ organizationId: orgId, createdAt: { $gte: startOfMonth } }),
    ]);

    res.json({
      success: true,
      data: {
        totalMembers: total,
        totalActive: active,
        totalInactive: inactive,
        newToday,
        newWeek,
        newMonth,
        totalAll,
      }
    });
  },

  async list(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const { search, status, role, page='1', limit='20', sort='newest' } = req.query as Record<string,string>;
    const filter: any = { organizationId: orgId };
    if (status && status !== 'all') filter.status = status;
    if (role && role !== 'all') filter.roles = role;
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i');
      filter.$or = [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { displayName: regex },
      ];
    }
    const p = parseInt(page,10); const l = parseInt(limit,10);
    const total = await User.countDocuments(filter);
    const data = await User.find(filter)
      .select('firstName lastName email roles status createdAt lastLoginAt isEmailVerified')
      .sort(sort==='oldest' ? { createdAt: 1 } : { createdAt: -1 })
      .skip((p-1)*l).limit(l);
    res.json({ success: true, data, total, page:p, limit:l, totalPages: Math.ceil(total/l) });
  }
};
