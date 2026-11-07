/**
 * pipeline.ts - Clocked Job Verification & Safety Routing Engine.
 *
 * SAFETY RULES:
 * 1. If Guard flags injection as high or critical -> route to human review.
 * 2. If Decide confidence is under 0.75 -> route to human review.
 * 3. If Clocked fails (network error, API error, or retry exhaustion) -> route to human review.
 * 4. Never auto Apply unverified or flagged jobs.
 * 5. Never present a Gemini-only score as Clocked verified.
 */

import { ClockedClient } from './client';
import {
  ClockedJobInput,
  ClockedVerificationResult,
  ClockedStepResponse,
  ClockedGuardOutput,
  ClockedDecideOutput,
  ClockedFillOutput,
  ClockedGroundingOutput,
  ClockedGuardSeverity,
  ClockedDecisionLabel,
} from './types';

/**
 * Extracts payload output from a step response across Clocked naming variants.
 */
function getStepOutput<T>(step?: ClockedStepResponse<unknown>): T | undefined {
  if (!step) return undefined;
  return (step.output ?? step.data ?? step.result) as T | undefined;
}

/**
 * Executes Clocked verification on a single job and applies safety routing.
 *
 * @param job - Standardized Upwork job input
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

    // Locate step responses by step name
    const guardStep = pipelineResponse.steps.find((s) => s.name === 'guard');
    const decideStep = pipelineResponse.steps.find((s) => s.name === 'decide');
    const fillStep = pipelineResponse.steps.find((s) => s.name === 'fill_scorecard');
    const verifyStep = pipelineResponse.steps.find((s) => s.name === 'verify');

    const guardOutput = getStepOutput<ClockedGuardOutput>(guardStep);
    const decideOutput = getStepOutput<ClockedDecideOutput>(decideStep);
    const fillOutput = getStepOutput<ClockedFillOutput>(fillStep);
    const verifyOutput = getStepOutput<ClockedGroundingOutput>(verifyStep);

    // 1. Guard injection evaluation
    let guardSeverity: ClockedGuardSeverity = guardOutput?.severity || 'none';
    const injectionDetected = Boolean(
      guardOutput?.injection_detected ||
      guardOutput?.is_injection ||
      (guardOutput?.score !== undefined && guardOutput.score >= 0.7),
    );

    if (injectionDetected && guardSeverity === 'none') {
      const score = guardOutput?.score ?? 0.8;
      guardSeverity = score >= 0.85 ? 'critical' : 'high';
    }

    const isInjectionHighOrCritical =
      injectionDetected && (guardSeverity === 'high' || guardSeverity === 'critical');

    if (isInjectionHighOrCritical) {
      return {
        jobId,
        clockedVerified: false,
        routing: 'HUMAN_REVIEW',
        label: 'SKIP', // Never auto Apply when injection detected
        score: fillOutput?.match_score ?? 0,
        confidence: decideOutput?.action?.probability ?? 0,
        reasons: [
          `Clocked Guard: Potential prompt injection flagged with ${guardSeverity} severity.`,
          fillOutput?.reason || 'Instruction override detected in job content.',
        ].filter(Boolean),
        guardSeverity,
        flaggedForHumanReview: true,
        flaggedReason: `Prompt injection attack detected (severity: ${guardSeverity}). Routed to human review.`,
        creditsUsed,
        rawPipelineResponse: pipelineResponse,
      };
    }

    // 2. Decide probability & confidence check (Client-side threshold 0.75 enforcement)
    const rawDecision =
      decideOutput?.action?.choice ||
      decideOutput?.action?.decision ||
      (fillOutput?.recommended_action as ClockedDecisionLabel) ||
      'SKIP';

    const decisionLabel: ClockedDecisionLabel =
      rawDecision === 'APPLY_PLUS_BOOST' || rawDecision === 'APPLY' ? rawDecision : 'SKIP';

    const confidence =
      decideOutput?.action?.probability ??
      decideOutput?.action?.confidence ??
      fillOutput?.confidence ??
      0;

    if (confidence < client.threshold) {
      return {
        jobId,
        clockedVerified: false,
        routing: 'HUMAN_REVIEW',
        label: 'SKIP', // Never auto Apply when confidence < 0.75
        score: fillOutput?.match_score ?? Math.round(confidence * 100),
        confidence,
        reasons: [
          `Clocked Decide: Confidence (${confidence.toFixed(2)}) is below threshold ${client.threshold}.`,
          fillOutput?.reason || 'Confidence insufficient for automatic proposal routing.',
        ].filter(Boolean),
        guardSeverity,
        flaggedForHumanReview: true,
        flaggedReason: `Decision confidence ${confidence.toFixed(2)} is below required threshold ${client.threshold}. Routed to human review.`,
        creditsUsed,
        rawPipelineResponse: pipelineResponse,
      };
    }

    // 3. Grounding verification check
    const isGrounded = verifyOutput?.grounded ?? true;
    if (!isGrounded) {
      return {
        jobId,
        clockedVerified: false,
        routing: 'HUMAN_REVIEW',
        label: 'SKIP', // Never auto Apply ungrounded decisions
        score: fillOutput?.match_score ?? 50,
        confidence,
        reasons: [
          'Clocked Grounding: Scorecard or decision contains ungrounded claims.',
          fillOutput?.reason || 'Grounding claim verification failed.',
        ].filter(Boolean),
        guardSeverity,
        flaggedForHumanReview: true,
        flaggedReason: 'Ungrounded claims detected by Clocked verification. Routed to human review.',
        creditsUsed,
        rawPipelineResponse: pipelineResponse,
      };
    }

    // 4. All checks passed cleanly -> Verified Clocked decision
    return {
      jobId,
      clockedVerified: true,
      routing: 'AUTO_DECISION',
      label: decisionLabel,
      score: fillOutput?.match_score ?? Math.round(confidence * 100),
      confidence,
      reasons: [
        fillOutput?.reason || `Clocked verified decision: ${decisionLabel}.`,
        `Decision confidence: ${(confidence * 100).toFixed(0)}%.`,
      ],
      guardSeverity,
      flaggedForHumanReview: false,
      flaggedReason: null,
      creditsUsed,
      rawPipelineResponse: pipelineResponse,
    };
  } catch (err: unknown) {
    // Safety Rule 4: Clocked failure fallback (network error, 429 exhaust, 500 outage)
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
 * Fallback verification for Gemini-only evaluations.
 * Enforces the strict rule: NEVER present a Gemini-only score as Clocked verified.
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
