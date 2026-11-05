/**
 * settings.ts — Single source of truth for all configurable business rules.
 *
 * WHY THIS FILE EXISTS:
 * Section 5 and Section 12 of the brief require that every fee floor, limit,
 * and label live in exactly one place. Changing the hourly floor means editing
 * one constant here, not hunting through filter logic.
 *
 * HOW TO CHANGE A FLOOR:
 * 1. Update the constant below.
 * 2. Update the matching row in the `settings` DB table (see RUNBOOK.md Recipe 1).
 * 3. Run: pnpm test --filter core
 */

// ── Fee Floors ────────────────────────────────────────────────────────────────

/** Minimum hourly rate (USD). Reject a job if the client's max hourly is below this. */
export const HOURLY_RATE_FLOOR_USD = 15;

/** Minimum fixed-price budget (USD). Reject a job if the fixed budget is below this. */
export const FIXED_PRICE_FLOOR_USD = 100;

// ── Poll Settings ─────────────────────────────────────────────────────────────

/** Default polling interval in minutes. Never poll more often than MCP rate limits allow. */
export const DEFAULT_POLL_INTERVAL_MINUTES = 30;

/** Minimum allowed poll interval in minutes. Guards against accidental rate-limit violations. */
export const MIN_POLL_INTERVAL_MINUTES = 15;

// ── Settings Table Keys ───────────────────────────────────────────────────────
// These are the exact key strings used in the `settings` DB table.
// They are referenced by the settings service when loading runtime values.

export const SETTINGS_KEYS = {
  HOURLY_RATE_FLOOR_USD: 'hourlyRateFloorUsd',
  FIXED_PRICE_FLOOR_USD: 'fixedPriceFloorUsd',
  DEFAULT_POLL_INTERVAL_MINUTES: 'defaultPollIntervalMinutes',
} as const;

// ── Draft Settings ────────────────────────────────────────────────────────────

/** Target word count for a proposal draft. The AI is instructed to aim for this. */
export const PROPOSAL_TARGET_WORD_COUNT = 200;

/** Maximum word count. Drafts above this are flagged for review. */
export const PROPOSAL_MAX_WORD_COUNT = 250;
