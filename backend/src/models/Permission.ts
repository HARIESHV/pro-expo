import mongoose, { Document, Schema } from 'mongoose';

export interface IPermission extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'execute' | 'manage';
  description: string;
  organizationId: mongoose.Types.ObjectId;
  allowedRoles: string[];
  conditions?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const permissionSchema = new Schema<IPermission>(
  {
    name: { type: String, required: true },
    resource: { type: String, required: true },
    action: {
      type: String,
      required: true,
      enum: ['create', 'read', 'update', 'delete', 'execute', 'manage'],
    },
    description: { type: String, default: '' },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    allowedRoles: { type: [String], default: [] },
    conditions: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

permissionSchema.index({ resource: 1, action: 1, organizationId: 1 }, { unique: true });

export const Permission = mongoose.model<IPermission>('Permission', permissionSchema);
