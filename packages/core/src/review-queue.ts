/**
 * review-queue.ts — Module 6: Review Queue State Machine & Rules.
 *
 * SECTION 4, MODULE 6 RULES:
 * 1. Queue states: NEW, FILTERED_OUT, SCORED_PENDING, DRAFT_READY, IN_REVIEW,
 *    APPROVED, SUBMITTED_MANUALLY, SKIPPED, EXPIRED.
 * 2. Editing a draft creates a new version row; never overwrites the old one.
 * 3. APPROVED state indicates Farid approved for manual submission.
 * 4. "Mark as Submitted Manually" button only records that Farid submitted
 *    with his own hands on Upwork.
 * 5. BANNED: Send, Auto Bid, or Submit To Upwork actions do not exist.
 */

export const QUEUE_STATES = [
  'NEW',
  'FILTERED_OUT',
  'SCORED_PENDING',
  'DRAFT_READY',
  'IN_REVIEW',
  'APPROVED',
  'SUBMITTED_MANUALLY',
  'SKIPPED',
  'EXPIRED',
] as const;

export type QueueState = (typeof QUEUE_STATES)[number];

export const ALLOWED_STATE_TRANSITIONS: Record<QueueState, readonly QueueState[]> = {
  NEW: ['FILTERED_OUT', 'SCORED_PENDING', 'SKIPPED'],
  FILTERED_OUT: ['SCORED_PENDING'], // In case a human overrides a filter
  SCORED_PENDING: ['DRAFT_READY', 'SKIPPED'],
  DRAFT_READY: ['IN_REVIEW', 'APPROVED', 'SKIPPED'],
  IN_REVIEW: ['APPROVED', 'SKIPPED', 'DRAFT_READY'],
  APPROVED: ['SUBMITTED_MANUALLY', 'SKIPPED', 'IN_REVIEW'],
  SUBMITTED_MANUALLY: [], // Terminal state for successful submission
  SKIPPED: ['IN_REVIEW', 'DRAFT_READY'], // Human can re-open a skipped job
  EXPIRED: ['IN_REVIEW'],
};

/**
 * Validates whether a state transition is legal.
 */
export function isValidTransition(from: QueueState, to: QueueState): boolean {
  const allowedNext = ALLOWED_STATE_TRANSITIONS[from];
  return allowedNext ? allowedNext.includes(to) : false;
}

/**
 * Count words in a string.
 */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Determine the next draft version number.
 * Ensures strictly increasing integers: 1, 2, 3...
 */
export function getNextDraftVersion(existingDraftVersions: number[]): number {
  if (existingDraftVersions.length === 0) return 1;
  const max = Math.max(...existingDraftVersions);
  return max + 1;
}
