/**
 * client.ts - Official Clocked API Client.
 *
 * Implements the verified Clocked integration specifications (7 Nov 2026):
 * - Base URL: https://clocked.rezolve.ai/clocked
 * - Endpoints: POST /clocked/decide and POST /clocked/pipeline
 * - Auth: Authorization: Bearer CLOCKED_API_KEY (server-side only)
 * - Idempotency: Idempotency-Key header with a fresh UUID per logical request
 * - Mandatory rule: No model field in any request.
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

/**
 * Standard Clocked pipeline steps in required order:
 * 1. Guard injection
 * 2. Protect pii detect only
 * 3. Extract budget, skills, deadline, client spend, hire rate, posted date, proposals
 * 4. Decide Apply / Apply plus Boost / Skip with threshold 0.75
 * 5. Fill scorecard
 * 6. Verify grounding
 */
export const CANONICAL_PIPELINE_STEPS: ClockedPipelineStep[] = [
  {
    step: 'guard',
    type: 'injection',
  },
  {
    step: 'protect',
    type: 'pii',
    mode: 'detect_only',
  },
  {
    step: 'extract',
    fields: [
      'budget',
      'skills',
      'deadline',
      'client_spend',
      'client_hire_rate',
      'posted_date',
      'proposals',
    ],
  },
  {
    step: 'decide',
    threshold: DEFAULT_DECIDE_THRESHOLD,
    options: ['APPLY', 'APPLY_PLUS_BOOST', 'SKIP'],
    questions: [
      {
        id: 'q_niche_scope',
        question: 'Does this job match Farid Malik core Amazon A+ and listing design niches?',
        type: 'boolean',
        criteria:
          'Must be Amazon A+ Content, Premium A+, Listing Images, Storefront Design, Brand Story, Infographics, or Packaging Design.',
      },
      {
        id: 'q_fee_floor',
        question: 'Does the job satisfy the compensation floor ($15/hr or $100 fixed)?',
        type: 'boolean',
        criteria: 'Hourly rate max >= $15/hr or fixed price budget >= $100.',
      },
      {
        id: 'q_client_safety',
        question: 'Does client history show payment verification or positive hire history?',
        type: 'boolean',
        criteria: 'Client payment verified, reasonable hire rate, or verified spend history.',
      },
      {
        id: 'q_proposal_strategy',
        question: 'Which proposal action is recommended?',
        type: 'category',
        criteria:
          'APPLY_PLUS_BOOST if high budget ($500+ or $40+/hr) and exact niche fit. APPLY for standard fit. SKIP if out of scope or below floor.',
      },
    ],
  },
  {
    step: 'fill_scorecard',
  },
  {
    step: 'verify_grounding',
  },
];

export class ClockedClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  readonly threshold: number;
  private readonly fetchFn: typeof fetch;

  constructor(config: ClockedClientConfig = {}) {
    const key = config.apiKey || process.env.CLOCKED_API_KEY;
    if (!key) {
      // Allow instantiating without key in test/offline environments if fetchFn is provided,
      // but warn or require for production calls.
      this.apiKey = '';
    } else {
      this.apiKey = key;
    }

    this.baseUrl = (config.baseUrl || process.env.CLOCKED_BASE_URL || DEFAULT_CLOCKED_BASE_URL).replace(/\/+$/, '');
    this.threshold = config.threshold ?? DEFAULT_DECIDE_THRESHOLD;
    this.fetchFn = config.fetchFn || fetch;
  }

  /**
   * Resolve endpoint URL ensuring no duplicate /clocked segments.
   */
  private resolveUrl(endpoint: string): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    // If base URL is https://clocked.rezolve.ai/clocked and endpoint is /clocked/decide,
    // prevent https://clocked.rezolve.ai/clocked/clocked/decide.
    if (this.baseUrl.endsWith('/clocked') && cleanEndpoint.startsWith('/clocked/')) {
      const origin = this.baseUrl.slice(0, -'/clocked'.length);
      return `${origin}${cleanEndpoint}`;
    }
    return `${this.baseUrl}${cleanEndpoint}`;
  }

  /**
   * Enforces strict compliance: no "model" field permitted in any request.
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

    this.assertNoModelField(payload);

    const idempotencyKey = customIdempotencyKey || crypto.randomUUID();
    const targetUrl = this.resolveUrl('/clocked/decide');

    const res = await this.fetchFn(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unable to read response body');
      throw new Error(`Clocked decide failed with HTTP ${res.status}: ${errorText}`);
    }

    const json = (await res.json()) as unknown;
    return ClockedDecideResponseSchema.parse(json);
  }

  /**
   * Execute a POST /clocked/pipeline call with the 6 canonical steps.
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

    const res = await this.fetchFn(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unable to read response body');
      throw new Error(`Clocked pipeline failed with HTTP ${res.status}: ${errorText}`);
    }

    const json = (await res.json()) as unknown;
    return ClockedPipelineResponseSchema.parse(json);
  }

  /**
   * Convert a standardized Upwork job input into Clocked state.
   */
  buildJobState(job: ClockedJobInput): Record<string, unknown> {
    let budgetDisplay = 'Not Available';
    if (job.budgetType === 'FIXED' && job.budgetAmountFixed !== null) {
      budgetDisplay = `$${job.budgetAmountFixed} (Fixed)`;
    } else if (job.budgetType === 'HOURLY') {
      const min = job.hourlyRateMin !== null ? `$${job.hourlyRateMin}` : '?';
      const max = job.hourlyRateMax !== null ? `$${job.hourlyRateMax}` : '?';
      budgetDisplay = `${min} - ${max}/hr (Hourly)`;
    }

    return {
      upwork_job_id: job.upworkJobId,
      title: job.title || '',
      description: job.description || '',
      budget_type: job.budgetType,
      budget_display: budgetDisplay,
      budget_amount_fixed: job.budgetAmountFixed,
      hourly_rate_min: job.hourlyRateMin,
      hourly_rate_max: job.hourlyRateMax,
      client_country: job.clientCountry,
      client_total_spend: job.clientTotalSpend,
      client_hire_rate: job.clientHireRate,
      payment_verified: job.paymentVerified,
      proposal_count: job.proposalCount,
      posted_at: job.postedAt instanceof Date ? job.postedAt.toISOString() : job.postedAt,
      skills: job.skills || [],
      job_url: job.jobUrl,
    };
  }

  /**
   * Execute the full 6-step Clocked pipeline for an individual job in a single call.
   */
  async runPipelineForJob(
    job: ClockedJobInput,
    customIdempotencyKey?: string,
  ): Promise<ClockedPipelineResponse> {
    const state = this.buildJobState(job);
    const request: ClockedPipelineRequest = {
      steps: CANONICAL_PIPELINE_STEPS,
      state,
    };

    return this.pipeline(request, customIdempotencyKey);
  }
}
