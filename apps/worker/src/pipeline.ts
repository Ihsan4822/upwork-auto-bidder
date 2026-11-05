/**
 * pipeline.ts — Core Job Processing Pipeline for apps/worker.
 *
 * Implements:
 * - Module 1: Job polling via Upwork MCP & deduplication by upwork_job_id
 * - Module 2: Hard filters execution & plain-word rejection reason tracking
 * - Module 3: AI scoring (APPLY / APPLY_PLUS_BOOST / SKIP) with structured reasons
 */

import { prisma } from '@upwork-bidder/db';
import { applyHardFilters } from '@upwork-bidder/core';
import {
  UpworkMcpClient,
  normalizeMcpJob,
  scoreJobWithAi,
  createAiProvider,
  type NormalizedJob,
} from '@upwork-bidder/ai';
import {
  HOURLY_RATE_FLOOR_USD,
  FIXED_PRICE_FLOOR_USD,
  DEFAULT_SAVED_SEARCHES,
} from '@upwork-bidder/config';

export interface PipelineCycleSummary {
  newJobsFound: number;
  jobsDeduplicated: number;
  jobsFilteredOut: number;
  jobsPassedFilters: number;
  jobsScored: number;
  scoredApply: number;
  scoredBoost: number;
  scoredSkip: number;
}

/**
 * Execute a complete pipeline cycle: Poll → Hard Filter → AI Score.
 *
 * @param profileId - Profile executing the cycle
 * @param mcpClient - Authenticated Upwork MCP Client
 * @returns Summary of jobs processed in this cycle
 */
