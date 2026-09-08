import mongoose, { Document, Schema } from 'mongoose';

export interface IReport extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  createdById: mongoose.Types.ObjectId;
  title: string;
  type: 'executive' | 'sales' | 'finance' | 'operations';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  parameters: {
    startDate: Date;
    endDate: Date;
    departmentId?: mongoose.Types.ObjectId;
    sources?: string[];
    context?: Record<string, unknown>;
    sections: {
      kpis: boolean;
      trends: boolean;
      risks: boolean;
      aiInsights: boolean;
      recommendations: boolean;
    };
  };
  content: {
    executiveSummary?: string;
    kpis?: Array<{ name: string; value: string; change?: number }>;
    trends?: Array<{ period: string; metric: string; value: number }>;
    risks?: Array<{ title: string; severity: string; status: string }>;
    aiInsights?: string[];
    recommendations?: string[];
    errors?: string[];
    aggregatedData?: Record<string, unknown>;
  };
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = new Schema<IReport>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    type: { type: String, enum: ['executive', 'sales', 'finance', 'operations'], required: true },
    status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending', index: true },
    parameters: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
      sources: { type: [String], default: [] },
      context: { type: Schema.Types.Mixed, default: {} },
      sections: {
        kpis: { type: Boolean, default: true },
        trends: { type: Boolean, default: true },
        risks: { type: Boolean, default: true },
        aiInsights: { type: Boolean, default: true },
        recommendations: { type: Boolean, default: true },
      },
    },
    content: {
      executiveSummary: String,
      kpis: [{ name: String, value: String, change: Number }],
      trends: [{ period: String, metric: String, value: Number }],
      risks: [{ title: String, severity: String, status: String }],
      aiInsights: [String],
      recommendations: [String],
      errors: [String],
      aggregatedData: { type: Schema.Types.Mixed, default: {} },
    },
  },
  { timestamps: true }
);

reportSchema.index({ organizationId: 1, createdAt: -1 });

export const Report = mongoose.model<IReport>('Report', reportSchema);
