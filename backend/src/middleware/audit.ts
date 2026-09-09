import { Request, Response, NextFunction } from 'express';
import { AuditLog } from '../models/AuditLog';
import { logger } from '../config/logger';

export const auditMiddleware = (action: string, resource: string) => {
  const SENSITIVE_FIELDS = new Set(['password', 'confirmPassword', 'newPassword', 'currentPassword', 'token', 'accessToken', 'refreshToken', 'otp', 'verificationCode', 'code']);

  function redact(body: unknown): unknown {
    if (!body || typeof body !== 'object') return body;
    const safe: Record<string, unknown> = { ...(body as Record<string, unknown>) };
    for (const key of Object.keys(safe)) {
      if (SENSITIVE_FIELDS.has(key)) safe[key] = '[REDACTED]';
    }
    return safe;
  }

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const originalJson = res.json.bind(res);
    let responseBody: unknown;

    res.json = function (body: unknown) {
      responseBody = body;
      return originalJson(body);
    };

    res.on('finish', async () => {
      try {
        const duration = Date.now() - startTime;
        await AuditLog.create({
          organizationId: req.user?.organizationId,
          userId: req.user?._id,
          action,
          resource,
          resourceId: req.params.id,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
          userAgent: req.headers['user-agent'],
          requestBody: redact(req.body),
          responseBody: process.env.NODE_ENV === 'development' ? responseBody : undefined,
          duration,
          success: res.statusCode < 400,
          metadata: {},
        });
      } catch (error) {
        logger.error('Failed to create audit log:', error);
      }
    });

    next();
  };
};
