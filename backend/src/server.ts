import dotenv from 'dotenv';
import path from 'path';
// Ensure backend/.env is loaded even when cwd is repo root (concurrently)
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

import http from 'http';
import net from 'net';
import mongoose from 'mongoose';
import { WebSocketServer, WebSocket } from 'ws';
import app from './app';
import { connectDatabase, ensureDefaultOrganization } from './config/database';
import { env } from './config/env';
import { logger } from './config/logger';
import { seedCompanies, syncCompanyIndexes } from './services/companyDataService';
import { isSmtpConfigured } from './services/emailService';

const PORT = parseInt(env.PORT, 10);

async function bootstrap(): Promise<void> {
  // Connect to MongoDB BEFORE the HTTP server starts listening so no API
  // request can be served before the database is ready.
  await connectDatabase();
  await ensureDefaultOrganization();

  const server = http.createServer(app);
  const sockets = new Set<net.Socket>();

  // Track every open connection so we can force-close them on shutdown. Without
  // this, long-lived sockets (e.g. WebSockets / keep-alive) prevent
  // server.close() from ever completing and the port is never released —
  // causing EADDRINUSE on the next dev restart.
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(
        `Port ${PORT} is already in use. Stop the existing backend process before starting a new one. ` +
          `If this happens after a dev restart, the previous process may not have released the socket yet — ` +
          `wait a second and retry.`
      );
    } else {
      logger.error('HTTP server error:', err);
    }
    process.exit(1);
  });

  const wss = new WebSocketServer({ server, path: '/ws' });
  const clients = new Map<string, WebSocket>();

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '/', `http://localhost`);
    const userId = url.searchParams.get('userId') || 'anonymous';
    clients.set(userId, ws);
    logger.info(`WebSocket connected: userId=${userId}`);

    ws.on('close', () => {
      clients.delete(userId);
      logger.info(`WebSocket disconnected: userId=${userId}`);
    });

    ws.on('error', (err) => logger.error('WebSocket error:', err));
    ws.send(JSON.stringify({ type: 'connected', payload: { userId }, timestamp: new Date().toISOString() }));
  });

  // Attach broadcast utility globally so agents can notify connected clients
  (global as unknown as { wsBroadcast: (userId: string, message: unknown) => void }).wsBroadcast = (
    userId: string,
    message: unknown
  ) => {
    const client = clients.get(userId);
    if (client?.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  };

  // Single listen call. Everything above may be created only once.
  server.listen(PORT, '0.0.0.0', async () => {
    const aiConfigured = !!env.GROQ_API_KEY;
    const dbConnected = mongoose.connection.readyState === 1;
    logger.info('------------------------------------');
    logger.info('Enterprise Intelligence Platform API');
    logger.info('------------------------------------');
    logger.info(`Environment: ${env.NODE_ENV}`);
    logger.info(`✅ Backend API running on http://0.0.0.0:${PORT}`);
    logger.info(`MongoDB: ${dbConnected ? 'connected' : 'disconnected'}`);
    logger.info(`Authentication: ready`);
    logger.info(`AI provider: ${aiConfigured ? 'configured (' + env.GROQ_MODEL + ')' : 'not_configured'}`);
    logger.info(`Web search: configured`);
    logger.info(`Contact email: Resend ${env.RESEND_API_KEY && env.RESEND_FROM_EMAIL && env.ADMIN_EMAIL ? 'configured' : 'not_configured'}`);
    if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL || !env.ADMIN_EMAIL) {
      logger.warn('⚠️  Contact form will fail — missing RESEND_API_KEY / RESEND_FROM_EMAIL / ADMIN_EMAIL. Set them in backend/.env and restart.');
    }
    logger.info(`Sign-in OTP email: SMTP ${isSmtpConfigured() ? 'configured' : 'not_configured'}`);
    if (!isSmtpConfigured()) {
      logger.warn('⚠️  Gmail OTP sign-in will fail — missing SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD / SMTP_FROM. Set them in backend/.env and restart.');
    }
    logger.info('------------------------------------');

    if (dbConnected) {
      setTimeout(() => {
        seedCompanies()
          .then((seed) => syncCompanyIndexes().then(() => {
            if (mongoose.connection.readyState === 1) {
              logger.info(`Universal company knowledge base ready (${seed.inserted} new, ${seed.updated} updated).`);
            }
          }))
          .catch((err) => logger.warn('[CompanySeed] Startup company seeding skipped:', err));
      }, 2000);
    } else {
      logger.warn('[CompanySeed] Skipping company seeding — MongoDB not connected.');
    }
  });

  // Graceful shutdown. Closes the HTTP server (and thus releases the port),
  // terminates any lingering sockets/WebSockets, then disconnects MongoDB and
  // exits. A safety timer force-exits if something hangs so a stale process can
  // never hold onto port 5005.
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received. Shutting down gracefully...`);

    const forceExit = setTimeout(() => {
      logger.warn('Shutdown timed out — forcing exit.');
      try {
        wss.clients.forEach((c) => c.terminate());
      } catch {
        /* noop */
      }
      try {
        for (const s of sockets) s.destroy();
      } catch {
        /* noop */
      }
      process.exit(1);
    }, 5000);
    forceExit.unref();

    try {
      wss.clients.forEach((c) => c.close());
    } catch {
      /* noop */
    }

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      try {
        (server as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
      } catch {
        /* noop */
      }
      for (const s of sockets) s.destroy();
      sockets.clear();
      setTimeout(resolve, 2000).unref();
    });

    try {
      const { disconnectDatabase } = await import('./config/database');
      await disconnectDatabase();
    } catch (err) {
      logger.warn('Error while disconnecting MongoDB:', err);
    }

    clearTimeout(forceExit);
    logger.info('Server closed');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error('Unhandled Rejection:', reason));
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  logger.error('Bootstrap failed:', err);
  process.exit(1);
});