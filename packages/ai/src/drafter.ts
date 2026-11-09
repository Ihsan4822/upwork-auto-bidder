/**
 * drafter.ts — Module 4: Proposal Draft Engine.
 *
 * SECTION 4, MODULE 4 & SECTION 5 RULES:
 * 1. For APPLY and APPLY PLUS BOOST jobs only.
 * 2. Proposal formula in Section 5:
 *    - Hook (first 2 lines): names product/problem, provides mini-plan.
 *    - Proof: calm, factual reference to portfolio sample, no hype.
 *    - Buyer benefits: features rewritten as benefits.
 *    - Question: at most one clear question.
 *    - Call to action: small paid test task.
 *    - Sign-off: "— Farid Malik"
 *    - Length: ~200 words (180–240 words target).
 * 3. Never use unprovable claims: no guarantees, no promised conversion % increases,
 *    no fake clients.
 * 4. Generic template detection: template text with only job title pasted is marked FAILED.
 * 5. Every edit creates a new version, never overwriting older rows.
 */

import { loadPrompt } from './prompt-loader';
import { AiProvider } from './provider';
import { parseDraftOutput } from './schemas/ai-output-schemas';
import type { NormalizedJob } from './job-mapper';
import type { PortfolioItemInput } from './portfolio-matcher';

export interface DraftProposalResult {
  draftText: string;
  wordCount: number;
  status: 'GENERATED' | 'FAILED';
  failureReason: string | null;
  portfolioItemId: string | null;
}

/** Phrases banned by the Safe Proposal Formula (unprovable claims or hype) */
export const BANNED_CLAIM_PHRASES = [
  'guarantee',
  'guaranteed',
  'skyrocket',
  'boost sales by',
  'increase sales by',
  'double your sales',
  '100% satisfaction',
  'proven track record',
  'best on upwork',
  'top rated designer in the world',
] as const;

/**
 * Validates whether a drafted proposal adheres to Farid's factual, hype-free standards.
 */
export function validateProposalClaims(text: string): { valid: boolean; reason: string | null } {
  const lower = text.toLowerCase();

  for (const phrase of BANNED_CLAIM_PHRASES) {
    if (lower.includes(phrase)) {
      return {
        valid: false,
        reason: `Contains unprovable claim or hype phrase: "${phrase}"`,
      };
    }
  }

  // Check if it signs off in Farid Malik's name
  if (!text.includes('Farid Malik')) {
    return {
      valid: false,
      reason: 'Draft missing mandatory sign-off "Farid Malik"',
    };
  }

  // Ensure no "Not Available" placeholder text in draft
  if (text.includes('Not Available')) {
    return {
      valid: false,
      reason: 'Draft must not reference nonexistent samples or contain "Not Available" text',
    };
  }

  return { valid: true, reason: null };
}

/**
 * Count words in a string.
 */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Draft a job-specific proposal using the AI provider and Farid's formula.
 *
 * @param job - Job data
 * @param portfolioItem - Suggested portfolio item
 * @param provider - Configured AI provider
 * @param customTemplate - Optional prompt template (for testing)
 */
export async function draftProposalWithAi(
  job: NormalizedJob,
  portfolioItem: PortfolioItemInput | null,
  provider: AiProvider,
  customTemplate?: string,
): Promise<DraftProposalResult> {
  let promptTemplate = customTemplate;
  if (!promptTemplate) {
    promptTemplate = loadPrompt('draft-proposal.txt');
  }

  // Budget display
  let budgetDisplay = 'Not Available';
  if (job.budgetType === 'FIXED' && job.budgetAmountFixed !== null) {
    budgetDisplay = `$${job.budgetAmountFixed}`;
  } else if (job.budgetType === 'HOURLY') {
    budgetDisplay = `$${job.hourlyRateMin ?? '?'}-$${job.hourlyRateMax ?? '?'}/hr`;
  }

  // Honest portfolio sample display: never invent samples or links if none matched
  let portfolioSection = '';
  let portfolioRule =
    '2. PROOF (1-2 sentences): State your calm, factual design capabilities in this specific niche without referencing nonexistent portfolio samples. Do not invent any sample titles or links, and never write "Not Available".';

  if (portfolioItem && portfolioItem.title && portfolioItem.link) {
    portfolioSection = `Portfolio Sample: "${portfolioItem.title}" - ${portfolioItem.link}`;
    portfolioRule =
      '2. PROOF (1-2 sentences): Reference the portfolio sample above by its exact title. State a calm, factual capability. No invented numbers, no guaranteed conversions, no fake clients.';
  }

  // Fill prompt
  let filledPrompt = promptTemplate
    .replace('{{JOB_TITLE}}', job.title || 'Amazon Design Project')
    .replace('{{JOB_DESCRIPTION}}', job.description || 'Project details on Upwork')
    .replace('{{JOB_BUDGET}}', budgetDisplay)
    .replace('{{CLIENT_COUNTRY}}', job.clientCountry || 'Unspecified')
    .replace('{{PORTFOLIO_SECTION}}', portfolioSection)
    .replace('{{PORTFOLIO_RULE}}', portfolioRule);

  // Backward compatibility for templates using {{PORTFOLIO_TITLE}} / {{PORTFOLIO_LINK}}
  if (filledPrompt.includes('{{PORTFOLIO_TITLE}}')) {
    filledPrompt = filledPrompt
      .replace('{{PORTFOLIO_TITLE}}', portfolioItem ? portfolioItem.title : '')
      .replace('{{PORTFOLIO_LINK}}', portfolioItem ? portfolioItem.link : '');
  }

  const rawDraft = await provider.generateText(filledPrompt);
  const validatedOutput = parseDraftOutput(rawDraft);

  const draftText = validatedOutput.text.replace(/—/g, ' - ');
  const wordCount = countWords(draftText);

  // Check for hype or unprovable claims
  const claimCheck = validateProposalClaims(draftText);

  if (!claimCheck.valid) {
    return {
      draftText,
      wordCount,
      status: 'FAILED',
      failureReason: claimCheck.reason,
      portfolioItemId: portfolioItem?.id ?? null,
    };
  }

  return {
    draftText,
    wordCount,
    status: 'GENERATED',
    failureReason: null,
    portfolioItemId: portfolioItem?.id ?? null,
  };
}