export async function executePipelineCycle(
  profileId: string,
  mcpClient: UpworkMcpClient,
): Promise<PipelineCycleSummary> {
  const summary: PipelineCycleSummary = {
    newJobsFound: 0,
    jobsDeduplicated: 0,
    jobsFilteredOut: 0,
    jobsPassedFilters: 0,
    jobsScored: 0,
    scoredApply: 0,
    scoredBoost: 0,
    scoredSkip: 0,
  };

  // ── Step 1: Poll Saved Searches ───────────────────────────────────────────
  let searches = await prisma.savedSearch.findMany({
    where: { profileId, isActive: true },
  });

  if (searches.length === 0) {
    // If no searches in DB, use default configured searches
    for (const def of DEFAULT_SAVED_SEARCHES) {
      await prisma.savedSearch.create({
        data: {
          profileId,
          name: def.name,
          queryText: def.queryText,
          isActive: def.isActive,
          pollIntervalMinutes: def.pollIntervalMinutes,
        },
      });
    }
    searches = await prisma.savedSearch.findMany({ where: { profileId, isActive: true } });
  }

  const rawJobsFound: NormalizedJob[] = [];

  for (const search of searches) {
    try {
      const result = await mcpClient.searchJobs(search.queryText, 25);
      for (const raw of result.jobs) {
        try {
          rawJobsFound.push(normalizeMcpJob(raw));
        } catch (normErr) {
          console.warn(`[Pipeline] Skipped unparsable job:`, normErr);
        }
      }

      await prisma.savedSearch.update({
        where: { id: search.id },
        data: { lastPolledAt: new Date() },
      });
    } catch (searchErr) {
      console.error(`[Pipeline] Error polling search "${search.name}":`, searchErr);
    }
  }

  // Deduplicate and insert into DB
  for (const job of rawJobsFound) {
    const existing = await prisma.job.findUnique({
      where: { upworkJobId: job.upworkJobId },
    });

    if (existing) {
      summary.jobsDeduplicated++;
      continue;
    }

    await prisma.job.create({
      data: {
        profileId,
        upworkJobId: job.upworkJobId,
        title: job.title,
        description: job.description,
        budgetType: job.budgetType,
        budgetAmountFixed: job.budgetAmountFixed,
        hourlyRateMin: job.hourlyRateMin,
        hourlyRateMax: job.hourlyRateMax,
        clientCountry: job.clientCountry,
        clientTotalSpend: job.clientTotalSpend,
        clientHireRate: job.clientHireRate,
        paymentVerified: job.paymentVerified,
        proposalCount: job.proposalCount,
        postedAt: job.postedAt,
        skills: job.skills,
        jobUrl: job.jobUrl,
        status: 'NEW',
      },
    });

    summary.newJobsFound++;
  }

  // ── Step 2: Run Hard Filters (Module 2) ────────────────────────────────────
  const pendingJobs = await prisma.job.findMany({
    where: { profileId, status: 'NEW' },
  });

  // Load floors (fallback to config defaults)
  const hourlySetting = await prisma.setting.findUnique({ where: { key: 'hourlyRateFloorUsd' } });
  const fixedSetting = await prisma.setting.findUnique({ where: { key: 'fixedPriceFloorUsd' } });

  const floors = {
    hourlyRateFloorUsd: hourlySetting ? parseFloat(hourlySetting.value) : HOURLY_RATE_FLOOR_USD,
    fixedPriceFloorUsd: fixedSetting ? parseFloat(fixedSetting.value) : FIXED_PRICE_FLOOR_USD,
  };

  for (const job of pendingJobs) {
    const filterInput = {
      upworkJobId: job.upworkJobId,
      title: job.title,
      description: job.description,
      budgetType: job.budgetType,
      budgetAmountFixed: job.budgetAmountFixed ? Number(job.budgetAmountFixed) : null,
      hourlyRateMax: job.hourlyRateMax ? Number(job.hourlyRateMax) : null,
      paymentVerified: job.paymentVerified,
    };

    const filterResult = applyHardFilters(filterInput, floors);

    if (!filterResult.passed) {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'FILTERED_OUT',
          filterReason: filterResult.reason,
        },
      });
      summary.jobsFilteredOut++;
    } else {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'SCORED_PENDING',
          filterReason: null,
        },
      });
      summary.jobsPassedFilters++;
    }
  }

  // ── Step 3: Run AI Scoring (Module 3) ──────────────────────────────────────
  const jobsToScore = await prisma.job.findMany({
    where: { profileId, status: 'SCORED_PENDING' },
  });

  if (jobsToScore.length > 0) {
    let aiProvider;
    try {
      aiProvider = createAiProvider();
    } catch {
      console.warn('[Pipeline] AI_API_KEY not configured. Skipping AI scoring step.');
      return summary;
    }

    for (const job of jobsToScore) {
      try {
        const normalized: NormalizedJob = {
          upworkJobId: job.upworkJobId,
          title: job.title,
          description: job.description,
          budgetType: job.budgetType as 'HOURLY' | 'FIXED' | null,
          budgetAmountFixed: job.budgetAmountFixed ? Number(job.budgetAmountFixed) : null,
          hourlyRateMin: job.hourlyRateMin ? Number(job.hourlyRateMin) : null,
          hourlyRateMax: job.hourlyRateMax ? Number(job.hourlyRateMax) : null,
          clientCountry: job.clientCountry,
          clientTotalSpend: job.clientTotalSpend ? Number(job.clientTotalSpend) : null,
          clientHireRate: job.clientHireRate ? Number(job.clientHireRate) : null,
          paymentVerified: job.paymentVerified,
          proposalCount: job.proposalCount,
          postedAt: job.postedAt,
          skills: job.skills,
          jobUrl: job.jobUrl,
        };

        const scoreOutput = await scoreJobWithAi(normalized, aiProvider);

        // Store score in job_scores table
        await prisma.jobScore.create({
          data: {
            profileId,
            jobId: job.id,
            label: scoreOutput.label,
            score: scoreOutput.score,
            reasons: scoreOutput.reasons,
            modelName: process.env.AI_MODEL_NAME || 'gemini-1.5-pro',
            promptVersion: '1.0.0',
          },
        });

        // Set status based on score label
        const nextStatus =
          scoreOutput.label === 'SKIP' ? 'SKIPPED' : 'DRAFT_READY';

        await prisma.job.update({
          where: { id: job.id },
          data: { status: nextStatus },
        });

        summary.jobsScored++;
        if (scoreOutput.label === 'APPLY') summary.scoredApply++;
        else if (scoreOutput.label === 'APPLY_PLUS_BOOST') summary.scoredBoost++;
        else if (scoreOutput.label === 'SKIP') summary.scoredSkip++;
      } catch (scoreErr) {
        console.error(`[Pipeline] Failed to score job ${job.upworkJobId}:`, scoreErr);
      }
    }
  }

  return summary;
}
