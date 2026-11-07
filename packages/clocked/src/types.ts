/**
 * types.ts - Core types and schemas for the Clocked integration.
 *
 * Verified Clocked API specs (7 Nov 2026):
 * - Base URL: https://clocked.rezolve.ai/clocked
 * - Endpoints: POST /clocked/decide and POST /clocked/pipeline
 * - Auth Header: Authorization: Bearer CLOCKED_API_KEY
 * - Idempotency: Idempotency-Key header with fresh UUID per logical request
 * - Rule: No model field in any request.
 */

import { z } from 'zod';

// -- Client Configuration ---------------------------------------------------

export interface ClockedClientConfig {
  apiKey?: string;
  baseUrl?: string;
  threshold?: number;
  fetchFn?: typeof fetch;
}

// -- Guard & Protection Types -----------------------------------------------

export type ClockedGuardSeverity = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface ClockedGuardResult {
  injection_detected: boolean;
  severity: ClockedGuardSeverity;
  details?: string;
}

export interface ClockedProtectResult {
  pii_detected: boolean;
  entities?: Array<{
    type: string;
    text: string;
  }>;
}

// -- Extraction & Scorecard Types -------------------------------------------

export interface ClockedExtractResult {
  budget?: string | number | null;
  skills?: string[];
  deadline?: string | null;
  client_spend?: number | null;
  client_hire_rate?: number | null;
  posted_date?: string | null;
  proposals?: number | null;
  [key: string]: unknown;
}

export interface ClockedScorecardResult {
  score?: number;
  criteria_met?: Record<string, boolean>;
  [key: string]: unknown;
}

export interface ClockedGroundingResult {
  grounded: boolean;
  ungrounded_claims?: string[];
}

// -- Decision Types ---------------------------------------------------------

export type ClockedDecisionLabel = 'APPLY' | 'APPLY_PLUS_BOOST' | 'SKIP';

export interface ClockedDecideQuestion {
  id: string;
  question: string;
  type: 'boolean' | 'score' | 'category' | 'text';
  criteria: string;
}

export interface ClockedDecideRequest {
  state: Record<string, unknown>;
  questions: ClockedDecideQuestion[];
  threshold?: number;
}

export interface ClockedDecideResponse {
  decision: ClockedDecisionLabel;
  confidence: number;
  score: number;
  reasons: string[];
  answers?: Record<string, unknown>;
  credits_used: number;
}

// -- Pipeline Step Definitions ----------------------------------------------

export interface ClockedStepGuard {
  step: 'guard';
  type: 'injection';
}

export interface ClockedStepProtect {
  step: 'protect';
  type: 'pii';
  mode: 'detect_only';
}

export interface ClockedStepExtract {
  step: 'extract';
  fields: string[];
}

export interface ClockedStepDecide {
  step: 'decide';
  threshold: number;
  options: ClockedDecisionLabel[];
  questions: ClockedDecideQuestion[];
}

export interface ClockedStepFillScorecard {
  step: 'fill_scorecard';
}

export interface ClockedStepVerifyGrounding {
  step: 'verify_grounding';
}

export type ClockedPipelineStep =
  | ClockedStepGuard
  | ClockedStepProtect
  | ClockedStepExtract
  | ClockedStepDecide
  | ClockedStepFillScorecard
  | ClockedStepVerifyGrounding;

export interface ClockedPipelineRequest {
  steps: ClockedPipelineStep[];
  state: Record<string, unknown>;
}

export interface ClockedPipelineResponse {
  status: 'SUCCESS' | 'FAILED';
  guard: ClockedGuardResult;
  protect: ClockedProtectResult;
  extract: ClockedExtractResult;
  decide: {
    decision: ClockedDecisionLabel;
    confidence: number;
    score: number;
    reasons: string[];
  };
  scorecard: ClockedScorecardResult;
  grounding: ClockedGroundingResult;
  credits_used: number;
  error?: string;
}

// -- Job Input & Verification Result Types -----------------------------------

export interface ClockedJobInput {
  upworkJobId: string;
  title: string | null;
  description: string | null;
  budgetType: 'HOURLY' | 'FIXED' | null;
  budgetAmountFixed: number | null;
  hourlyRateMin: number | null;
  hourlyRateMax: number | null;
  clientCountry: string | null;
  clientTotalSpend: number | null;
  clientHireRate: number | null;
  paymentVerified: boolean | null;
  proposalCount: number | null;
  postedAt: Date | string | null;
  skills: string[];
  jobUrl: string | null;
}

export interface ClockedVerificationResult {
  jobId: string;
  clockedVerified: boolean;
  routing: 'AUTO_DECISION' | 'HUMAN_REVIEW';
  label: ClockedDecisionLabel;
  score: number;
  confidence: number;
  reasons: string[];
  guardSeverity: ClockedGuardSeverity;
  flaggedForHumanReview: boolean;
  flaggedReason: string | null;
  creditsUsed: number;
  rawPipelineResponse?: ClockedPipelineResponse;
}

// -- Zod Validation Schemas -------------------------------------------------

export const ClockedDecisionLabelSchema = z.enum(['APPLY', 'APPLY_PLUS_BOOST', 'SKIP']);

export const ClockedDecideResponseSchema = z.object({
  decision: ClockedDecisionLabelSchema,
  confidence: z.number().min(0).max(1),
  score: z.number().min(0).max(100),
  reasons: z.array(z.string()).min(1),
  answers: z.record(z.unknown()).optional(),
  credits_used: z.number().nonnegative(),
});

export const ClockedPipelineResponseSchema = z.object({
  status: z.enum(['SUCCESS', 'FAILED']),
  guard: z.object({
    injection_detected: z.boolean(),
    severity: z.enum(['none', 'low', 'medium', 'high', 'critical']),
    details: z.string().optional(),
  }),
  protect: z.object({
    pii_detected: z.boolean(),
    entities: z
      .array(
        z.object({
          type: z.string(),
          text: z.string(),
        }),
      )
      .optional(),
  }),
  extract: z.record(z.unknown()),
  decide: z.object({
    decision: ClockedDecisionLabelSchema,
    confidence: z.number().min(0).max(1),
    score: z.number().min(0).max(100),
    reasons: z.array(z.string()).min(1),
  }),
  scorecard: z.record(z.unknown()),
  grounding: z.object({
    grounded: z.boolean(),
    ungrounded_claims: z.array(z.string()).optional(),
  }),
  credits_used: z.number().nonnegative(),
  error: z.string().optional(),
});
