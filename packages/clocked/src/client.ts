/**
 * client.ts - Official Clocked API Client.
 *
 * Implements the verified Clocked integration specifications (7 Nov 2026):
 * - Base URL: https://clocked.rezolve.ai/clocked
 * - Endpoints: POST /clocked/decide and POST /clocked/pipeline
 * - Auth: Authorization: Bearer CLOCKED_API_KEY (server-side only)
 * - Idempotency: Idempotency-Key header with a fresh UUID per logical request
 * - Concurrency: Sequential queue (1 in flight request at a time)
 * - Rate Limiting: 429 backoff and retry once with same Idempotency-Key
 * - Request Shape:
 *   {
 *     "text": "<raw job text>",
 *     "steps": [ ... ],
 *     "on_error": "continue"
 *   }
 * - Constraints:
 *   - No top-level "state" key
 *   - No "step" key in steps; uses "endpoint" and "body"
 *   - No "threshold" in Decide body
 *   - Strictly no "model" field anywhere
 */

import crypto from 'crypto';
import {
  ClockedClientConfig,
  ClockedDecideRequest,
  ClockedDecideResponse,
  ClockedDecideResponseSchema,
  ClockedPipelineRequest,
  ClockedPipelineResponse,
  ClockedPipelineResponseSchema,
  ClockedPipelineStep,
  ClockedJobInput,
} from './types';

export const DEFAULT_CLOCKED_BASE_URL = 'https://clocked.rezolve.ai/clocked';
export const DEFAULT_DECIDE_THRESHOLD = 0.75;
export const DEFAULT_RETRY_BACKOFF_MS = 1500;

/**
 * Standard Clocked pipeline steps in verified 7 Nov 2026 shape.
 */
export const CANONICAL_PIPELINE_STEPS: ClockedPipelineStep[] = [
  {
    endpoint: 'injection',
    name: 'guard',
    stop: true,
    body: { return_score: true, score_mode: 'strict' },
  },
  {
    endpoint: 'pii',
    name: 'protect',
    stop: false,
    body: { return_positions: true },
  },
  {
    endpoint: 'extract',
    name: 'extract',
    body: {
      fields: {
        budget_amount: { type: 'number' },
        budget_type: { type: 'string' },
        skills: { type: 'array' },
        deadline: { type: 'string' },
        client_spend: { type: 'number' },
        client_hire_rate: { type: 'number' },
        posted_date: { type: 'string' },
        proposal_count: { type: 'number' },
      },
    },
  },
  {
    endpoint: 'decide',
    name: 'decide',
    body: {
      questions: {
        action: {
          type: 'choice',
          options: ['APPLY', 'APPLY_PLUS_BOOST', 'SKIP'],
          criteria: {
            APPLY:
              'Budget meets the 15 dollar per hour floor, niche is Amazon design, client history is credible, deadline is realistic.',
            APPLY_PLUS_BOOST:
              'All APPLY criteria pass and the job is a strong match, high value, low competition.',
            SKIP: 'Any APPLY criterion fails.',
          },
        },
        budget_meets_floor: {
          type: 'boolean',
          criteria: {
            true: 'Effective hourly rate is at or above 15 dollars per hour.',
            false: 'Effective hourly rate is below 15 dollars per hour.',
          },
        },
      },
    },
  },
  {
    endpoint: 'fill',
    name: 'fill_scorecard',
    body: {
      fields: {
        rate_floor_pass: { type: 'boolean' },
        match_score: { type: 'number' },
        risk_flags: { type: 'array' },
        recommended_action: { type: 'string' },
        confidence: { type: 'number' },
        reason: { type: 'string' },
      },
    },
  },
  {
    endpoint: 'grounding',
    name: 'verify',
    body: {
      claims: [
        'Budget meets floor',
        'Niche matches Amazon design',
        'Client spend as stated',
      ],
    },
  },
];

/**
 * Builds the raw job text representation for the Clocked pipeline.
 */
