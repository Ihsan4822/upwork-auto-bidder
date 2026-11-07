/**
 * env.ts - Validates all required environment variables at startup.
 *
 * WHY: Zod validation of env vars catches missing config immediately on boot,
 * not after a user action triggers the broken code path. (Section 7 of brief.)
 *
 * FAILURE MODE: If any required variable is missing, the process exits with a
 * clear error message listing the missing variable. Never silently undefined.
 */

import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid connection string'),
  REDIS_URL: z.string().url('REDIS_URL must be a valid Redis URL'),
  AI_API_KEY: z.string().min(1, 'AI_API_KEY is required'),
  AI_MODEL_NAME: z.string().default('gemini-1.5-pro'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  UPWORK_MCP_URL: z.string().url().default('https://mcp.upwork.com/mcp'),
  OAUTH_TOKEN_ENCRYPTION_KEY: z
    .string()
    .length(64, 'OAUTH_TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)'),
  APP_URL: z.string().url('APP_URL must be a full URL including protocol'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Task A: Login & Session Environment Variables
  LOGIN_ALLOWED_EMAILS: z
    .string()
    .default('farid@example.com')
    .transform((val) =>
      val
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('onboarding@resend.dev'),
  MAGIC_LINK_DEV_LOG: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
  MAGIC_LINK_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  // Clocked Integration (Server-side only)
  CLOCKED_API_KEY: z.string().optional(),
  CLOCKED_BASE_URL: z.string().url().default('https://clocked.rezolve.ai/clocked'),
  CLOCKED_ENABLED: z
    .preprocess((val) => {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') return val.toLowerCase() === 'true' || val === '1';
      return false;
    }, z.boolean())
    .optional()
    .default(false),
});

/**
 * Parsed and validated environment variables.
 * Import this instead of process.env directly.
 *
 * @throws If any required variable is missing or invalid on first import.
 */
export function parseEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:');
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

export type Env = z.infer<typeof envSchema>;
