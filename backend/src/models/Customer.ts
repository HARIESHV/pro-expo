import mongoose, { Document, Schema } from 'mongoose';

export interface ICustomer extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  customerId: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  industry?: string;
  region: string;
  segment: 'enterprise' | 'mid_market' | 'smb' | 'startup';
  status: 'active' | 'inactive' | 'at_risk' | 'churned';
  lifetimeValue: number;
  acquisitionDate: Date;
  lastInteractionDate?: Date;
  accountManager?: mongoose.Types.ObjectId;
  tags: string[];
  metadata: Record<string, unknown>;
  riskScore: number;
  satisfactionScore?: number;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    customerId: { type: String, required: true },
    name: { type: String, required: true },
    email: String,
    phone: String,
    company: String,
    industry: String,
    region: { type: String, required: true },
    segment: { type: String, enum: ['enterprise', 'mid_market', 'smb', 'startup'], default: 'smb' },
    status: { type: String, enum: ['active', 'inactive', 'at_risk', 'churned'], default: 'active' },
    lifetimeValue: { type: Number, default: 0 },
    acquisitionDate: { type: Date, required: true },
    lastInteractionDate: Date,
    accountManager: { type: Schema.Types.ObjectId, ref: 'User' },
    tags: { type: [String], default: [] },
    metadata: { type: Schema.Types.Mixed, default: {} },
    riskScore: { type: Number, default: 0, min: 0, max: 100 },
    satisfactionScore: { type: Number, min: 0, max: 10 },
  },
  { timestamps: true }
);

customerSchema.index({ organizationId: 1, customerId: 1 }, { unique: true });
customerSchema.index({ organizationId: 1, region: 1 });
customerSchema.index({ organizationId: 1, status: 1 });
customerSchema.index({ name: 'text', company: 'text' });

export const Customer = mongoose.model<ICustomer>('Customer', customerSchema);