export function buildRawJobText(job: ClockedJobInput): string {
  const parts: string[] = [];

  if (job.title) {
    parts.push(`Job Title: ${job.title}`);
  }
  if (job.description) {
    parts.push(`Job Description:\n${job.description}`);
  }

  let budgetStr = 'Not Available';
  if (job.budgetType === 'FIXED' && job.budgetAmountFixed !== null) {
    budgetStr = `$${job.budgetAmountFixed} (Fixed)`;
  } else if (job.budgetType === 'HOURLY') {
    const min = job.hourlyRateMin !== null ? `$${job.hourlyRateMin}` : '?';
    const max = job.hourlyRateMax !== null ? `$${job.hourlyRateMax}` : '?';
    budgetStr = `${min} - ${max}/hr (Hourly)`;
  }
  parts.push(`Budget: ${budgetStr}`);

  if (job.clientCountry) {
    parts.push(`Client Country: ${job.clientCountry}`);
  }
  if (job.clientTotalSpend !== null) {
    parts.push(`Client Total Spend: $${job.clientTotalSpend}`);
  }
  if (job.clientHireRate !== null) {
    parts.push(`Client Hire Rate: ${(job.clientHireRate * 100).toFixed(0)}%`);
  }
  if (job.paymentVerified !== null) {
    parts.push(`Payment Method Verified: ${job.paymentVerified ? 'Yes' : 'No'}`);
  }
  if (job.proposalCount !== null) {
    parts.push(`Proposals Count: ${job.proposalCount}`);
  }
  if (job.skills && job.skills.length > 0) {
    parts.push(`Required Skills: ${job.skills.join(', ')}`);
  }
  if (job.postedAt) {
    const postedIso = job.postedAt instanceof Date ? job.postedAt.toISOString() : String(job.postedAt);
    parts.push(`Posted Date: ${postedIso}`);
  }
  if (job.jobUrl) {
    parts.push(`Job URL: ${job.jobUrl}`);
  }

  return parts.join('\n\n');
}

