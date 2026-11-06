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
  paymentVerified: boolean | null;
}

/** Floor values loaded from the settings DB table. */
export interface FilterFloors {
  hourlyRateFloorUsd: number;
  fixedPriceFloorUsd: number;
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
  | 'Missing Budget Information';

/**
 * Run all hard filters on a job. Returns the first failure reason or passes.
 *
 * Order matters: cheapest checks run first to skip expensive ones early.
 *
 * @param job - The job to filter
 * @param floors - Fee floors from the settings DB table
 * @returns FilterResult — either passed or failed with a plain-word reason
 */
export function applyHardFilters(job: JobFilterInput, floors: FilterFloors): FilterResult {
  // Filter 1: Payment must be verified
  // null means the MCP did not return this field — treat as not verified (safe default)
  if (job.paymentVerified !== true) {
    return { passed: false, reason: 'Payment Not Verified' };
  }

  // Filter 2: Niche match — job must be in Farid's niches
  const textToMatch = [job.title ?? '', job.description ?? ''].join(' ');
  if (!matchesNiche(textToMatch)) {
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

  return { passed: true };
}
