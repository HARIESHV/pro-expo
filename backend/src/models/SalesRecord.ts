import mongoose, { Document, Schema } from 'mongoose';

export interface ISalesRecord extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  salesRepId?: mongoose.Types.ObjectId;
  departmentId?: mongoose.Types.ObjectId;
  dealId: string;
  productName: string;
  category: string;
  amount: number;
  currency: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  region: string;
  channel: 'direct' | 'partner' | 'online' | 'reseller';
  stage: 'lead' | 'prospect' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
  closedAt?: Date;
  expectedCloseDate?: Date;
  probability: number;
  period: { year: number; quarter: number; month: number };
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const salesRecordSchema = new Schema<ISalesRecord>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    salesRepId: { type: Schema.Types.ObjectId, ref: 'User' },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    dealId: { type: String, required: true },
    productName: { type: String, required: true },
    category: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number, required: true },
    discount: { type: Number, default: 0, min: 0, max: 100 },
    region: { type: String, required: true },
    channel: { type: String, enum: ['direct', 'partner', 'online', 'reseller'], default: 'direct' },
    stage: {
      type: String,
      enum: ['lead', 'prospect', 'proposal', 'negotiation', 'closed_won', 'closed_lost'],
      default: 'lead',
    },
    closedAt: Date,
    expectedCloseDate: Date,
    probability: { type: Number, default: 0, min: 0, max: 100 },
    period: {
      year: { type: Number, required: true },
      quarter: { type: Number, required: true, min: 1, max: 4 },
      month: { type: Number, required: true, min: 1, max: 12 },
    },
    notes: String,
  },
  { timestamps: true }
);

salesRecordSchema.index({ organizationId: 1, 'period.year': 1, 'period.quarter': 1 });
salesRecordSchema.index({ organizationId: 1, region: 1 });
salesRecordSchema.index({ organizationId: 1, stage: 1 });

export const SalesRecord = mongoose.model<ISalesRecord>('SalesRecord', salesRecordSchema);
