/**
 * review-queue.test.ts — Unit tests for Review Queue state transitions & versioning.
 */

import { describe, it, expect } from 'vitest';
import {
  isValidTransition,
  getNextDraftVersion,
} from '../src/review-queue';

describe('Review Queue State Machine — Module 6', () => {
  it('allows transition from DRAFT_READY to IN_REVIEW and APPROVED', () => {
    expect(isValidTransition('DRAFT_READY', 'IN_REVIEW')).toBe(true);
    expect(isValidTransition('DRAFT_READY', 'APPROVED')).toBe(true);
    expect(isValidTransition('DRAFT_READY', 'SKIPPED')).toBe(true);
  });

  it('allows transition from APPROVED to SUBMITTED_MANUALLY', () => {
    expect(isValidTransition('APPROVED', 'SUBMITTED_MANUALLY')).toBe(true);
    expect(isValidTransition('APPROVED', 'IN_REVIEW')).toBe(true);
  });

  it('prohibits illegal transition directly from NEW to SUBMITTED_MANUALLY', () => {
    expect(isValidTransition('NEW', 'SUBMITTED_MANUALLY')).toBe(false);
  });

  it('calculates sequential draft version numbers accurately', () => {
    expect(getNextDraftVersion([])).toBe(1);
    expect(getNextDraftVersion([1])).toBe(2);
    expect(getNextDraftVersion([1, 2, 3])).toBe(4);
  });
});
