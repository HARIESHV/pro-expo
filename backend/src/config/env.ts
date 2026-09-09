import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Explicitly load backend/.env regardless of cwd (fixes concurrently/root launches where cwd != backend)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
// Fallback: also try process.cwd()/.env and parent .env for other hosting layouts (no override if already set)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

const envSchema = z.object({
  PORT: z.string().default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  // Optional AI provider switches: when set, these override the Groq default.
  AI_PROVIDER: z.enum(['groq', 'openai', 'gemini', 'claude']).optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  EMBEDDING_MODEL: z.string().default('text-embedding-3-large'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  MAX_FILE_SIZE_MB: z.string().default('50'),
  UPLOAD_DIR: z.string().default('./uploads'),
  FRONTEND_DIST: z.string().optional(),
  LOG_LEVEL: z.string().default('info'),
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_MAX: z.string().default('100'),
  VECTOR_SEARCH_INDEX_NAME: z.string().default('enterprise_vector_index'),
  VECTOR_DIMENSIONS: z.string().default('3072'),
  DB_RETRY_ATTEMPTS: z.string().default('6'),
  DB_RETRY_DELAY_MS: z.string().default('15000'),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  ADMIN_EMAIL: z.string().optional(),
  CONTACT_RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  CONTACT_RATE_LIMIT_MAX: z.string().default('5'),
  ADMIN_REPORT_UPLOAD_DIR: z.string().default('./uploads/reports'),
  // Gmail SMTP — used ONLY for user sign-in OTP delivery (never admin auth, never Resend)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  // OTP security
  OTP_EXPIRES_MINUTES: z.string().default('5'),
  OTP_MAX_ATTEMPTS: z.string().default('5'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
