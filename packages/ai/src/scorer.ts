/**
 * scorer.ts — AI Scoring Engine for Module 3.
 *
 * SECTION 4, MODULE 3 RULES:
 * 1. Score only jobs that pass the hard filters.
 * 2. Output exactly one label: APPLY, APPLY PLUS BOOST, or SKIP.
 * 3. Score from 0 to 100, plus 3 to 5 short reasons.
 * 4. Inputs: niche match, budget against fee floor, client spend and hire rate,
 *    payment verified, proposal count and timing, niche fit.
 * 5. The AI must never invent client facts. If an input is null,
 *    the reason list must say that input was not available.
 * 6. Validates output with Zod schema (C6).
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { AiProvider } from './provider';
import { parseScoreOutput, type JobScoreOutput } from './schemas/ai-output-schemas';
import { NormalizedJob } from './job-mapper';

/**
 * Score a job using the AI provider and validated scoring prompt.
 *
 * @param job - Normalized job data
 * @param provider - Configured AI provider (e.g. Gemini)
 * @param customPromptTemplate - Optional prompt template (for testing)
 * @returns Validated JobScoreOutput containing label, score, and 3-5 reasons
 */
export async function scoreJobWithAi(
  job: NormalizedJob,
  provider: AiProvider,
  customPromptTemplate?: string,
): Promise<JobScoreOutput> {
  let promptTemplate = customPromptTemplate;

  if (!promptTemplate) {
    const promptPath = resolve(__dirname, './prompts/score-job.txt');
    promptTemplate = readFileSync(promptPath, 'utf8');
  }

  // Calculate hours since posted
  let hoursSincePosted = 'Not Available';
  if (job.postedAt) {
    const diffHours = (Date.now() - job.postedAt.getTime()) / (1000 * 60 * 60);
    hoursSincePosted = diffHours >= 0 ? `${diffHours.toFixed(1)} hours ago` : 'Just now';
  }

  // Budget display string
  let budgetDisplay = 'Not Available';
  if (job.budgetType === 'FIXED' && job.budgetAmountFixed !== null) {
    budgetDisplay = `$${job.budgetAmountFixed} (Fixed)`;
  } else if (job.budgetType === 'HOURLY') {
    const min = job.hourlyRateMin !== null ? `$${job.hourlyRateMin}` : '?';
    const max = job.hourlyRateMax !== null ? `$${job.hourlyRateMax}` : '?';
    budgetDisplay = `${min} - ${max}/hr (Hourly)`;
  }

  // Interpolate honest data into prompt
  const filledPrompt = promptTemplate
    .replace('{{JOB_TITLE}}', job.title || 'Not Available')
    .replace('{{JOB_DESCRIPTION}}', job.description || 'Not Available')
    .replace('{{BUDGET_TYPE}}', job.budgetType || 'Not Available')
    .replace('{{JOB_BUDGET}}', budgetDisplay)
    .replace('{{CLIENT_COUNTRY}}', job.clientCountry || 'Not Available')
    .replace('{{CLIENT_TOTAL_SPEND}}', job.clientTotalSpend !== null ? `$${job.clientTotalSpend}` : 'Not Available')
    .replace('{{CLIENT_HIRE_RATE}}', job.clientHireRate !== null ? `${(job.clientHireRate * 100).toFixed(0)}%` : 'Not Available')
    .replace('{{PAYMENT_VERIFIED}}', job.paymentVerified !== null ? (job.paymentVerified ? 'Yes' : 'No') : 'Not Available')
    .replace('{{PROPOSAL_COUNT}}', job.proposalCount !== null ? String(job.proposalCount) : 'Not Available')
    .replace('{{HOURS_SINCE_POSTED}}', hoursSincePosted);

  // Call AI Provider
  const rawResponse = await provider.generateText(filledPrompt);

  // Parse and validate with Zod schema (extract JSON cleanly even if wrapped in markdown blocks)
  let cleanJson = rawResponse.trim();
  if (cleanJson.startsWith('```json')) {
    cleanJson = cleanJson.replace(/^```json/, '').replace(/```$/, '').trim();
  } else if (cleanJson.startsWith('```')) {
    cleanJson = cleanJson.replace(/^```/, '').replace(/```$/, '').trim();
  }

  return parseScoreOutput(cleanJson);
}
