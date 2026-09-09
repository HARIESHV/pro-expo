import mongoose from 'mongoose';
import dns from 'dns';
import { env } from './env';
import { logger } from './logger';

// Force Node to use Google DNS for SRV resolution (fixes Windows local DNS bugs)
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {
  logger.warn('Could not set DNS servers', e);
}

const DB_MAX_RETRIES = parseInt(env.DB_RETRY_ATTEMPTS, 10) || 6;
const DB_RETRY_DELAY_MS = parseInt(env.DB_RETRY_DELAY_MS, 10) || 15000;

export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', false);

  // Swallow driver "error" events while the initial connection is still being
  // retried, so we don't spam the log with "Could not connect to any servers..."
  // on every attempt. The retry loop below reports progress concisely. Once a
  // real connection is established, swap in actionable diagnostics. Mongoose
  // auto-reconnects after a transient Atlas pause/resume without a restart.
  const swallowBootstrapErrors = () => {
    /* intentionally ignored during connect retries */
  };
  mongoose.connection.on('error', swallowBootstrapErrors);

  // Retry with backoff so a pausing/resuming Atlas cluster has time to elect a
  // primary before bootstrap gives up. Prevents the whole API from going down.
  let lastError: unknown;
  for (let attempt = 1; attempt <= DB_MAX_RETRIES; attempt++) {
    try {
      await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        retryWrites: true,
        retryReads: true,
      });

      mongoose.connection.removeListener('error', swallowBootstrapErrors);
      mongoose.connection.on('error', (err) => {
        if (mongoose.connection.readyState === 1) {
          logger.error('MongoDB connection error:', err);
        } else {
          logger.warn(`MongoDB connection lost (reconnecting...): ${(err as Error).message?.split('\n')[0] || 'unknown error'}`);
        }
      });
      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected. Attempting to reconnect...');
      });
      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
      });

      logger.info(`✅ MongoDB connected: ${mongoose.connection.host}`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < DB_MAX_RETRIES) {
        logger.warn(
          `MongoDB connection attempt ${attempt}/${DB_MAX_RETRIES} failed (${(error as Error).message?.split('\n')[0] || 'unknown error'}). ` +
            `Retrying in ${Math.round(DB_RETRY_DELAY_MS / 1000)}s...`
        );
        await sleep(DB_RETRY_DELAY_MS);
      }
    }
  }

  if (lastError) {
    const errMsg = (lastError as Error).message ?? String(lastError);
    const isNoPrimary = errMsg.includes('ReplicaSetNoPrimary') || errMsg.includes('Server selection timed out');

    logger.error('❌ MongoDB connection failed after all retry attempts.');
    logger.error('   Possible causes (check in this order):');
    if (isNoPrimary) {
      logger.error('   1. NO PRIMARY NODE — the Atlas replica set has no available primary.');
      logger.error('      → Log in to cloud.mongodb.com → Clusters → check cluster health.');
      logger.error('      → If cluster was paused, click "Resume". Allow 1-2 min for failover.');
      logger.error('      → For M0 free tier, clusters auto-pause after inactivity.');
    } else {
      logger.error('   1. CLUSTER PAUSED — Atlas M0 free clusters pause after inactivity.');
      logger.error('      → Log in to cloud.mongodb.com → Clusters → click "Resume" if paused.');
    }
    logger.error('   2. IP NOT WHITELISTED — your current public IP must be in Network Access.');
    logger.error('      → Atlas → Network Access → Add IP Address → add 0.0.0.0/0 for dev.');
    logger.error('   3. WRONG CREDENTIALS — double-check the username/password in MONGODB_URI.');
    logger.error('   4. NO DATABASE NAME — ensure the URI path contains the DB name,');
    logger.error('      e.g. mongodb+srv://user:pass@cluster.net/enterprise-platform?...');
    logger.error(`   Driver message: ${errMsg.split('\n')[0]}`);
    throw lastError;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected gracefully');
}

// Fixed id shared with the seed script and the frontend demo registration flow
export const DEFAULT_ORGANIZATION_ID = '000000000000000000000001';

/**
 * Idempotently ensures the default organization exists so that self-registration
 * (which references the demo org) works on a fresh database without manual seeding.
 */
export async function ensureDefaultOrganization(): Promise<void> {
  try {
    const { Organization } = await import('../models/Organization');
    const existing = await Organization.findById(DEFAULT_ORGANIZATION_ID);
    if (existing) {
      logger.info('Default organization verified');
      return;
    }
    await Organization.create({
      _id: new mongoose.Types.ObjectId(DEFAULT_ORGANIZATION_ID),
      name: 'Enterprise Inc',
      slug: 'enterprise-inc',
      description: 'Default organization created automatically at startup.',
      status: 'active',
      subscriptionTier: 'enterprise',
    });
    logger.info('Default organization created');
  } catch (error) {
    logger.error('Failed to ensure default organization:', error);
  }
}
