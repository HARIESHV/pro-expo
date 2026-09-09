import mongoose, { Document, Schema } from 'mongoose';
import { UserRole } from '../types';

export interface IRole extends Document {
  _id: mongoose.Types.ObjectId;
  name: UserRole;
  displayName: string;
  description: string;
  organizationId: mongoose.Types.ObjectId;
  permissions: string[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<IRole>(
  {
    name: {
      type: String,
      required: true,
      enum: ['super_admin', 'admin', 'ceo', 'manager', 'employee', 'analyst', 'hr', 'finance', 'sales'],
    },
    displayName: { type: String, required: true },
    description: { type: String, default: '' },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    permissions: { type: [String], default: [] },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true }
);

roleSchema.index({ name: 1, organizationId: 1 }, { unique: true });

export const Role = mongoose.model<IRole>('Role', roleSchema);
