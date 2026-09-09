import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { OneTimePassword } from '../models/OneTimePassword';
import { AppError } from '../middleware/errorHandler';
import { env } from '../config/env';
import { sendOtpEmail } from './emailService';
import { logger } from '../config/logger';

const OTP_EXPIRES_MINUTES = parseInt(env.OTP_EXPIRES_MINUTES, 10) || 5;
const OTP_MAX_ATTEMPTS = parseInt(env.OTP_MAX_ATTEMPTS, 10) || 5;

function assertDbConnected(): void {
  if (mongoose.connection.readyState !== 1) {
    throw new AppError('Database is temporarily unavailable. Please try again shortly.', 503, 'DATABASE_UNAVAILABLE');
  }
}

function generateOtp(): string {
  // CSPRNG-based 6-digit code, zero-padded (e.g. "042913").
  const value = crypto.randomInt(0, 1000000);
  return value.toString().padStart(6, '0');
}

async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, 10);
}

async function compareOtp(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash);
}

/**
 * Generate a fresh OTP for the given Gmail address, store only its hash, and
 * deliver it by SMTP. There is intentionally NO daily/monthly resend or
 * sign-in limit on users — the only controls are OTP expiry and a per-OTP
 * brute-force attempt cap.
 */
export async function requestOtp(email: string): Promise<void> {
  assertDbConnected();

  const otp = generateOtp();
  const otpHash = await hashOtp(otp);

  try {
    // One live, verifiable OTP per address — supersede any previous one so a
    // stale code can never be reused after a new request.
    await OneTimePassword.deleteMany({ email });

    await OneTimePassword.create({
      email,
      otpHash,
      expiresAt: new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000),
      attempts: 0,
      maxAttempts: OTP_MAX_ATTEMPTS,
    });

    await sendOtpEmail(email, otp);
  } catch (err) {
    // Only the hash lives in Mongo; a bcrypt round here is cheap so we just
    // clean up the record on a sending failure and rethrow a safe message.
    await OneTimePassword.deleteMany({ email }).catch(() => undefined);
    if (err instanceof AppError) throw err;
    logger.error({ message: 'Failed to send OTP email', email, error: (err as Error).message });
    throw new AppError('Email sending failed. Please check the address and try again.', 502, 'EMAIL_SEND_FAILED');
  }
}

export interface OtpVerification {
  email: string;
}

/**
 * Verify a submitted OTP for an address. The code is checked by comparing
 * against the stored bcrypt hash, is invalidated immediately on success, and
 * is locked/removed after too many failed attempts (brute-force protection).
 */
export async function verifyOtp(email: string, otp: string): Promise<OtpVerification> {
  assertDbConnected();

  const record = await OneTimePassword.findOne({ email }).sort({ createdAt: -1 });

  if (!record) {
    throw new AppError('Invalid OTP. Please request a new code.', 400, 'INVALID_OTP');
  }

  if (record.usedAt) {
    throw new AppError('This OTP has already been used. Please request a new code.', 400, 'OTP_USED');
  }

  if (Date.now() > record.expiresAt.getTime()) {
    await OneTimePassword.deleteMany({ email }).catch(() => undefined);
    logger.info(`OTP expired for ${email}`);
    throw new AppError('This OTP has expired. Please request a new code.', 400, 'OTP_EXPIRED');
  }

  if (record.attempts >= record.maxAttempts) {
    await OneTimePassword.deleteMany({ email }).catch(() => undefined);
    throw new AppError('Too many incorrect attempts. Please request a new code.', 400, 'OTP_MAX_ATTEMPTS');
  }

  const matches = await compareOtp(otp, record.otpHash);
  if (!matches) {
    await OneTimePassword.findByIdAndUpdate(record._id, { $inc: { attempts: 1 } }).catch(() => undefined);
    throw new AppError('Invalid OTP. Please check the code and try again.', 400, 'INVALID_OTP');
  }

  // Irrevocably invalidate the code so it can never be replayed.
  await OneTimePassword.deleteMany({ email }).catch(() => undefined);
  return { email };
}