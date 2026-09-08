import mongoose, { Document, Schema } from 'mongoose';

export interface IAnalyticsResult extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  name: string;
  type: 'kpi' | 'trend' | 'comparison' | 'forecast' | 'anomaly' | 'cohort' | 'funnel';
  category: 'sales' | 'finance' | 'hr' | 'operations' | 'customer' | 'custom';
  period: { start: Date; end: Date };
  metrics: Record<string, number | string>;
  dimensions: Record<string, string>;
  data: unknown[];
  insights: string[];
  confidence: number;
  generatedBy: 'ai' | 'scheduled' | 'manual';
  queryId?: mongoose.Types.ObjectId;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const analyticsResultSchema = new Schema<IAnalyticsResult>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ['kpi', 'trend', 'comparison', 'forecast', 'anomaly', 'cohort', 'funnel'],
      required: true,
    },
    category: {
      type: String,
      enum: ['sales', 'finance', 'hr', 'operations', 'customer', 'custom'],
      required: true,
    },
    period: { start: { type: Date, required: true }, end: { type: Date, required: true } },
    metrics: { type: Schema.Types.Mixed, default: {} },
    dimensions: { type: Schema.Types.Mixed, default: {} },
    data: { type: [Schema.Types.Mixed], default: [] },
    insights: { type: [String], default: [] },
    confidence: { type: Number, default: 0.8, min: 0, max: 1 },
    generatedBy: { type: String, enum: ['ai', 'scheduled', 'manual'], default: 'ai' },
    queryId: { type: Schema.Types.ObjectId, ref: 'Query' },
    expiresAt: Date,
  },
  { timestamps: true }
);

analyticsResultSchema.index({ organizationId: 1, type: 1, category: 1 });
analyticsResultSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AnalyticsResult = mongoose.model<IAnalyticsResult>('AnalyticsResult', analyticsResultSchema);
