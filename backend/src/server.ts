import 'dotenv/config';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import app from './app';
import { connectDatabase, ensureDefaultOrganization } from './config/database';
import { env } from './config/env';
import { logger } from './config/logger';
import { seedCompanies, syncCompanyIndexes } from './services/companyDataService';

const PORT = parseInt(env.PORT, 10);

async function bootstrap(): Promise<void> {
  // Connect to MongoDB
  await connectDatabase();
  await ensureDefaultOrganization();

  // Ensure the universal company knowledge base is seeded (idempotent upsert)
  // and search indexes exist, so AI chat / company search work out of the box.
  try {
    const seed = await seedCompanies();
    await syncCompanyIndexes();
    logger.info(`Universal company knowledge base ready (${seed.inserted} new, ${seed.updated} updated).`);
  } catch (err) {
    logger.warn('[CompanySeed] Startup company seeding skipped:', err);
  }

  const server = http.createServer(app);

  // WebSocket server for real-time agent execution updates
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

  server.listen(PORT, () => {
    const aiConfigured = !!env.GROQ_API_KEY;
    logger.info('------------------------------------');
    logger.info('Enterprise Intelligence Platform API');
    logger.info('------------------------------------');
    logger.info(`Environment: ${env.NODE_ENV}`);
    logger.info(`Server: http://localhost:${PORT}`);
    logger.info(`MongoDB: connected`);
    logger.info(`Authentication: ready`);
    logger.info(`AI provider: ${aiConfigured ? 'configured (' + env.GROQ_MODEL + ')' : 'not_configured'}`);
    logger.info(`Web search: configured`);
    logger.info('------------------------------------');
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      const { disconnectDatabase } = await import('./config/database');
      await disconnectDatabase();
      logger.info('Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error('Unhandled Rejection:', reason));
  process.on('uncaughtException', (error) => { logger.error('Uncaught Exception:', error); process.exit(1); });
}

bootstrap().catch((err) => { logger.error('Bootstrap failed:', err); process.exit(1); });
