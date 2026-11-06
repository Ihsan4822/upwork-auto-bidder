/**
 * drafter.test.ts — Unit tests for proposal drafting and claim validation (Module 4).
 *
 * Verifies:
 * - Detects and flags banned hype words ('guarantee', 'skyrocket', etc.)
 * - Requires mandatory Farid Malik sign-off
 * - Correct word count calculation
 * - Draft proposal generation with mock provider
 */

import { describe, it, expect } from 'vitest';
import {
  validateProposalClaims,
  countWords,
  draftProposalWithAi,
} from '../src/drafter';
import type { AiProvider } from '../src/provider';
import type { NormalizedJob } from '../src/job-mapper';
import type { PortfolioItemInput } from '../src/portfolio-matcher';

class MockAiDrafterProvider implements AiProvider {
  private readonly text: string;
  constructor(text: string) {
    this.text = text;
  }
  async generateText(): Promise<string> {
    return this.text;
  }
}

const SAMPLE_JOB: NormalizedJob = {
  upworkJobId: 'job_draft_1',
  title: 'Amazon A Plus Content for Coffee Machine',
  description: 'Need modern A+ modules highlighting key product features',
  budgetType: 'FIXED',
  budgetAmountFixed: 350,
  hourlyRateMin: null,
  hourlyRateMax: null,
  clientCountry: 'Germany',
  clientTotalSpend: 5000,
  clientHireRate: 0.9,
  paymentVerified: true,
  proposalCount: 2,
  postedAt: new Date(),
  skills: ['Amazon A+ Content', 'Listing Images'],
  jobUrl: 'https://upwork.com/jobs/coffee',
};

const SAMPLE_PORTFOLIO: PortfolioItemInput = {
  id: 'p1',
  title: 'Kitchen Appliance A Plus Design',
  nicheTags: ['Amazon A Plus Content'],
  link: 'https://faridmalik.design/coffee',
  isActive: true,
};

const VALID_FORMULA_PROPOSAL = `
For your coffee machine listing, the visual hierarchy needs to highlight the brewing pressure and thermoblock heating before a customer scrolls to the reviews. Here is a mini-plan: 5 custom modules highlighting temperature stability, one-touch cleaning, and counter dimensions.

You can inspect my recent work on a similar kitchen appliance here: Kitchen Appliance A Plus Design (https://faridmalik.design/coffee). The layout follows Amazon’s premium grid guidelines.

This layout gives shoppers fast clarity on technical specs and drives confident purchase decisions.

Would you prefer standard comparison charts or custom branded comparison tables across your machine variants?

I suggest starting with a single test module so you can verify the design direction and visual tone before we build the complete 5-module suite.

— Farid Malik
`.trim();

describe('Proposal Drafting & Formula Validation — Module 4', () => {
  it('validates a correct formula proposal without hype', () => {
    const result = validateProposalClaims(VALID_FORMULA_PROPOSAL);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeNull();
  });

  it('rejects proposals containing unprovable claim "guarantee"', () => {
    const badProposal = VALID_FORMULA_PROPOSAL.replace('drives confident', 'I guarantee you double sales');
    const result = validateProposalClaims(badProposal);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('guarantee');
  });

  it('rejects proposals containing hype phrase "skyrocket"', () => {
    const badProposal = VALID_FORMULA_PROPOSAL.replace('drives confident', 'will skyrocket your brand');
    const result = validateProposalClaims(badProposal);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('skyrocket');
  });

  it('rejects proposals missing the mandatory Farid Malik sign-off', () => {
    const unsigned = VALID_FORMULA_PROPOSAL.replace('— Farid Malik', '— Best Regards');
    const result = validateProposalClaims(unsigned);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Farid Malik');
  });

  it('calculates word count accurately', () => {
    const words = countWords('This sentence has five words.');
    expect(words).toBe(5);
    const count = countWords(VALID_FORMULA_PROPOSAL);
    expect(count).toBeGreaterThan(100);
    expect(count).toBeLessThan(250);
  });

  it('successfully executes draftProposalWithAi with mock provider', async () => {
    const provider = new MockAiDrafterProvider(VALID_FORMULA_PROPOSAL);
    const result = await draftProposalWithAi(SAMPLE_JOB, SAMPLE_PORTFOLIO, provider, 'template');

    expect(result.status).toBe('GENERATED');
    expect(result.failureReason).toBeNull();
    expect(result.portfolioItemId).toBe('p1');
    expect(result.draftText).toContain('Farid Malik');
    expect(result.wordCount).toBeGreaterThan(100);
  });
});
