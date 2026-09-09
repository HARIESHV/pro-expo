import mongoose from 'mongoose';
import { SEED_COMPANY_RECORDS } from '../data/companySeed';
import { Company, ICompany } from '../models/Company';
import { logger } from '../config/logger';

/**
 * Returns true only when the MongoDB driver is fully connected (readyState === 1).
 * All database operations MUST call this before proceeding.
 */
function isDbReady(): boolean {
  return mongoose.connection.readyState === 1;
}

/**
 * Reconcile the live `companies` collection indexes with the current schema.
 * Drops stale indexes and creates the schema's indexes. Idempotent and safe
 * to run on every boot.
 */
async function reconcileCompanyIndexes(): Promise<void> {
  if (!isDbReady()) {
    logger.warn('[CompanySeed] Skipping index reconciliation — MongoDB not connected.');
    return;
  }
  try {
    await Company.syncIndexes({ continueOnError: true });
  } catch (err) {
    logger.warn('[CompanySeed] Index reconciliation failed:', err);
  }
}

/**
 * Seed the universal company knowledge base.
 * Idempotent: upserts by the normalized `nameKey` (dedup).
 * Completely safe to call multiple times; never crashes the server.
 */
export async function seedCompanies(): Promise<{ inserted: number; updated: number }> {
  if (!isDbReady()) {
    logger.warn('[CompanySeed] Skipping company seeding — MongoDB not connected.');
    return { inserted: 0, updated: 0 };
  }

  let inserted = 0;
  let updated = 0;

  await reconcileCompanyIndexes();

  for (const record of SEED_COMPANY_RECORDS) {
    const key = record.nameKey;
    if (!key) continue;

    try {
      if (!isDbReady()) {
        logger.warn('[CompanySeed] MongoDB disconnected during seeding — aborting remaining records.');
        break;
      }

      const existing = await Company.findOne({ nameKey: key });
      if (!existing) {
        await Company.create(record);
        inserted++;
        continue;
      }

      const existingConfidence = existing.dataConfidence || 0;
      const incomingConfidence = record.dataConfidence || 0;
      const existingVerified = existing.lastVerifiedAt;
      const recordIsNewerSeed =
        !existingVerified ||
        (record.lastVerifiedAt && record.lastVerifiedAt > existingVerified);

      if (existingConfidence < 0.5 && incomingConfidence >= existingConfidence) {
        await Company.updateOne({ _id: existing._id }, { ...record });
        updated++;
      } else if (recordIsNewerSeed && existingConfidence < incomingConfidence) {
        await Company.updateOne({ _id: existing._id }, { ...record });
        updated++;
      }
    } catch (err) {
      logger.error(`[CompanySeed] Failed to upsert "${record.displayName}":`, err);
    }
  }

  logger.info(`[CompanySeed] Companies seeded: ${inserted} inserted, ${updated} updated.`);
  return { inserted, updated };
}

/**
 * Ensure search indexes exist (idempotent).
 */
export async function syncCompanyIndexes(): Promise<void> {
  if (!isDbReady()) {
    logger.warn('[CompanySeed] Skipping index sync — MongoDB not connected.');
    return;
  }
  try {
    await reconcileCompanyIndexes();
    logger.info('[CompanySeed] Company search indexes synchronized.');
  } catch (err) {
    logger.error('[CompanySeed] Failed to sync indexes:', err);
  }
}

/**
 * Count of companies in the store (used for health/debug).
 */
export async function countCompanies(): Promise<number> {
  if (!isDbReady()) return 0;
  try {
    return await Company.estimatedDocumentCount();
  } catch {
    return 0;
  }
}

export { ICompany };