export class ClockedClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  readonly threshold: number;
  private readonly fetchFn: typeof fetch;
  private readonly retryBackoffMs: number;

  // In-memory queue to guarantee sequential requests (no parallel pipeline calls)
  private executionQueue: Promise<unknown> = Promise.resolve();

  constructor(config: ClockedClientConfig = {}) {
    const key = config.apiKey || process.env.CLOCKED_API_KEY;
    this.apiKey = key || '';
    this.baseUrl = (config.baseUrl || process.env.CLOCKED_BASE_URL || DEFAULT_CLOCKED_BASE_URL).replace(/\/+$/, '');
    this.threshold = config.threshold ?? DEFAULT_DECIDE_THRESHOLD;
    this.fetchFn = config.fetchFn || fetch;
    this.retryBackoffMs = config.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS;
  }

  /**
   * Resolve endpoint URL ensuring no duplicate /clocked segments.
   */
  private resolveUrl(endpoint: string): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    if (this.baseUrl.endsWith('/clocked') && cleanEndpoint.startsWith('/clocked/')) {
      const origin = this.baseUrl.slice(0, -'/clocked'.length);
      return `${origin}${cleanEndpoint}`;
    }
    return `${this.baseUrl}${cleanEndpoint}`;
  }

  /**
   * Enforces strict compliance: no "model" field permitted anywhere in any request.
   */
  private assertNoModelField(payload: unknown, path = 'root'): void {
    if (!payload || typeof payload !== 'object') {
      return;
    }
    if (Array.isArray(payload)) {
      payload.forEach((item, index) => this.assertNoModelField(item, `${path}[${index}]`));
      return;
    }
    const record = payload as Record<string, unknown>;
    if ('model' in record) {
      throw new Error(`Clocked API violation: "model" field is strictly forbidden at ${path}.`);
    }
    for (const key of Object.keys(record)) {
      this.assertNoModelField(record[key], `${path}.${key}`);
    }
  }

  /**
   * Queues an operation to run sequentially, ensuring no parallel pipeline calls.
   */
  private runSequential<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.executionQueue.then(fn, fn);
    this.executionQueue = next.catch(() => undefined);
    return next;
  }

  /**
   * Makes an HTTP request with 429 backoff and retry once with same Idempotency-Key.
   */
  private async executeWithRetry(
    targetUrl: string,
    idempotencyKey: string,
    bodyString: string,
  ): Promise<Response> {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      'Idempotency-Key': idempotencyKey,
    };

    let res = await this.fetchFn(targetUrl, {
      method: 'POST',
      headers,
      body: bodyString,
    });

    if (res.status === 429) {
      console.warn(
        `[ClockedClient] Received HTTP 429 (Too Many Requests) for ${targetUrl}. Backing off for ${this.retryBackoffMs}ms and retrying once with same Idempotency-Key...`,
      );

      // Backoff
      await new Promise((resolve) => setTimeout(resolve, this.retryBackoffMs));

      // Retry once with the exact same Idempotency-Key and payload
      res = await this.fetchFn(targetUrl, {
        method: 'POST',
        headers,
        body: bodyString,
      });

      if (res.status === 429) {
        console.warn(`[ClockedClient] Retry also received HTTP 429 for ${targetUrl}. Failing call.`);
      }
    }

    return res;
  }

  /**
   * Execute a POST /clocked/decide call.
   */
  async decide(
    request: ClockedDecideRequest,
    customIdempotencyKey?: string,
  ): Promise<ClockedDecideResponse> {
    if (!this.apiKey) {
      throw new Error('CLOCKED_API_KEY is required to call Clocked decide.');
    }

    this.assertNoModelField(request);

    const payload: ClockedDecideRequest = {
      state: request.state,
      questions: request.questions,
      threshold: request.threshold ?? this.threshold,
    };

    const idempotencyKey = customIdempotencyKey || crypto.randomUUID();
    const targetUrl = this.resolveUrl('/clocked/decide');
    const bodyString = JSON.stringify(payload);

    return this.runSequential(async () => {
      const res = await this.executeWithRetry(targetUrl, idempotencyKey, bodyString);

      if (!res.ok) {
        const errorText = await res.text().catch(() => 'Unable to read response body');
        throw new Error(`Clocked decide failed with HTTP ${res.status}: ${errorText}`);
      }

      const json = (await res.json()) as unknown;
      return ClockedDecideResponseSchema.parse(json);
    });
  }

  /**
   * Execute a POST /clocked/pipeline call with the verified request shape.
   */
  async pipeline(
    request: ClockedPipelineRequest,
    customIdempotencyKey?: string,
  ): Promise<ClockedPipelineResponse> {
    if (!this.apiKey) {
      throw new Error('CLOCKED_API_KEY is required to call Clocked pipeline.');
    }

    this.assertNoModelField(request);

    const idempotencyKey = customIdempotencyKey || crypto.randomUUID();
    const targetUrl = this.resolveUrl('/clocked/pipeline');
    const bodyString = JSON.stringify(request);

    return this.runSequential(async () => {
      const res = await this.executeWithRetry(targetUrl, idempotencyKey, bodyString);

      if (!res.ok) {
        const errorText = await res.text().catch(() => 'Unable to read response body');
        throw new Error(`Clocked pipeline failed with HTTP ${res.status}: ${errorText}`);
      }

      const json = (await res.json()) as unknown;
      return ClockedPipelineResponseSchema.parse(json);
    });
  }

  /**
   * Execute the full 6-step Clocked pipeline for an individual job in a single call.
   */
  async runPipelineForJob(
    job: ClockedJobInput,
    customIdempotencyKey?: string,
  ): Promise<ClockedPipelineResponse> {
    const text = buildRawJobText(job);

    const request: ClockedPipelineRequest = {
      text,
      steps: CANONICAL_PIPELINE_STEPS,
      on_error: 'continue',
    };

    return this.pipeline(request, customIdempotencyKey);
  }
}
