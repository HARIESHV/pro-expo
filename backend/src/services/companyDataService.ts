import { SEED_COMPANY_RECORDS } from '../data/companySeed';
import { Company, ICompany } from '../models/Company';
import { logger } from '../config/logger';

/**
 * Seed the universal company knowledge base.
 *
 * Idempotent: upserts by the normalized `nameKey` (dedup) so re-runs never
 * create duplicates and never clobber independently-acquired records that have
 * been enriched since the seed. Only low-data-confidence seed records are
 * overwritten by newer seed versions; enriched records are preserved.
 */
/**
 * Reconcile the live `companies` collection indexes with the current schema.
 *
 * Earlier schema versions stored a top-level `companyId` field with a UNIQUE
 * index (`companyId_1`), a NON-unique `nameKey_1`, a legacy text index
 * (`company_text_index`) and many other indexes over fields that no longer
 * exist on the model. After the model migrated, those stale indexes:
 *   - broke seeding with `E11000 duplicate key ... { companyId: null }`,
 *   - blocked the schema's required UNIQUE `nameKey_1` (`IndexKeySpecsConflict`),
 *   - blocked the schema's text index (MongoDB allows only one text index per
 *     collection), leaving `$text` company search broken.
 * `Model.syncIndexes()` drops index specs absent from the schema and creates
 * the schema's indexes; with `Company.autoIndex` disabled the build is fully
 * deterministic here. Idempotent and safe to run on every boot or seed.
 */
async function reconcileCompanyIndexes(): Promise<void> {
  try {
    await Company.syncIndexes({ continueOnError: true });
  } catch (err) {
    logger.warn('[CompanySeed] Index reconciliation failed:', err);
  }
}

export async function seedCompanies(): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  // Clear stale/conflicting indexes from earlier schema versions before
  // inserting, otherwise most seed records fail with E11000 dup key null.
  await reconcileCompanyIndexes();

  for (const record of SEED_COMPANY_RECORDS) {
    const key = record.nameKey;
    if (!key) continue;

    try {
      const existing = await Company.findOne({ nameKey: key });
      if (!existing) {
        await Company.create(record);
        inserted++;
        continue;
      }

      // Only overwrite if we have no better/newer local data.
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
  return Company.estimatedDocumentCount();
}

export { ICompany };
