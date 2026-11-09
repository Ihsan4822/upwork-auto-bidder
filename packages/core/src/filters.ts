/**
 * filters.ts — Hard filter logic for Module 2.
 *
 * WHY: Section 5 of the brief defines hard filters that run before any AI call.
 * All floor values come from packages/config (never hardcoded here).
 * Failed jobs are stored with a plain-word reason, never deleted silently.
 *
 * CHANGE A FILTER: See README.md → Change Recipe 1.
 * All floor values come from the floors parameter (from the settings DB table).
 *
 * Section D1: Every hard filter has a unit test in packages/core/tests/filters.test.ts
 */

import { matchesNiche } from '@upwork-bidder/config';

/** Input: a job as returned from the Upwork MCP. All fields nullable. */
export interface JobFilterInput {
  upworkJobId: string;
  title: string | null;
  description: string | null;
  budgetType: string | null; // "HOURLY" | "FIXED" | null
  budgetAmountFixed: number | null;
  hourlyRateMax: number | null; // Client's stated hourly max
  clientTotalSpend?: number | null; // Client's lifetime spend on Upwork, null if not returned
  paymentVerified: boolean | null;
}

/** Floor values loaded from the settings DB table. */
export interface FilterFloors {
  hourlyRateFloorUsd: number;
  fixedPriceFloorUsd: number;
}

/**
 * Full criteria loaded from the settings DB table (see /settings/criteria).
 * The extra fields are optional so existing callers that only pass floors
 * keep working with the safe defaults: spend minimum 0 (off), payment
 * verification required, default niche list.
 */
export interface FilterCriteria extends FilterFloors {
  /** Minimum client lifetime spend in USD. 0 means no minimum. */
  clientMinTotalSpendUsd?: number;
  /** When false, the payment-verified check is skipped. Default true. */
  paymentVerifiedRequired?: boolean;
  /** Niche keywords to match. Empty or unset means the default niche list. */
  nicheKeywords?: string[];
}

/** Result of running hard filters on a job. */
export type FilterResult = { passed: true } | { passed: false; reason: FilterFailureReason };

/**
 * Plain-word failure reasons stored in the database.
 * These exact strings appear in the dashboard for Farid to audit.
 */
export type FilterFailureReason =
  | 'Below Fee Floor'
  | 'Budget Too Low'
  | 'Payment Not Verified'
  | 'Outside Niche'
  | 'Missing Budget Information'
  | 'Client Spend Too Low';

/**
 * Run all hard filters on a job. Returns the first failure reason or passes.
 *
 * Order matters: cheapest checks run first to skip expensive ones early.
 *
 * @param job - The job to filter
 * @param criteria - Fee floors and criteria from the settings DB table.
 *   A plain FilterFloors object still works: the extra criteria default to
 *   spend minimum 0 (off), payment verification required, default niches.
 * @returns FilterResult — either passed or failed with a plain-word reason
 */
export function applyHardFilters(job: JobFilterInput, criteria: FilterCriteria): FilterResult {
  const floors: FilterFloors = {
    hourlyRateFloorUsd: criteria.hourlyRateFloorUsd,
    fixedPriceFloorUsd: criteria.fixedPriceFloorUsd,
  };
  const paymentVerifiedRequired = criteria.paymentVerifiedRequired !== false;
  const clientMinTotalSpendUsd =
    typeof criteria.clientMinTotalSpendUsd === 'number' &&
    Number.isFinite(criteria.clientMinTotalSpendUsd)
      ? criteria.clientMinTotalSpendUsd
      : 0;
  const nicheKeywords =
    criteria.nicheKeywords && criteria.nicheKeywords.length > 0
      ? criteria.nicheKeywords
      : undefined;

  // Filter 1: Payment must be verified (unless the user turned the check off)
  // null means the MCP did not return this field — treat as not verified (safe default)
  if (paymentVerifiedRequired && job.paymentVerified !== true) {
    return { passed: false, reason: 'Payment Not Verified' };
  }

  // Filter 2: Niche match — job must be in Farid's niches.
  // Uses the user-configured keyword list when set, else the default list.
  const textToMatch = [job.title ?? '', job.description ?? ''].join(' ');
  if (!matchesNiche(textToMatch, nicheKeywords)) {
    return { passed: false, reason: 'Outside Niche' };
  }

  // Filter 3: Budget type must be known to apply the right floor
  if (!job.budgetType || (job.budgetType !== 'HOURLY' && job.budgetType !== 'FIXED')) {
    return { passed: false, reason: 'Missing Budget Information' };
  }

  // Filter 4: Hourly jobs — reject if client max is missing, NaN, non-finite, or below the floor
  if (job.budgetType === 'HOURLY') {
    if (
      job.hourlyRateMax === null ||
      typeof job.hourlyRateMax !== 'number' ||
      !Number.isFinite(job.hourlyRateMax) ||
      Number.isNaN(job.hourlyRateMax)
    ) {
      return { passed: false, reason: 'Missing Budget Information' };
    }
    if (job.hourlyRateMax < floors.hourlyRateFloorUsd) {
      return { passed: false, reason: 'Below Fee Floor' };
    }
  }

  // Filter 5: Fixed price jobs — reject if budget is missing, NaN, non-finite, or below the floor
  if (job.budgetType === 'FIXED') {
    if (
      job.budgetAmountFixed === null ||
      typeof job.budgetAmountFixed !== 'number' ||
      !Number.isFinite(job.budgetAmountFixed) ||
      Number.isNaN(job.budgetAmountFixed)
    ) {
      return { passed: false, reason: 'Missing Budget Information' };
    }
    if (job.budgetAmountFixed < floors.fixedPriceFloorUsd) {
      return { passed: false, reason: 'Budget Too Low' };
    }
  }

  // Filter 6: Client spend: only when a minimum is set (> 0) and the spend
  // is known. A null spend (not returned by MCP) is not punished.
  if (
    clientMinTotalSpendUsd > 0 &&
    typeof job.clientTotalSpend === 'number' &&
    Number.isFinite(job.clientTotalSpend) &&
    job.clientTotalSpend < clientMinTotalSpendUsd
  ) {
    return { passed: false, reason: 'Client Spend Too Low' };
  }

  return { passed: true };
}
