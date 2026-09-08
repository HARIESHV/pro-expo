import mongoose, { Document, Schema } from 'mongoose';

export interface ISupportTicket extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  ticketId: string;
  customerId?: mongoose.Types.ObjectId;
  assignedTo?: mongoose.Types.ObjectId;
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  channel: 'email' | 'phone' | 'chat' | 'portal' | 'social';
  resolutionTimeHours?: number;
  satisfactionRating?: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const supportTicketSchema = new Schema<ISupportTicket>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    ticketId: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
    channel: { type: String, enum: ['email', 'phone', 'chat', 'portal', 'social'], default: 'email' },
    resolutionTimeHours: Number,
    satisfactionRating: { type: Number, min: 1, max: 5 },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

supportTicketSchema.index({ organizationId: 1, status: 1 });
supportTicketSchema.index({ organizationId: 1, customerId: 1 });

export const SupportTicket = mongoose.model<ISupportTicket>('SupportTicket', supportTicketSchema);
