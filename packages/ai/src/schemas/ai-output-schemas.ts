/**
 * schemas.ts — Zod schemas for validating AI model outputs.
 *
 * WHY: Section 7 and C6 of the brief: "Every AI output validated with Zod before
 * it is stored or shown. Invalid AI output is rejected, never trusted."
 *
 * FAILURE MODE: If AI output fails validation, the job is marked as an error,
 * the raw output is logged (server-side only), and the error is surfaced in the
 * dashboard. Never store or display unvalidated AI output.
 */

import { z } from 'zod';

// ── Score Output Schema ───────────────────────────────────────────────────────

export const ScoreLabelSchema = z.enum(['APPLY', 'APPLY_PLUS_BOOST', 'SKIP']);
export type ScoreLabel = z.infer<typeof ScoreLabelSchema>;

export const JobScoreOutputSchema = z.object({
  label: ScoreLabelSchema,
  score: z.number().int().min(0).max(100),
  reasons: z
    .array(z.string().min(1))
    .min(3, 'At least 3 reasons required')
    .max(5, 'At most 5 reasons allowed'),
});

export type JobScoreOutput = z.infer<typeof JobScoreOutputSchema>;

/**
 * Parse and validate raw AI scoring output.
 *
 * @param rawJson - Raw string from the AI model (expected to be JSON)
 * @returns Validated JobScoreOutput
 * @throws ZodError if the output does not match the schema
 */
export function parseScoreOutput(rawJson: string): JobScoreOutput {
  const parsed = JSON.parse(rawJson) as unknown;
  return JobScoreOutputSchema.parse(parsed);
}

// ── Draft Output Schema ───────────────────────────────────────────────────────

export const DraftOutputSchema = z.object({
  text: z
    .string()
    .min(100, 'Draft is too short (minimum 100 characters)')
    .max(2000, 'Draft is too long (maximum 2000 characters)'),
});

export type DraftOutput = z.infer<typeof DraftOutputSchema>;

/**
 * Validate raw AI draft output.
 *
 * @param rawText - Raw text from the AI model
 * @returns Validated DraftOutput
 * @throws ZodError if the output does not match the schema
 */
export function parseDraftOutput(rawText: string): DraftOutput {
  return DraftOutputSchema.parse({ text: rawText.trim() });
}
