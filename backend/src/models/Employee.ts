import mongoose, { Document, Schema } from 'mongoose';

export interface IEmployee extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  departmentId: mongoose.Types.ObjectId;
  managerId?: mongoose.Types.ObjectId;
  hireDate: Date;
  salary?: number;
  employmentType: 'full_time' | 'part_time' | 'contract' | 'intern';
  status: 'active' | 'inactive' | 'terminated';
  skills: string[];
  location: string;
  performanceScore?: number;
  createdAt: Date;
  updatedAt: Date;
}

const employeeSchema = new Schema<IEmployee>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    employeeId: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    jobTitle: { type: String, required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    managerId: { type: Schema.Types.ObjectId, ref: 'Employee' },
    hireDate: { type: Date, required: true },
    salary: { type: Number, select: false },
    employmentType: { type: String, enum: ['full_time', 'part_time', 'contract', 'intern'], default: 'full_time' },
    status: { type: String, enum: ['active', 'inactive', 'terminated'], default: 'active' },
    skills: { type: [String], default: [] },
    location: { type: String, default: '' },
    performanceScore: { type: Number, min: 0, max: 100 },
  },
  { timestamps: true }
);

employeeSchema.index({ organizationId: 1, employeeId: 1 }, { unique: true });
employeeSchema.index({ organizationId: 1, departmentId: 1 });

export const Employee = mongoose.model<IEmployee>('Employee', employeeSchema);
