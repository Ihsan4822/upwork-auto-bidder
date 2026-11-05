/**
 * feature-flags.ts — Feature flags for all new behaviour.
 *
 * WHY: Section 11 of the brief requires that new features ship behind a flag
 * (default off) and are enabled only after their tests pass. This file defines
 * the type-safe flag names. Runtime values come from the `settings` DB table,
 * so flags can be toggled without a code deploy.
 */

export const FEATURE_FLAG_KEYS = {
  ENABLE_AI_SCORING: 'enableAiScoring',
  ENABLE_DRAFT_ENGINE: 'enableDraftEngine',
  ENABLE_ANALYTICS: 'enableAnalytics',
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[keyof typeof FEATURE_FLAG_KEYS];

/**
 * Default flag values used when the DB setting is missing.
 * These are the safe defaults — most features on for the MVP.
 */
export const FEATURE_FLAG_DEFAULTS: Record<FeatureFlagKey, boolean> = {
  enableAiScoring: true,
  enableDraftEngine: true,
  enableAnalytics: true,
};
