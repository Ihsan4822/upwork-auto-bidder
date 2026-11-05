/**
 * analytics-service.ts — Module 7: Basic Analytics Service.
 *
 * SECTION 4, MODULE 7 RULES:
 * 1. Simple counts only: jobs found, filtered out, scored, drafted, approved,
 *    submitted manually, viewed, replied, connects spent.
 * 2. View rate and reply rate show percentages ONLY from data Farid entered manually.
 *    If no manual data exists, display "Not Tracked", NEVER an estimate or guess.
 * 3. Connects spent shows ONLY Farid's manual entries.
 *    The app itself spends zero Connects, always.
 */

export interface AnalyticsSummaryInput {
  totalJobs: number;
  filteredOutCount: number;
  scoredCount: number;
  draftedCount: number;
  approvedCount: number;
  submittedManuallyCount: number;
  entries: Array<{
    clientViewed: boolean | null;
    clientReplied: boolean | null;
    connectsSpent: number | null;
  }>;
}

export interface AnalyticsSummaryResult {
  totalJobs: number;
  filteredOutCount: number;
  scoredCount: number;
  draftedCount: number;
  approvedCount: number;
  submittedManuallyCount: number;
  connectsSpentTotal: number;
  totalWithViewTracked: number;
  totalWithReplyTracked: number;
  viewCount: number;
  replyCount: number;
  viewRateDisplay: string; // e.g. "45.0%" or "Not Tracked"
  replyRateDisplay: string; // e.g. "20.0%" or "Not Tracked"
  appConnectsSpent: 0; // Strictly always zero
}

/**
 * Calculates honest analytics metrics with "Not Tracked" fallbacks.
 *
 * @param input - Pipeline counts and manual analytics entries
 * @returns AnalyticsSummaryResult
 */
export function calculateAnalyticsSummary(input: AnalyticsSummaryInput): AnalyticsSummaryResult {
  let connectsSpentTotal = 0;
  let totalWithViewTracked = 0;
  let totalWithReplyTracked = 0;
  let viewCount = 0;
  let replyCount = 0;

  for (const entry of input.entries) {
    if (typeof entry.connectsSpent === 'number' && entry.connectsSpent > 0) {
      connectsSpentTotal += entry.connectsSpent;
    }

    if (entry.clientViewed !== null) {
      totalWithViewTracked++;
      if (entry.clientViewed === true) {
        viewCount++;
      }
    }

    if (entry.clientReplied !== null) {
      totalWithReplyTracked++;
      if (entry.clientReplied === true) {
        replyCount++;
      }
    }
  }

  // Calculate view rate: requires at least one manual entry tracking viewed status
  let viewRateDisplay = 'Not Tracked';
  if (totalWithViewTracked > 0) {
    const rate = (viewCount / totalWithViewTracked) * 100;
    viewRateDisplay = `${rate.toFixed(1)}%`;
  }

  // Calculate reply rate: requires at least one manual entry tracking reply status
  let replyRateDisplay = 'Not Tracked';
  if (totalWithReplyTracked > 0) {
    const rate = (replyCount / totalWithReplyTracked) * 100;
    replyRateDisplay = `${rate.toFixed(1)}%`;
  }

  return {
    totalJobs: input.totalJobs,
    filteredOutCount: input.filteredOutCount,
    scoredCount: input.scoredCount,
    draftedCount: input.draftedCount,
    approvedCount: input.approvedCount,
    submittedManuallyCount: input.submittedManuallyCount,
    connectsSpentTotal,
    totalWithViewTracked,
    totalWithReplyTracked,
    viewCount,
    replyCount,
    viewRateDisplay,
    replyRateDisplay,
    appConnectsSpent: 0,
  };
}
