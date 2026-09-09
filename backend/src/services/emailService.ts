import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';

/**
 * Gmail SMTP — used ONLY for user sign-in OTP delivery.
 * Admin authentication never uses SMTP, and Resend remains the Contact-page channel.
 */
export function isSmtpConfigured(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASSWORD && env.SMTP_FROM);
}

/**
 * Send the 6-digit sign-in OTP to a Gmail address via the configured SMTP relay.
 * Throws on any SMTP failure so callers can surface a clear "email sending failed"
 * message without leaking credentials.
 */
export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  if (!isSmtpConfigured()) {
    throw new Error('SMTP is not configured for OTP delivery');
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT),
    secure: env.SMTP_SECURE === 'true',
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },
    // Reasonable timeout so a stalled SMTP server maps to a fast, clear failure
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });

  const expiresInMinutes = parseInt(env.OTP_EXPIRES_MINUTES, 10) || 5;

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#0b2545;max-width:520px;margin:0 auto;padding:24px;background:#ffffff;border:1px solid #e6edf3;border-radius:16px;">
      <div style="border-bottom:1px solid #eef2f6;padding-bottom:16px;margin-bottom:20px;">
        <p style="margin:0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#ff6b00;font-weight:700;">Enterprise Intelligence</p>
        <h2 style="margin:8px 0 0;font-size:20px;color:#0b2545;">Your sign-in code</h2>
      </div>
      <p style="margin:0 0 16px;font-size:14px;color:#0b2545;">
        Use the code below to sign in to your account. It expires in
        <strong>${expiresInMinutes} minutes</strong>.
      </p>
      <div style="padding:16px;background:#f8fafc;border:1px solid #eef2f6;border-radius:12px;text-align:center;">
        <span style="font-size:30px;font-weight:700;letter-spacing:0.28em;color:#0b2545;">${otp}</span>
      </div>
      <p style="margin:18px 0 0;font-size:12px;color:#9aa7b5;border-top:1px solid #eef2f6;padding-top:12px;">
        If you didn't request this code, you can safely ignore this email. Never share this code with anyone.
      </p>
    </div>
  `;

  const text = `Your Enterprise Intelligence sign-in code is ${otp}. It expires in ${expiresInMinutes} minutes. If you didn't request this, you can safely ignore this email.`;

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: 'Your Enterprise Intelligence sign-in code',
    html,
    text,
  });

  logger.info(`OTP email sent to ${to} / length ${otp.length}`);
}