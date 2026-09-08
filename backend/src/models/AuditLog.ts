import mongoose, { Document, Schema } from 'mongoose';

export interface IAuditLog extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  action: string;
  resource: string;
  resourceId?: string;
  method: string;
  path: string;
  statusCode: number;
  ipAddress: string;
  userAgent?: string;
  requestBody?: Record<string, unknown>;
  responseBody?: Record<string, unknown>;
  duration: number;
  success: boolean;
  errorMessage?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    action: { type: String, required: true, index: true },
    resource: { type: String, required: true },
    resourceId: String,
    method: { type: String, required: true },
    path: { type: String, required: true },
    statusCode: { type: Number, required: true },
    ipAddress: { type: String, required: true },
    userAgent: String,
    requestBody: { type: Schema.Types.Mixed },
    responseBody: { type: Schema.Types.Mixed },
    duration: { type: Number, required: true },
    success: { type: Boolean, required: true },
    errorMessage: String,
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    // Never update audit logs
    strict: true,
  }
);

auditLogSchema.index({ organizationId: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, resource: 1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
