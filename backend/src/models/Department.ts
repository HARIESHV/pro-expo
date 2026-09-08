import mongoose, { Document, Schema } from 'mongoose';

export interface IDepartment extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  description?: string;
  headId?: mongoose.Types.ObjectId;
  parentDepartmentId?: mongoose.Types.ObjectId;
  budget?: number;
  headcount: number;
  location?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const departmentSchema = new Schema<IDepartment>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    code: { type: String, required: true },
    description: String,
    headId: { type: Schema.Types.ObjectId, ref: 'Employee' },
    parentDepartmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    budget: { type: Number, select: false },
    headcount: { type: Number, default: 0 },
    location: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

departmentSchema.index({ organizationId: 1, code: 1 }, { unique: true });

export const Department = mongoose.model<IDepartment>('Department', departmentSchema);
