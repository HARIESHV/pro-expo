import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Resend } from 'resend';
import { env } from '../config/env';
import { logger } from '../config/logger';

const router = Router();

const contactLimiter = rateLimit({
  windowMs: parseInt(env.CONTACT_RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(env.CONTACT_RATE_LIMIT_MAX || '5', 10),
  message: {
    success: false,
    message: 'Too many contact requests. Please try again later.',
    code: 'RATE_LIMITED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const contactSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address')
    .max(254, 'Email is too long'),
  subject: z
    .string({ required_error: 'Subject is required' })
    .trim()
    .min(1, 'Subject is required')
    .max(150, 'Subject must be at most 150 characters'),
  message: z
    .string({ required_error: 'Message is required' })
    .trim()
    .min(1, 'Message is required')
    .max(5000, 'Message must be at most 5000 characters'),
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

router.post('/', contactLimiter, async (req: Request, res: Response) => {
  logger.info('Contact API called');
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_';
      if (!errors[key]) errors[key] = [];
      errors[key].push(issue.message);
    }
    logger.info({ message: 'Contact validation failed', errors });
    res.status(400).json({
      success: false,
      message: 'Please check your input and try again.',
      code: 'VALIDATION_ERROR',
      errors,
    });
    return;
  }

  const { name, email, subject, message } = parsed.data;

  // Safe debugging - never log secrets per spec §13
  const resendConfigured = !!env.RESEND_API_KEY;
  const fromConfigured = !!env.RESEND_FROM_EMAIL;
  const adminConfigured = !!env.ADMIN_EMAIL;
  logger.info(
    `Contact config — RESEND_API_KEY configured: ${resendConfigured}, RESEND_FROM_EMAIL configured: ${fromConfigured}, ADMIN_EMAIL configured: ${adminConfigured}`
  );
  logger.info(`Recipient configured: ${adminConfigured}, Sender configured: ${fromConfigured}`);

  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL || !env.ADMIN_EMAIL) {
    logger.error({
      message: 'Contact endpoint misconfigured: missing required env vars',
      RESEND_API_KEY_configured: resendConfigured,
      RESEND_FROM_EMAIL_configured: fromConfigured,
      ADMIN_EMAIL_configured: adminConfigured,
    });
    res.status(500).json({
      success: false,
      message: 'Unable to send your message right now. Please try again later.',
      code: 'CONTACT_NOT_CONFIGURED',
    });
    return;
  }

  // Validate ADMIN_EMAIL format at runtime (defense against misconfigured env)
  const adminEmailTrimmed = env.ADMIN_EMAIL.trim();
  const fromEmailTrimmed = env.RESEND_FROM_EMAIL.trim();
  // Basic email format check - do not expose value in logs beyond boolean
  const adminEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmailTrimmed);
  if (!adminEmailValid) {
    logger.error({ message: 'Invalid ADMIN_EMAIL format configured', ADMIN_EMAIL_configured: adminConfigured });
    res.status(500).json({
      success: false,
      message: 'Unable to send your message right now. Please try again later.',
      code: 'CONTACT_NOT_CONFIGURED',
    });
    return;
  }

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message);

  const now = new Date();
  const submittedAt = now.toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'long',
    timeZone: 'UTC',
  });

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#0b2545;max-width:640px;margin:0 auto;padding:24px;background:#ffffff;border:1px solid #e6edf3;border-radius:16px;">
      <div style="border-bottom:1px solid #eef2f6;padding-bottom:16px;margin-bottom:20px;">
        <p style="margin:0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#ff6b00;font-weight:700;">Enterprise Intelligence — Contact Form</p>
        <h2 style="margin:8px 0 0;font-size:20px;color:#0b2545;">New contact message</h2>
        <p style="margin:4px 0 0;font-size:12px;color:#718096;">Received ${escapeHtml(submittedAt)} (UTC)</p>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:8px 0;color:#8a99ac;width:140px;vertical-align:top;">Name</td><td style="padding:8px 0;font-weight:600;color:#0b2545;">${safeName}</td></tr>
        <tr><td style="padding:8px 0;color:#8a99ac;vertical-align:top;">Email</td><td style="padding:8px 0;font-weight:600;color:#0b2545;"><a href="mailto:${safeEmail}" style="color:#0b2545;text-decoration:none;">${safeEmail}</a></td></tr>
        <tr><td style="padding:8px 0;color:#8a99ac;vertical-align:top;">Subject</td><td style="padding:8px 0;color:#0b2545;">${safeSubject}</td></tr>
      </table>
      <div style="margin-top:16px;padding:16px;background:#f8fafc;border:1px solid #eef2f6;border-radius:12px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#8a99ac;">Message</p>
        <p style="margin:0;white-space:pre-wrap;word-break:break-word;color:#0b2545;font-size:14px;line-height:1.7;">${safeMessage}</p>
      </div>
      <p style="margin:20px 0 0;font-size:11px;color:#9aa7b5;border-top:1px solid #eef2f6;padding-top:12px;">Reply directly to this email to respond to ${safeName} (${safeEmail}). This message was sent via the Enterprise Intelligence contact form.</p>
    </div>
  `;

  const text = `New contact message — Enterprise Intelligence\nReceived: ${now.toISOString()}\n\nName: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}\n\nReply-To: ${email}`;

  try {
    logger.info('Resend API request started');
    const resend = new Resend(env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: fromEmailTrimmed,
      to: [adminEmailTrimmed],
      replyTo: email,
      subject: `Contact Form: ${subject}`,
      html,
      text,
    });

    if (error) {
      const errObj = error as Record<string, unknown>;
      const statusCode = (errObj as { statusCode?: unknown })?.statusCode;
      const errMessage = String(errObj?.message || '');
      const isTestSenderRestriction = errMessage.includes('You can only send testing emails to your own email address');
      logger.error({
        message: 'Resend failed to send contact email',
        errorName: errObj?.name,
        errorMessage: errObj?.message,
        statusCode,
        errorDetails: error,
        isTestSenderRestriction,
        hint: isTestSenderRestriction
          ? 'FROM is onboarding@resend.dev (test mode) - can only send to account owner email. Verify a domain at resend.com/domains and set RESEND_FROM_EMAIL to you@verifieddomain.com to send to any Gmail.'
          : undefined,
      });
      // Map testing restriction to 403 with clear code for debugging
      const status = statusCode === 403 || isTestSenderRestriction ? 403 : 502;
      const code = isTestSenderRestriction ? 'RESEND_TEST_MODE_RESTRICTION' : 'EMAIL_SEND_FAILED';
      res.status(status).json({
        success: false,
        message: 'Unable to send your message right now. Please try again later.',
        code,
      });
      return;
    }

    const emailId = (data as { id?: string })?.id || 'unknown';
    logger.info(`Resend returned email ID: ${emailId}`);
    logger.info(`Resend response status: queued/sent — id=${emailId}`);
    logger.info(`Contact email sent: id=${emailId} from ${email} subject "${subject}" to ${adminEmailTrimmed} replyTo ${email}`);

    // Optional: verify delivery status via Resend API (non-blocking, safe)
    // This helps diagnose delivered vs bounced without blocking response
    try {
      const retrieved = await resend.emails.get(emailId);
      const lastEvent = (retrieved as unknown as { data?: { last_event?: string } })?.data?.last_event;
      if (lastEvent) {
        logger.info(`Resend email ${emailId} last_event: ${lastEvent}`);
      }
    } catch (retrieveErr) {
      // Non-fatal - just log at debug level
      logger.info(`Could not retrieve Resend email status for ${emailId} (may not be immediately available)`);
    }

    res.json({
      success: true,
      message: "Your message has been sent successfully. We'll get back to you soon.",
      emailId,
    });
  } catch (err) {
    const e = err as Record<string, unknown>;
    logger.error({
      message: 'Contact email exception',
      errorName: (e as { name?: string })?.name,
      errorMessage: (e as { message?: string })?.message,
      stack: (e as { stack?: string })?.stack?.slice(0, 1000),
    });
    res.status(500).json({
      success: false,
      message: 'Unable to send your message right now. Please try again later.',
      code: 'EMAIL_SEND_FAILED',
    });
  }
});

export default router;
