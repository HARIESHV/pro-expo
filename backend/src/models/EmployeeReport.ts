import mongoose, { Document, Schema } from 'mongoose';

export type EmployeeReportStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'PROCESS_ABORTED';

export interface IEmployeeReport extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  category: string;
  originalFileName: string;
  storedFileName: string;
  filePath: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  submittedBy: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  status: EmployeeReportStatus;
  submittedAt: Date;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  adminComments?: string;
  createdAt: Date;
  updatedAt: Date;
}

const employeeReportSchema = new Schema<IEmployeeReport>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    category: { type: String, required: true, trim: true, maxlength: 100, default: 'general' },
    originalFileName: { type: String, required: true },
    storedFileName: { type: String, required: true },
    filePath: { type: String, required: true },
    fileType: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    status: {
      type: String,
      enum: ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PROCESS_ABORTED'],
      default: 'PENDING_REVIEW',
      index: true,
    },
    submittedAt: { type: Date, default: Date.now, index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    approvedAt: Date,
    rejectedAt: Date,
    rejectionReason: String,
    adminComments: String,
  },
  { timestamps: true }
);

employeeReportSchema.index({ organizationId: 1, status: 1, submittedAt: -1 });
employeeReportSchema.index({ submittedBy: 1, status: 1 });
employeeReportSchema.index({ title: 'text', description: 'text' });

export const EmployeeReport = mongoose.model<IEmployeeReport>('EmployeeReport', employeeReportSchema);
