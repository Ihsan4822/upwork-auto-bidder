/**
 * analytics.test.ts — Unit tests for Module 7 Basic Analytics.
 *
 * Verifies:
 * - Honest "Not Tracked" output when manual data is missing
 * - Accurate calculation of view and reply rates when manual data exists
 * - App Connects spent is strictly 0
 * - Connects spent reflects sum of Farid's manual entries only
 */

import { describe, it, expect } from 'vitest';
import {
  calculateAnalyticsSummary,
  type AnalyticsSummaryInput,
} from '../src/analytics-service';

describe('Analytics Service — Module 7', () => {
  it('returns "Not Tracked" when no manual view/reply entries exist (honest nulls)', () => {
    const input: AnalyticsSummaryInput = {
      totalJobs: 25,
      filteredOutCount: 15,
      scoredCount: 10,
      draftedCount: 6,
      approvedCount: 4,
      submittedManuallyCount: 3,
      entries: [], // No manual tracking entries
    };

    const result = calculateAnalyticsSummary(input);

    expect(result.viewRateDisplay).toBe('Not Tracked');
    expect(result.replyRateDisplay).toBe('Not Tracked');
    expect(result.connectsSpentTotal).toBe(0);
    expect(result.appConnectsSpent).toBe(0);
  });

  it('calculates correct percentages when Farid enters view and reply status', () => {
    const input: AnalyticsSummaryInput = {
      totalJobs: 20,
      filteredOutCount: 10,
      scoredCount: 10,
      draftedCount: 5,
      approvedCount: 5,
      submittedManuallyCount: 5,
      entries: [
        { clientViewed: true, clientReplied: true, connectsSpent: 12 },
        { clientViewed: true, clientReplied: false, connectsSpent: 16 },
        { clientViewed: false, clientReplied: false, connectsSpent: 8 },
        { clientViewed: null, clientReplied: null, connectsSpent: 10 },
      ],
    };

    const result = calculateAnalyticsSummary(input);

    // 2 out of 3 tracked were viewed = 66.7%
    expect(result.viewRateDisplay).toBe('66.7%');
    // 1 out of 3 tracked replied = 33.3%
    expect(result.replyRateDisplay).toBe('33.3%');
    // Total connects = 12 + 16 + 8 + 10 = 46
    expect(result.connectsSpentTotal).toBe(46);
    // App itself spent 0
    expect(result.appConnectsSpent).toBe(0);
  });
});
