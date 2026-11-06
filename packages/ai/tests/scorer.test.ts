/**
 * scorer.test.ts — Unit tests for AI job scoring (Module 3).
 *
 * Verifies:
 * - Proper parsing of structured JSON from AI
 * - Zod validation enforcement
 * - Label boundaries: APPLY, APPLY_PLUS_BOOST, SKIP
 * - Score range 0-100
 * - 3 to 5 structured reasons
 */

import { describe, it, expect } from 'vitest';
import { scoreJobWithAi } from '../src/scorer';
import type { AiProvider } from '../src/provider';
import type { NormalizedJob } from '../src/job-mapper';

class MockAiProvider implements AiProvider {
  private readonly responseToReturn: string;

  constructor(responseToReturn: string) {
    this.responseToReturn = responseToReturn;
  }

  async generateText(): Promise<string> {
    return this.responseToReturn;
  }
}

const SAMPLE_JOB: NormalizedJob = {
  upworkJobId: 'job_sample_1',
  title: 'Need Amazon Premium A Plus Content Designer',
  description: 'Design brand story and 7 modules for Amazon US catalog',
  budgetType: 'FIXED',
  budgetAmountFixed: 400,
  hourlyRateMin: null,
  hourlyRateMax: null,
  clientCountry: 'United Kingdom',
  clientTotalSpend: 8000,
  clientHireRate: 0.8,
  paymentVerified: true,
  proposalCount: 3,
  postedAt: new Date(Date.now() - 3600000), // 1 hour ago
  skills: ['Amazon A+ Content', 'Graphic Design'],
  jobUrl: 'https://upwork.com/jobs/1',
};

describe('AI Scoring Engine — Module 3', () => {
  it('parses valid APPLY_PLUS_BOOST output with 4 reasons', async () => {
    const mockJson = JSON.stringify({
      label: 'APPLY_PLUS_BOOST',
      score: 92,
      reasons: [
        'Direct niche match for Amazon Premium A Plus Content',
        'Strong client spend ($8,000) and 80% hire rate with verified payment',
        'Early opportunity with only 3 proposals in the first hour',
        'Fixed budget of $400 exceeds the $100 floor',
      ],
    });

    const provider = new MockAiProvider(mockJson);
    const result = await scoreJobWithAi(SAMPLE_JOB, provider, 'template {{JOB_TITLE}}');

    expect(result.label).toBe('APPLY_PLUS_BOOST');
    expect(result.score).toBe(92);
    expect(result.reasons).toHaveLength(4);
  });

  it('handles JSON wrapped in markdown code blocks', async () => {
    const wrappedJson =
      '```json\n{\n  "label": "APPLY",\n  "score": 78,\n  "reasons": ["Good fit", "Verified payment", "Budget above floor"]\n}\n```';

    const provider = new MockAiProvider(wrappedJson);
    const result = await scoreJobWithAi(SAMPLE_JOB, provider, 'template');

    expect(result.label).toBe('APPLY');
    expect(result.score).toBe(78);
    expect(result.reasons).toHaveLength(3);
  });

  it('throws Zod error if AI returns fewer than 3 reasons', async () => {
    const invalidJson = JSON.stringify({
      label: 'SKIP',
      score: 20,
      reasons: ['Reason 1', 'Reason 2'], // Only 2 reasons!
    });

    const provider = new MockAiProvider(invalidJson);
    await expect(scoreJobWithAi(SAMPLE_JOB, provider, 'template')).rejects.toThrow();
  });

  it('throws Zod error if score is out of 0-100 range', async () => {
    const invalidJson = JSON.stringify({
      label: 'APPLY',
      score: 105, // Out of bounds
      reasons: ['Reason 1', 'Reason 2', 'Reason 3'],
    });

    const provider = new MockAiProvider(invalidJson);
    await expect(scoreJobWithAi(SAMPLE_JOB, provider, 'template')).rejects.toThrow();
  });
});
