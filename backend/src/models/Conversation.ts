import mongoose, { Document, Schema } from 'mongoose';

export interface IConversation extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  userId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  isActive: boolean;
  queryCount: number;
  lastMessageAt?: Date;
  metadata: {
    agentsUsed: string[];
    totalTokens: number;
    avgConfidence: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    title: { type: String, default: 'New Conversation' },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    isActive: { type: Boolean, default: true },
    queryCount: { type: Number, default: 0 },
    lastMessageAt: Date,
    metadata: {
      agentsUsed: { type: [String], default: [] },
      totalTokens: { type: Number, default: 0 },
      avgConfidence: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export const Conversation = mongoose.model<IConversation>('Conversation', conversationSchema);
