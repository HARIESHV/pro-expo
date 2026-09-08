import mongoose, { Document, Schema } from 'mongoose';

export interface IProject extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  description?: string;
  managerId: mongoose.Types.ObjectId;
  departmentId: mongoose.Types.ObjectId;
  teamMembers: mongoose.Types.ObjectId[];
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  startDate: Date;
  endDate?: Date;
  budget?: number;
  actualCost?: number;
  completionPercentage: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    code: { type: String, required: true },
    description: String,
    managerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    teamMembers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    status: {
      type: String,
      enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'],
      default: 'planning',
    },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    startDate: { type: Date, required: true },
    endDate: Date,
    budget: Number,
    actualCost: Number,
    completionPercentage: { type: Number, default: 0, min: 0, max: 100 },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

projectSchema.index({ organizationId: 1, code: 1 }, { unique: true });
projectSchema.index({ organizationId: 1, status: 1 });

export const Project = mongoose.model<IProject>('Project', projectSchema);
