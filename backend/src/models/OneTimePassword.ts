import mongoose, { Document, Schema } from 'mongoose';

export interface IOneTimePassword extends Document {
  email: string;
  otpHash: string;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  usedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const oneTimePasswordSchema = new Schema<IOneTimePassword>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    // Never store the plaintext OTP — only a bcrypt hash.
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    usedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

oneTimePasswordSchema.index({ email: 1, expiresAt: 1 });

export const OneTimePassword = mongoose.model<IOneTimePassword>('OneTimePassword', oneTimePasswordSchema);