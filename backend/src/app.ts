import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { env } from './config/env';
import { errorHandler, notFound } from './middleware/errorHandler';
import { logger } from './config/logger';

// Routes
import authRoutes from './routes/auth';
import chatRoutes from './routes/chat';
import documentRoutes from './routes/documents';
import userRoutes from './routes/users';
import analyticsRoutes from './routes/analytics';
import knowledgeGraphRoutes from './routes/knowledgeGraph';
import auditLogRoutes from './routes/auditLogs';
import businessIntelligenceRoutes from './routes/businessIntelligence';
import biRoutes from './routes/bi';
import aiRoutes from './routes/ai';
import reportsRoutes from './routes/reports';
import organizationsRoutes from './routes/organizations';
import risksRoutes from './routes/risks';
import queriesRoutes from './routes/queries';
import searchRoutes from './routes/search';
import companyRoutes from './routes/companies';
import decisionRoutes from './routes/decisions';
import ragRoutes from './routes/rag';
import salesRoutes from './routes/sales';
import customerRoutes from './routes/customers';

const app = express();

// Security
app.use(helmet({ contentSecurityPolicy: false }));

// CLIENT_URL supports a comma-separated list of allowed origins.
// In development, any localhost/127.0.0.1 origin is also accepted so the app
// keeps working when Vite picks a different port (e.g. 5174).
const allowedOrigins = env.CLIENT_URL.split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true); // non-browser clients (curl, Postman)
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (
      env.NODE_ENV !== 'production' &&
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    ) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Compression & parsing
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) },
  skip: (req) => req.path === '/health',
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS, 10),
  max: parseInt(env.RATE_LIMIT_MAX, 10),
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Static uploads
app.use('/uploads', express.static(path.join(process.cwd(), env.UPLOAD_DIR)));

// Health check
app.get('/api/health', (_req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  const aiConfigured = !!env.GROQ_API_KEY;
  res.json({
    status: dbConnected ? 'ok' : 'error',
    database: dbConnected ? 'connected' : 'disconnected',
    ai: aiConfigured ? 'configured' : 'not_configured',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/knowledge-graph', knowledgeGraphRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/business-intelligence', businessIntelligenceRoutes);
app.use('/api/bi', biRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/api/risks', risksRoutes);
app.use('/api/queries', queriesRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/decisions', decisionRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/customers', customerRoutes);

// ---------------------------------------------------------------
// Production single-origin hosting: serve the built frontend from
// this API process and deep-link ALL client routes to index.html so
// browser refreshes on /decision-intelligence?riskId=... etc. always
// render the SPA. In development this is skipped — Vite serves the
// frontend on its own port and proxies /api to this server.
// ---------------------------------------------------------------
const FRONTEND_DIST =
  env.FRONTEND_DIST || path.resolve(__dirname, '..', '..', 'frontend', 'dist');

if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api\/|uploads\/).*/, (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
  logger.info(`💡 Serving frontend build from ${FRONTEND_DIST}`);
} else {
  logger.info(`Frontend build not found at ${FRONTEND_DIST} — API-only mode (use Vite dev server).`);
}

// 404 & error handlers
app.use(notFound);
app.use(errorHandler);

export default app;
