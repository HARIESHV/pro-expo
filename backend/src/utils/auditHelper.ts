import { AuditLog } from '../models/AuditLog';
import { Types } from 'mongoose';

export async function createAuditLog(params: {
  organizationId?: Types.ObjectId;
  userId?: Types.ObjectId;
  action: string;
  resource: string;
  resourceId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  ipAddress?: string;
  success?: boolean;
  metadata?: Record<string, unknown>;
}) {
  try {
    await AuditLog.create({
      organizationId: params.organizationId,
      userId: params.userId,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      method: params.method || 'POST',
      path: params.path || '',
      statusCode: params.statusCode || 200,
      ipAddress: params.ipAddress || 'unknown',
      success: params.success ?? true,
      metadata: params.metadata || {},
      userAgent: '',
      duration: 0,
    });
  } catch (e) {
    // audit log failure should not break main flow
    console.error('Failed to create audit log', e);
  }
}
