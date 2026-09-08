import mongoose, { Document, Schema } from 'mongoose';

export interface IOrganization extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  industry?: string;
  size?: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
  website?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
  settings: {
    allowedDomains: string[];
    maxUsers: number;
    aiEnabled: boolean;
    vectorSearchEnabled: boolean;
    auditLogRetentionDays: number;
  };
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'inactive' | 'suspended';
  adminUserId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: String,
    logo: String,
    industry: String,
    size: { type: String, enum: ['startup', 'small', 'medium', 'large', 'enterprise'] },
    website: String,
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
    },
    settings: {
      allowedDomains: { type: [String], default: [] },
      maxUsers: { type: Number, default: 100 },
      aiEnabled: { type: Boolean, default: true },
      vectorSearchEnabled: { type: Boolean, default: true },
      auditLogRetentionDays: { type: Number, default: 90 },
    },
    subscriptionTier: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
    status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
    adminUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);


organizationSchema.index({ name: 'text' });

export const Organization = mongoose.model<IOrganization>('Organization', organizationSchema);
