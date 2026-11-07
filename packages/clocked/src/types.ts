/**
 * types.ts - Core types and schemas for the Clocked integration.
 *
 * Verified Clocked API specs (7 Nov 2026):
 * - Base URL: https://clocked.rezolve.ai/clocked
 * - Endpoints: POST /clocked/decide and POST /clocked/pipeline
 * - Auth Header: Authorization: Bearer CLOCKED_API_KEY
 * - Idempotency: Idempotency-Key header with fresh UUID per logical request
 * - Pipeline Request Shape:
 *   {
 *     "text": "<raw job text>",
 *     "steps": [ ... ],
 *     "on_error": "continue"
 *   }
 * - Standalone Decide Request Shape:
 *   {
 *     "state": "<raw job text as a string>",
 *     "questions": {
 *       "action": { "type": "choice", "options": ["APPLY", "APPLY_PLUS_BOOST", "SKIP"], "criteria": { ... } },
 *       "budget_meets_floor": { "type": "boolean", "criteria": { "true": "...", "false": "..." } }
 *     }
 *   }
 * - Constraints:
 *   - Pipeline: Do NOT send top-level "state" key; use "endpoint" and "body" per step
 *   - Decide: "state" is a string; "questions" is an object map
 *   - Do NOT send "threshold" in Decide or Pipeline body (applied client-side from probability)
 *   - Do NOT send "model" field anywhere
 */

import { z } from 'zod';

// -- Client Configuration ---------------------------------------------------

export interface ClockedClientConfig {
  apiKey?: string;
  baseUrl?: string;
  threshold?: number;
  fetchFn?: typeof fetch;
  retryBackoffMs?: number;
}

// -- Guard & Protection Types -----------------------------------------------

export type ClockedGuardSeverity = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface ClockedGuardOutput {
  score?: number;
  is_injection?: boolean;
  injection_detected?: boolean;
  severity?: ClockedGuardSeverity;
  details?: string;
}

export interface ClockedProtectOutput {
  pii_detected?: boolean;
  positions?: Array<{
    start: number;
    end: number;
    type: string;
    value?: string;
  }>;
  entities?: Array<{
    type: string;
    text: string;
  }>;
}

// -- Extraction & Scorecard Types -------------------------------------------

export interface ClockedExtractOutput {
  budget_amount?: number | null;
  budget_type?: string | null;
  skills?: string[] | null;
  deadline?: string | null;
  client_spend?: number | null;
  client_hire_rate?: number | null;
  posted_date?: string | null;
  proposal_count?: number | null;
  [key: string]: unknown;
}

export interface ClockedDecideOutput {
  action?: {
    choice?: ClockedDecisionLabel;
    decision?: ClockedDecisionLabel;
    probability?: number;
    confidence?: number;
    probabilities?: Record<string, number>;
  };
  budget_meets_floor?: {
    result?: boolean;
    probability?: number;
  };
  [key: string]: unknown;
}

export interface ClockedFillOutput {
  rate_floor_pass?: boolean;
  match_score?: number;
  risk_flags?: string[];
  recommended_action?: string;
  confidence?: number;
  reason?: string;
  [key: string]: unknown;
}

export interface ClockedGroundingOutput {
  grounded?: boolean;
  claims?: Array<{
    claim: string;
    grounded: boolean;
    score?: number;
  }>;
  ungrounded_claims?: string[];
  [key: string]: unknown;
}

// -- Pipeline Step Definitions ----------------------------------------------

export interface ClockedStepDef<
  TEndpoint extends string,
  TName extends string,
  TBody extends Record<string, unknown>,
> {
  endpoint: TEndpoint;
  name: TName;
  stop?: boolean;
  body: TBody;
}

export type ClockedStepGuard = ClockedStepDef<
  'injection',
  'guard',
  { return_score: boolean; score_mode: 'strict' | 'standard' }
>;

export type ClockedStepProtect = ClockedStepDef<
  'pii',
  'protect',
  { return_positions: boolean }
>;

export type ClockedStepExtract = ClockedStepDef<
  'extract',
  'extract',
  {
    fields: {
      budget_amount: { type: 'number' };
      budget_type: { type: 'string' };
      skills: { type: 'array' };
      deadline: { type: 'string' };
      client_spend: { type: 'number' };
      client_hire_rate: { type: 'number' };
      posted_date: { type: 'string' };
      proposal_count: { type: 'number' };
    };
  }
