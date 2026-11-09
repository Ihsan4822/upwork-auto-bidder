/**
 * scoring.test.ts - Worker scoring integration tests with Clocked safety pipeline.
 *
 * Test cases:
 * 1. Clocked APPLY with draft
 * 2. Clocked SKIP with no draft
 * 3. Guard injection to human review (no score, no draft)
 * 4. Low confidence to human review (confidence < 0.75, no draft)
 * 5. Clocked outage to human review (fallback on failure, no draft)
 * 6. Flag off behaves as today (Gemini scoring path, Clocked not called)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executePipelineCycle } from '../src/pipeline';
import type { ClockedPipelineResponse } from '@upwork-bidder/clocked';
import type { UpworkMcpClient } from '@upwork-bidder/ai';

// Mock DB using vi.hoisted
const { mockPrisma } = vi.hoisted(() => {
  const mock = {
    savedSearch: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    job: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    setting: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    jobScore: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    draft: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    portfolioItem: {
      findMany: vi.fn(),
    },
  };
  return { mockPrisma: mock };
});

vi.mock('@upwork-bidder/db', () => ({
  prisma: mockPrisma,
}));

// Mock AI provider functions
const mockScoreJobWithAi = vi.fn();
const mockDraftProposalWithAi = vi.fn();
const mockMatchPortfolioItem = vi.fn();
const mockCreateAiProvider = vi.fn();

vi.mock('@upwork-bidder/ai', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@upwork-bidder/ai');
  return {
    ...actual,
    scoreJobWithAi: (...args: unknown[]) => mockScoreJobWithAi(...args),
    draftProposalWithAi: (...args: unknown[]) => mockDraftProposalWithAi(...args),
    matchPortfolioItem: (...args: unknown[]) => mockMatchPortfolioItem(...args),
    createAiProvider: () => mockCreateAiProvider(),
  };
});

describe('Worker Scoring Path - Clocked Integration', () => {
  const sampleJob = {
    id: 'job-db-123',
    profileId: 'prof-1',
    upworkJobId: 'UPWORK_JOB_001',
    title: 'Amazon A Plus Content Designer for Top Supplement Brand',
    description: 'Expert designer needed for high quality Premium A+ modules and Brand Story overhaul.',
    budgetType: 'FIXED',
    budgetAmountFixed: 800,
    hourlyRateMin: null,
    hourlyRateMax: null,
    clientCountry: 'United States',
    clientTotalSpend: 45000,
    clientHireRate: 0.85,
    paymentVerified: true,
    proposalCount: 4,
    postedAt: new Date('2026-11-07T10:00:00Z'),
    skills: ['Amazon A+ Content', 'Brand Story', 'Graphic Design'],
    jobUrl: 'https://www.upwork.com/jobs/~01ideal001',
    status: 'SCORED_PENDING',
  };

  const mockMcpClient = {
    searchJobs: vi.fn().mockResolvedValue({ jobs: [] }),
    listNotificationJobs: vi.fn().mockResolvedValue([]),
    listInvitations: vi.fn().mockResolvedValue([]),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the MCP mocks to empty defaults. Individual tests override
    // these; clearAllMocks alone does not reset implementations, so a
    // mockResolvedValue set in one test would leak into the next.
    mockMcpClient.searchJobs.mockResolvedValue({ jobs: [] });
    mockMcpClient.listNotificationJobs.mockResolvedValue([]);
    mockMcpClient.listInvitations.mockResolvedValue([]);

    mockPrisma.savedSearch.findMany.mockResolvedValue([
      { id: 'search-1', queryText: 'Amazon A+', isActive: true, profileId: 'prof-1' },
    ]);
    mockPrisma.setting.findUnique.mockResolvedValue(null);
    mockPrisma.setting.findMany.mockResolvedValue([]);
    mockPrisma.job.findMany.mockImplementation(async (query: { where: { status: string } }) => {
      if (query.where.status === 'NEW') return [];
      if (query.where.status === 'SCORED_PENDING') return [sampleJob];
      return [];
    });
    mockPrisma.job.findUnique.mockResolvedValue(null);
    mockPrisma.job.update.mockResolvedValue(sampleJob);
    mockPrisma.jobScore.findFirst.mockResolvedValue(null);
    mockPrisma.jobScore.create.mockResolvedValue({ id: 'score-1' });
    mockPrisma.portfolioItem.findMany.mockResolvedValue([
      { id: 'port-1', title: 'Sample A+ Portfolio', nicheTags: ['Amazon A+ Content'], link: 'https://example.com' },
    ]);
    mockPrisma.draft.findFirst.mockResolvedValue(null);
    mockPrisma.draft.findMany.mockResolvedValue([]);
    mockPrisma.draft.create.mockResolvedValue({ id: 'draft-1' });

    mockCreateAiProvider.mockReturnValue({ model: 'gemini-1.5-pro' });
    mockMatchPortfolioItem.mockReturnValue({
      matchedItem: { id: 'port-1', title: 'Sample A+ Portfolio', link: 'https://example.com' },
    });
    mockDraftProposalWithAi.mockResolvedValue({
      draftText: 'Dear client, I can design high-converting Amazon A+ modules.',
      status: 'GENERATED',
      wordCount: 160,
      portfolioItemId: 'port-1',
    });
    mockScoreJobWithAi.mockResolvedValue({
      label: 'APPLY',
      score: 85,
      reasons: ['Strong niche match for Amazon A+ design', 'Verified client spend'],
    });
  });

  it('Clocked APPLY with draft: scores job, generates draft, and marks scorecard clockedVerified true', async () => {
    process.env.CLOCKED_ENABLED = 'true';

    const mockResponse: ClockedPipelineResponse = {
      steps: [
        { name: 'guard', endpoint: 'injection', output: { injection_detected: false, score: 0.05, severity: 'none' } },
        { name: 'protect', endpoint: 'pii', output: { pii_detected: false } },
        { name: 'extract', endpoint: 'extract', output: { budget_amount: 800 } },
        { name: 'decide', endpoint: 'decide', output: { action: { choice: 'APPLY', probability: 0.92 } } },
        { name: 'fill_scorecard', endpoint: 'fill', output: { match_score: 92, confidence: 0.92, reason: 'Amazon design match meets criteria.' } },
        { name: 'verify', endpoint: 'grounding', output: { grounded: true } },
      ],
      credits_used: 4,
    };

    const mockClockedClient = {
      threshold: 0.75,
      runPipelineForJob: vi.fn().mockResolvedValue(mockResponse),
    };

    const summary = await executePipelineCycle('prof-1', mockMcpClient as unknown as UpworkMcpClient, mockClockedClient as any);

    expect(mockClockedClient.runPipelineForJob).toHaveBeenCalledTimes(1);

    // Scorecard assertions
    expect(mockPrisma.jobScore.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        label: 'APPLY',
        score: 92,
        reasons: expect.arrayContaining([
          'clockedVerified: true',
          'confidence: 0.92',
          'creditsUsed: 4',
        ]),
        modelName: 'clocked-pipeline',
      }),
    });

    // Draft assertions
    expect(mockDraftProposalWithAi).toHaveBeenCalledTimes(1);
    expect(mockPrisma.draft.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'GENERATED',
      }),
    });
    expect(mockPrisma.job.update).toHaveBeenCalledWith({
      where: { id: sampleJob.id },
      data: { status: 'DRAFT_READY' },
    });

    expect(summary.jobsScored).toBe(1);
    expect(summary.scoredApply).toBe(1);
    expect(summary.draftsGenerated).toBe(1);
  });

  it('Clocked SKIP with no draft: records SKIP score and reason without calling draft engine', async () => {
    process.env.CLOCKED_ENABLED = 'true';

    const mockResponse: ClockedPipelineResponse = {
      steps: [
        { name: 'guard', endpoint: 'injection', output: { injection_detected: false, score: 0.02, severity: 'none' } },
        { name: 'protect', endpoint: 'pii', output: { pii_detected: false } },
        { name: 'extract', endpoint: 'extract', output: { budget_amount: 20 } },
        { name: 'decide', endpoint: 'decide', output: { action: { choice: 'SKIP', probability: 0.95 } } },
        { name: 'fill_scorecard', endpoint: 'fill', output: { match_score: 20, confidence: 0.95, reason: 'Budget under fee floor.' } },
        { name: 'verify', endpoint: 'grounding', output: { grounded: true } },
      ],
      credits_used: 3,
    };

    const mockClockedClient = {
      threshold: 0.75,
      runPipelineForJob: vi.fn().mockResolvedValue(mockResponse),
    };

    const summary = await executePipelineCycle('prof-1', mockMcpClient as unknown as UpworkMcpClient, mockClockedClient as any);

    expect(mockClockedClient.runPipelineForJob).toHaveBeenCalledTimes(1);

    expect(mockPrisma.jobScore.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        label: 'SKIP',
        score: 20,
        modelName: 'clocked-pipeline',
      }),
    });

    expect(mockPrisma.job.update).toHaveBeenCalledWith({
      where: { id: sampleJob.id },
      data: expect.objectContaining({
        status: 'SKIPPED',
      }),
    });

    expect(mockDraftProposalWithAi).not.toHaveBeenCalled();
    expect(mockPrisma.draft.create).not.toHaveBeenCalled();
    expect(summary.scoredSkip).toBe(1);
    expect(summary.draftsGenerated).toBe(0);
  });

  it('Guard injection to human review: routes job to IN_REVIEW with no score and no draft', async () => {
    process.env.CLOCKED_ENABLED = 'true';

    const mockResponse: ClockedPipelineResponse = {
      steps: [
        { name: 'guard', endpoint: 'injection', output: { injection_detected: true, score: 0.95, severity: 'critical' } },
        { name: 'protect', endpoint: 'pii', output: { pii_detected: false } },
        { name: 'extract', endpoint: 'extract', output: {} },
        { name: 'decide', endpoint: 'decide', output: { action: { choice: 'APPLY', probability: 0.88 } } },
        { name: 'fill_scorecard', endpoint: 'fill', output: { match_score: 90, confidence: 0.88 } },
        { name: 'verify', endpoint: 'grounding', output: { grounded: true } },
      ],
      credits_used: 2,
    };

    const mockClockedClient = {
      threshold: 0.75,
      runPipelineForJob: vi.fn().mockResolvedValue(mockResponse),
    };

    const summary = await executePipelineCycle('prof-1', mockMcpClient as unknown as UpworkMcpClient, mockClockedClient as any);

    expect(mockPrisma.job.update).toHaveBeenCalledWith({
      where: { id: sampleJob.id },
      data: expect.objectContaining({
        status: 'IN_REVIEW',
      }),
    });

    // Strict rule: no score, no draft
    expect(mockPrisma.jobScore.create).not.toHaveBeenCalled();
    expect(mockDraftProposalWithAi).not.toHaveBeenCalled();
    expect(mockPrisma.draft.create).not.toHaveBeenCalled();
    expect(summary.jobsScored).toBe(0);
    expect(summary.draftsGenerated).toBe(0);
  });

  it('Low confidence to human review: confidence under 0.75 routes job to IN_REVIEW with no draft', async () => {
    process.env.CLOCKED_ENABLED = 'true';

    const mockResponse: ClockedPipelineResponse = {
      steps: [
        { name: 'guard', endpoint: 'injection', output: { injection_detected: false, score: 0.05, severity: 'none' } },
        { name: 'protect', endpoint: 'pii', output: { pii_detected: false } },
        { name: 'extract', endpoint: 'extract', output: { budget_amount: 500 } },
        { name: 'decide', endpoint: 'decide', output: { action: { choice: 'APPLY', probability: 0.62 } } },
        { name: 'fill_scorecard', endpoint: 'fill', output: { match_score: 62, confidence: 0.62, reason: 'Ambiguous requirements.' } },
        { name: 'verify', endpoint: 'grounding', output: { grounded: true } },
      ],
      credits_used: 3,
    };

    const mockClockedClient = {
      threshold: 0.75,
      runPipelineForJob: vi.fn().mockResolvedValue(mockResponse),
    };

    const summary = await executePipelineCycle('prof-1', mockMcpClient as unknown as UpworkMcpClient, mockClockedClient as any);

    expect(mockPrisma.job.update).toHaveBeenCalledWith({
      where: { id: sampleJob.id },
      data: expect.objectContaining({
        status: 'IN_REVIEW',
      }),
    });

    // Strict rule: confidence < 0.75 never drafts
    expect(mockDraftProposalWithAi).not.toHaveBeenCalled();
    expect(mockPrisma.draft.create).not.toHaveBeenCalled();
    expect(summary.draftsGenerated).toBe(0);
  });

  it('Clocked outage to human review: network or 500 error routes job to IN_REVIEW safely with no draft', async () => {
    process.env.CLOCKED_ENABLED = 'true';

    const mockClockedClient = {
      threshold: 0.75,
      runPipelineForJob: vi.fn().mockRejectedValue(new Error('Clocked 500 Internal Server Error')),
    };

    const summary = await executePipelineCycle('prof-1', mockMcpClient as unknown as UpworkMcpClient, mockClockedClient as any);

    expect(mockPrisma.job.update).toHaveBeenCalledWith({
      where: { id: sampleJob.id },
      data: expect.objectContaining({
        status: 'IN_REVIEW',
      }),
    });

    // Never auto Apply or draft on outage
    expect(mockDraftProposalWithAi).not.toHaveBeenCalled();
    expect(mockPrisma.draft.create).not.toHaveBeenCalled();
    expect(summary.draftsGenerated).toBe(0);
  });

  it('Flag off behaves as today: executes standard Gemini scoring without calling Clocked', async () => {
    process.env.CLOCKED_ENABLED = 'false';

    const mockClockedClient = {
      threshold: 0.75,
      runPipelineForJob: vi.fn(),
    };

    const summary = await executePipelineCycle('prof-1', mockMcpClient as unknown as UpworkMcpClient, mockClockedClient as any);

    // Clocked is NOT called when flag is off
    expect(mockClockedClient.runPipelineForJob).not.toHaveBeenCalled();

    // Standard Gemini scoring executed
    expect(mockScoreJobWithAi).toHaveBeenCalledTimes(1);
    expect(mockPrisma.jobScore.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        label: 'APPLY',
        score: 85,
        modelName: 'gemini-1.5-pro',
      }),
    });

    expect(mockDraftProposalWithAi).toHaveBeenCalledTimes(1);
    expect(summary.jobsScored).toBe(1);
    expect(summary.draftsGenerated).toBe(1);
  });

  it('Flag on with AI provider missing: does not score job, does not call Clocked, routes job to IN_REVIEW, and creates no draft', async () => {
    process.env.CLOCKED_ENABLED = 'true';

    // Mock AI provider creation throwing (missing AI_API_KEY)
    mockCreateAiProvider.mockImplementation(() => {
      throw new Error('AI_API_KEY is required');
    });

    const mockClockedClient = {
      threshold: 0.75,
      runPipelineForJob: vi.fn(),
    };

    const summary = await executePipelineCycle('prof-1', mockMcpClient as unknown as UpworkMcpClient, mockClockedClient as any);

    // 1. Clocked client was NEVER called (no credits spent)
    expect(mockClockedClient.runPipelineForJob).not.toHaveBeenCalled();

    // 2. Job is NOT left SCORED_PENDING (routed to IN_REVIEW with reason)
    expect(mockPrisma.job.update).toHaveBeenCalledWith({
      where: { id: sampleJob.id },
      data: {
        status: 'IN_REVIEW',
        filterReason: 'AI provider unavailable, no Clocked call made, no credits spent',
      },
    });

    // 3. No draft is made
    expect(mockDraftProposalWithAi).not.toHaveBeenCalled();
    expect(mockPrisma.draft.create).not.toHaveBeenCalled();
    expect(summary.draftsGenerated).toBe(0);
    expect(summary.jobsScored).toBe(0);
  });

  it('skips duplicate scoring when job already has an existing score', async () => {
    process.env.CLOCKED_ENABLED = 'false';

    mockPrisma.jobScore.findFirst.mockResolvedValue({
      id: 'existing-score-1',
      score: 80,
      label: 'APPLY',
    });
    mockPrisma.draft.findFirst.mockResolvedValue({ id: 'draft-1' });

    const summary = await executePipelineCycle('prof-1', mockMcpClient as unknown as UpworkMcpClient);

    expect(mockScoreJobWithAi).not.toHaveBeenCalled();
    expect(mockPrisma.jobScore.create).not.toHaveBeenCalled();
    expect(mockPrisma.job.update).toHaveBeenCalledWith({
      where: { id: sampleJob.id },
      data: { status: 'DRAFT_READY' },
    });
    expect(summary.jobsScored).toBe(0);
  });

  it('fetches notification jobs first and stores them with source NOTIFICATION', async () => {
    process.env.CLOCKED_ENABLED = 'false';

    mockMcpClient.listNotificationJobs.mockResolvedValue([
      {
        id: 'NOTIF_JOB_001',
        title: 'Amazon A Plus Content Designer (new job alert)',
        description: 'Upwork matched this job to Farid.',
        budget_type: 'FIXED',
        budget_fixed: 250,
        payment_verified: true,
      },
    ]);
    // No NEW jobs to filter in this cycle; the notification job is inserted only.
    mockPrisma.job.findMany.mockImplementation(async (query: { where: { status: string } }) => {
      if (query.where.status === 'NEW') return [];
      if (query.where.status === 'SCORED_PENDING') return [sampleJob];
      return [];
    });

    const summary = await executePipelineCycle('prof-1', mockMcpClient as unknown as UpworkMcpClient);

    expect(mockMcpClient.listNotificationJobs).toHaveBeenCalledTimes(1);
    expect(mockMcpClient.listInvitations).toHaveBeenCalledTimes(1);
    expect(mockPrisma.job.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        upworkJobId: 'NOTIF_JOB_001',
        source: 'NOTIFICATION',
      }),
    });
    expect(summary.notificationsFound).toBe(1);
    expect(summary.newJobsFound).toBe(1);
  });

  it('fetches invitations first and stores them with source INVITATION', async () => {
    process.env.CLOCKED_ENABLED = 'false';

    mockMcpClient.listInvitations.mockResolvedValue([
      {
        id: 'INV_JOB_001',
        title: 'Amazon A Plus Content Designer (invited)',
        description: 'Client invited Farid directly.',
        budget_type: 'FIXED',
        budget_fixed: 300,
        payment_verified: true,
      },
    ]);
    // No NEW jobs to filter in this cycle; the invited job is inserted only.
    mockPrisma.job.findMany.mockImplementation(async (query: { where: { status: string } }) => {
      if (query.where.status === 'NEW') return [];
      if (query.where.status === 'SCORED_PENDING') return [sampleJob];
      return [];
    });

    const summary = await executePipelineCycle('prof-1', mockMcpClient as unknown as UpworkMcpClient);

    expect(mockMcpClient.listInvitations).toHaveBeenCalledTimes(1);
    expect(mockPrisma.job.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        upworkJobId: 'INV_JOB_001',
        source: 'INVITATION',
      }),
    });
    expect(summary.invitationsFound).toBe(1);
    expect(summary.newJobsFound).toBe(1);
  });

  it('continues with saved searches when the invitation fetch fails', async () => {
    process.env.CLOCKED_ENABLED = 'false';

    mockMcpClient.listInvitations.mockRejectedValue(new Error('MCP unavailable'));
    mockPrisma.job.findMany.mockImplementation(async (query: { where: { status: string } }) => {
      if (query.where.status === 'NEW') return [];
      if (query.where.status === 'SCORED_PENDING') return [sampleJob];
      return [];
    });

    const summary = await executePipelineCycle('prof-1', mockMcpClient as unknown as UpworkMcpClient);

    // The cycle still scores the pending job from saved searches.
    expect(summary.jobsScored).toBe(1);
    expect(summary.invitationsFound).toBe(0);
  });
});
