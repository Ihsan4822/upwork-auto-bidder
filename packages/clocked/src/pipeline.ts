/**
 * pipeline.ts - Clocked Job Verification & Safety Routing Engine.
 *
 * SAFETY RULES:
 * 1. If Guard flags injection as high or critical -> route to human review.
 * 2. If Decide confidence is under 0.75 -> route to human review.
 * 3. If Clocked fails -> route to human review.
 * 4. Never auto Apply unverified or flagged jobs.
 * 5. Never present a Gemini-only score as Clocked verified.
 */

import { ClockedClient } from './client';
import { ClockedJobInput, ClockedVerificationResult } from './types';

/**
 * Executes Clocked verification on a single job and applies safety routing.
 *
 * @param job - Job input data
 * @param client - Initialized ClockedClient instance
 * @returns Standardized ClockedVerificationResult with routing verdict and credit usage
 */
export async function verifyJobWithClocked(
  job: ClockedJobInput,
  client: ClockedClient,
): Promise<ClockedVerificationResult> {
  const jobId = job.upworkJobId;

  try {
    const pipelineResponse = await client.runPipelineForJob(job);
    const creditsUsed = pipelineResponse.credits_used ?? 0;

    // Safety Rule 1: Guard prompt injection check
    const guardSeverity = pipelineResponse.guard?.severity ?? 'none';
    const isInjectionHighOrCritical =
      Boolean(pipelineResponse.guard?.injection_detected) &&
      (guardSeverity === 'high' || guardSeverity === 'critical');

    if (isInjectionHighOrCritical) {
      return {
        jobId,
        clockedVerified: false,
        routing: 'HUMAN_REVIEW',
        label: 'SKIP',
        score: pipelineResponse.decide?.score ?? 0,
        confidence: pipelineResponse.decide?.confidence ?? 0,
        reasons: [
          `Clocked Guard: Potential prompt injection flagged with ${guardSeverity} severity.`,
          ...(pipelineResponse.decide?.reasons || []),
        ].slice(0, 5),
        guardSeverity,
        flaggedForHumanReview: true,
        flaggedReason: `Prompt injection attack detected (severity: ${guardSeverity}). Routed to human review.`,
        creditsUsed,
        rawPipelineResponse: pipelineResponse,
      };
    }

    // Safety Rule 2: Decide confidence threshold check (< 0.75)
    const confidence = pipelineResponse.decide?.confidence ?? 0;
    if (confidence < client.threshold) {
      return {
        jobId,
        clockedVerified: false,
        routing: 'HUMAN_REVIEW',
        label: 'SKIP',
        score: pipelineResponse.decide?.score ?? 50,
        confidence,
        reasons: [
          `Clocked Decide: Confidence (${confidence.toFixed(2)}) is below threshold ${client.threshold}.`,
          ...(pipelineResponse.decide?.reasons || []),
        ].slice(0, 5),
        guardSeverity,
        flaggedForHumanReview: true,
        flaggedReason: `Decision confidence ${confidence.toFixed(2)} is below required threshold ${client.threshold}. Routed to human review.`,
        creditsUsed,
        rawPipelineResponse: pipelineResponse,
      };
    }

    // Safety Rule 3: Grounding verification check
    const isGrounded = pipelineResponse.grounding?.grounded ?? true;
    if (!isGrounded) {
      return {
        jobId,
        clockedVerified: false,
        routing: 'HUMAN_REVIEW',
        label: 'SKIP',
        score: pipelineResponse.decide?.score ?? 50,
        confidence,
        reasons: [
          'Clocked Grounding: Scorecard or decision contains ungrounded claims.',
          ...(pipelineResponse.decide?.reasons || []),
        ].slice(0, 5),
        guardSeverity,
        flaggedForHumanReview: true,
        flaggedReason: 'Ungrounded claims detected by Clocked verification. Routed to human review.',
        creditsUsed,
        rawPipelineResponse: pipelineResponse,
      };
    }

    // All safety checks passed: Verified Clocked decision
    return {
      jobId,
      clockedVerified: true,
      routing: 'AUTO_DECISION',
      label: pipelineResponse.decide?.decision || 'SKIP',
      score: pipelineResponse.decide?.score ?? 0,
      confidence,
      reasons: pipelineResponse.decide?.reasons || ['Clocked verified decision.'],
      guardSeverity,
      flaggedForHumanReview: false,
      flaggedReason: null,
      creditsUsed,
      rawPipelineResponse: pipelineResponse,
    };
  } catch (err: unknown) {
    // Safety Rule 4: Clocked failure fallback
    // Never auto Apply and never present Gemini-only score as Clocked verified.
    const errorMessage = err instanceof Error ? err.message : 'Unknown Clocked failure';
    return {
      jobId,
      clockedVerified: false,
      routing: 'HUMAN_REVIEW',
      label: 'SKIP',
      score: 0,
      confidence: 0,
      reasons: [
        `Clocked execution failed: ${errorMessage}`,
        'Routed to human review per safety protocol.',
      ],
      guardSeverity: 'none',
      flaggedForHumanReview: true,
      flaggedReason: `Clocked verification failed (${errorMessage}). Routed to human review.`,
      creditsUsed: 0,
    };
  }
}

/**
 * Explicit helper for Gemini-only fallback scoring.
 * Enforces the rule: NEVER present a Gemini-only score as Clocked verified.
 */
export function createFallbackGeminiVerification(
  jobId: string,
  geminiScore: { label: 'APPLY' | 'APPLY_PLUS_BOOST' | 'SKIP'; score: number; reasons: string[] },
): ClockedVerificationResult {
  return {
    jobId,
    clockedVerified: false, // Strict requirement: Never present Gemini-only as Clocked verified
    routing: 'HUMAN_REVIEW', // Route to human review because Clocked did not verify it
    label: geminiScore.label,
    score: geminiScore.score,
    confidence: 0,
    reasons: [
      ...geminiScore.reasons,
      'Gemini-only evaluation. Clocked safety verification not performed.',
    ].slice(0, 5),
    guardSeverity: 'none',
    flaggedForHumanReview: true,
    flaggedReason: 'Gemini-only score without Clocked verification. Routed to human review.',
    creditsUsed: 0,
  };
}
