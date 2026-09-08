import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import { env } from '../config/env';
import { JWTPayload, UserRole } from '../types';
import { hasPermission, PermissionType } from '../config/permissions';

const isDev = env.NODE_ENV !== 'production';

// Extend Express Request
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: IUser;
      jwtPayload?: JWTPayload;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;

    const user = await User.findById(decoded.userId).select('+refreshTokens');
    if (!user || user.status !== 'active') {
      res.status(401).json({ success: false, message: 'User not found or inactive' });
      return;
    }

    req.user = user;
    req.jwtPayload = decoded;

    if (isDev) {
      const userJson = user.toJSON();
      console.log(`[AUTH] ${req.method} ${req.path} — user: ${user.email}, roles: ${user.roles}, permissions: ${(userJson as any).permissions?.length ?? 0} items`);
    }

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
      return;
    }
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;
      const user = await User.findById(decoded.userId);
      if (user && user.status === 'active') {
        req.user = user;
        req.jwtPayload = decoded;
      }
    }
  } catch {
    // Ignore errors for optional auth
  }
  next();
};

export const requireRoles = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const normalizedUserRoles = req.user.roles.map((r) => r.toLowerCase().trim());
    const hasRole = roles.some((role) => normalizedUserRoles.includes(role.toLowerCase().trim()));
    if (!hasRole) {
      if (isDev) {
        console.log(`[AUTH DENIED] ${req.method} ${req.path} — user roles: [${normalizedUserRoles.join(', ')}], required: [${roles.join(', ')}]`);
      }
      res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${roles.join(', ')}`,
      });
      return;
    }
    next();
  };
};

export const requirePermission = (permission: PermissionType) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const authorized = hasPermission(req.user.roles, permission);
    if (!authorized) {
      if (isDev) {
        console.log(`[AUTH DENIED] ${req.method} ${req.path} — user roles: [${req.user.roles.join(', ')}], required permission: ${permission}`);
      }
      res.status(403).json({
        success: false,
        message: `Access denied. Required permission: ${permission}`,
      });
      return;
    }
    next();
  };
};