>;

export type ClockedStepDecide = ClockedStepDef<
  'decide',
  'decide',
  {
    questions: {
      action: {
        type: 'choice';
        options: Array<'APPLY' | 'APPLY_PLUS_BOOST' | 'SKIP'>;
        criteria: {
          APPLY: string;
          APPLY_PLUS_BOOST: string;
          SKIP: string;
        };
      };
      budget_meets_floor: {
        type: 'boolean';
        criteria: {
          true: string;
          false: string;
        };
      };
    };
  }
>;

export type ClockedStepFill = ClockedStepDef<
  'fill',
  'fill_scorecard',
  {
    fields: {
      rate_floor_pass: { type: 'boolean' };
      match_score: { type: 'number' };
      risk_flags: { type: 'array' };
      recommended_action: { type: 'string' };
      confidence: { type: 'number' };
      reason: { type: 'string' };
    };
  }
>;

export type ClockedStepGrounding = ClockedStepDef<
  'grounding',
  'verify',
  {
    claims: string[];
  }
>;

export type ClockedPipelineStep =
  | ClockedStepGuard
  | ClockedStepProtect
  | ClockedStepExtract
  | ClockedStepDecide
  | ClockedStepFill
  | ClockedStepGrounding;

export interface ClockedPipelineRequest {
  text: string;
  steps: ClockedPipelineStep[];
  on_error: 'continue' | 'stop';
}

// -- Response Step Definitions ----------------------------------------------

export interface ClockedStepResponse<TOutput = Record<string, unknown>> {
  name: string;
  endpoint: string;
  status?: string;
  output?: TOutput;
  data?: TOutput;
  result?: TOutput;
  error?: string;
}

export interface ClockedPipelineResponse {
  steps: Array<ClockedStepResponse<unknown>>;
  credits_used: number;
  status?: string;
  error?: string;
}

// -- Standalone Decide Types (POST /clocked/decide) -------------------------

export type ClockedDecisionLabel = 'APPLY' | 'APPLY_PLUS_BOOST' | 'SKIP';

export interface ClockedDecideQuestionChoice {
  type: 'choice';
  options: string[] | readonly string[];
  criteria: Record<string, string>;
}

export interface ClockedDecideQuestionBoolean {
  type: 'boolean';
  criteria: {
    true: string;
    false: string;
  };
}

export interface ClockedDecideQuestionGeneric {
  type: string;
  options?: string[] | readonly string[];
  criteria?: Record<string, string> | string;
  [key: string]: unknown;
}

export type ClockedDecideQuestionDef =
  | ClockedDecideQuestionChoice
  | ClockedDecideQuestionBoolean
  | ClockedDecideQuestionGeneric;

export type ClockedDecideQuestions = Record<string, ClockedDecideQuestionDef>;

export interface ClockedDecideRequest {
  state: string;
  questions: ClockedDecideQuestions;
}

export interface ClockedDecideResponse {
  decision: ClockedDecisionLabel;
  confidence: number;
  score: number;
  reasons: string[];
  answers?: Record<string, unknown>;
  credits_used: number;
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

export const ClockedDecideResponseSchema = z
  .object({
    decision: ClockedDecisionLabelSchema.optional(),
    confidence: z.number().min(0).max(1).optional(),
    score: z.number().min(0).max(100).optional(),
    reasons: z.array(z.string()).optional(),
    answers: z.record(z.unknown()).optional(),
    credits_used: z.number().nonnegative().optional(),
    usage: z.object({ total_credits: z.number().nonnegative() }).optional(),
  })
  .passthrough();

export const ClockedStepResponseSchema = z.object({
  name: z.string(),
  endpoint: z.string(),
  status: z.string().optional(),
  output: z.unknown().optional(),
  data: z.unknown().optional(),
  result: z.unknown().optional(),
  error: z.string().optional(),
});

export const ClockedPipelineResponseSchema = z.object({
  steps: z.array(ClockedStepResponseSchema),
  credits_used: z.number().nonnegative(),
  status: z.string().optional(),
  error: z.string().optional(),
});
