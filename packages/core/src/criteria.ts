/**
 * criteria.ts — Job criteria settings for the Criteria Settings page.
 *
 * WHY: Farid sets his own minimums (hourly rate, fixed budget, client spend)
 * and niche keywords in the app at /settings/criteria. The worker reads them
 * from the settings table on every poll cycle, so no restart or code deploy
 * is needed to change them. This module is the single source of truth for
 * the shape, the validation, and the defaults.
 *
 * STORAGE: Each criterion is one row in the `settings` table, keyed by
 * SETTINGS_KEYS (packages/config/src/settings.ts). Numbers are stored as
 * plain strings, booleans as "true"/"false", niche keywords as a JSON array
 * string. See parseStoredCriteria() for the read path.
 */

import { z } from 'zod';
import {
  HOURLY_RATE_FLOOR_USD,
  FIXED_PRICE_FLOOR_USD,
  NICHES_IN_SCOPE,
} from '@upwork-bidder/config';

/**
 * The criteria shape the settings page saves and the worker reads.
 * Validation limits are deliberately generous: they catch typos (a missing
 * decimal, an extra zero) without blocking a deliberate choice. The hourly
 * minimum is NOT blocked from going below Farid's $15/hr Upwork rate; the
 * settings page shows his rate next to the field so he decides knowingly.
 */
export const CriteriaSchema = z.object({
  hourlyRateFloorUsd: z.number().min(0).max(10000),
  fixedPriceFloorUsd: z.number().min(0).max(100000),
  clientMinTotalSpendUsd: z.number().min(0).max(1000000),
  paymentVerifiedRequired: z.boolean(),
  nicheKeywords: z.array(z.string().trim().min(1).max(60)).min(1).max(20),
});

export type JobCriteria = z.infer<typeof CriteriaSchema>;

/** Defaults match the config floors: $15/hr, $100 fixed, no spend minimum. */
export const DEFAULT_JOB_CRITERIA: JobCriteria = {
  hourlyRateFloorUsd: HOURLY_RATE_FLOOR_USD,
  fixedPriceFloorUsd: FIXED_PRICE_FLOOR_USD,
  clientMinTotalSpendUsd: 0,
  paymentVerifiedRequired: true,
  nicheKeywords: [...NICHES_IN_SCOPE],
};

/**
 * Merge stored settings-table values over the defaults, validating each one.
 * A missing, unparsable, or out-of-range stored value falls back to its
 * default instead of breaking the poll cycle.
 *
 * @param stored - Map of settings key to stored string value (or undefined)
 * @returns Validated JobCriteria
 */
export function parseStoredCriteria(
  stored: Record<string, string | undefined>,
): JobCriteria {
  const raw: Record<string, unknown> = { ...DEFAULT_JOB_CRITERIA };

  const hourly = stored.hourlyRateFloorUsd;
  if (hourly !== undefined) {
    const parsed = parseFloat(hourly);
    if (Number.isFinite(parsed)) raw.hourlyRateFloorUsd = parsed;
  }

  const fixed = stored.fixedPriceFloorUsd;
  if (fixed !== undefined) {
    const parsed = parseFloat(fixed);
    if (Number.isFinite(parsed)) raw.fixedPriceFloorUsd = parsed;
  }

  const spend = stored.clientMinTotalSpendUsd;
  if (spend !== undefined) {
    const parsed = parseFloat(spend);
    if (Number.isFinite(parsed)) raw.clientMinTotalSpendUsd = parsed;
  }

  const verified = stored.paymentVerifiedRequired;
  if (verified === 'true') raw.paymentVerifiedRequired = true;
  if (verified === 'false') raw.paymentVerifiedRequired = false;

  const niches = stored.nicheKeywords;
  if (niches !== undefined) {
    try {
      const parsed: unknown = JSON.parse(niches);
      if (Array.isArray(parsed) && parsed.length > 0) {
        raw.nicheKeywords = parsed.filter(
          (item): item is string => typeof item === 'string' && item.trim().length > 0,
        );
      }
    } catch {
      // Unparsable stored niches: keep the default list.
    }
  }

  const validated = CriteriaSchema.safeParse(raw);
  if (!validated.success) {
    return { ...DEFAULT_JOB_CRITERIA };
  }
  return validated.data;
}

/**
 * Serialize a validated criteria object into settings-table key/value pairs
 * for upsert. Niche keywords are stored as a JSON array string.
 */
export function criteriaToStoredPairs(criteria: JobCriteria): Record<string, string> {
  return {
    hourlyRateFloorUsd: String(criteria.hourlyRateFloorUsd),
    fixedPriceFloorUsd: String(criteria.fixedPriceFloorUsd),
    clientMinTotalSpendUsd: String(criteria.clientMinTotalSpendUsd),
    paymentVerifiedRequired: criteria.paymentVerifiedRequired ? 'true' : 'false',
    nicheKeywords: JSON.stringify(criteria.nicheKeywords),
  };
}
