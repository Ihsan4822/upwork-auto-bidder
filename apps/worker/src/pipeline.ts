/**
 * pipeline.ts - Core Job Processing Pipeline for apps/worker.
 *
 * Implements:
 * - Module 1: Job polling via Upwork MCP & deduplication by upwork_job_id
 * - Module 2: Hard filters execution & plain-word rejection reason tracking
 * - Module 3: AI scoring (Gemini default, or Clocked Pipeline when CLOCKED_ENABLED is true)
 * - Module 4: Proposal drafting (Gemini) for approved / verified APPLY jobs
 */

import { prisma } from '@upwork-bidder/db';
import { applyHardFilters } from '@upwork-bidder/core';
import {
  UpworkMcpClient,
  normalizeMcpJob,
  scoreJobWithAi,
  draftProposalWithAi,
  matchPortfolioItem,
  createAiProvider,
  type NormalizedJob,
  type PortfolioItemInput,
} from '@upwork-bidder/ai';
import {
  HOURLY_RATE_FLOOR_USD,
  FIXED_PRICE_FLOOR_USD,
  DEFAULT_SAVED_SEARCHES,
} from '@upwork-bidder/config';
import {
  ClockedClient,
  verifyJobWithClocked,
  type ClockedJobInput,
} from '@upwork-bidder/clocked';

export interface PipelineCycleSummary {
  newJobsFound: number;
  jobsDeduplicated: number;
  jobsFilteredOut: number;
  jobsPassedFilters: number;
  jobsScored: number;
  scoredApply: number;
  scoredBoost: number;
  scoredSkip: number;
  draftsGenerated: number;
}

/**
 * Execute a complete pipeline cycle: Poll -> Hard Filter -> AI Score.
 *
 * @param profileId - Profile executing the cycle
 * @param mcpClient - Authenticated Upwork MCP Client
 * @param clockedClient - Optional ClockedClient instance (used for dependency injection / mocking in tests)
 * @returns Summary of jobs processed in this cycle
 */
export async function executePipelineCycle(
  profileId: string,
  mcpClient: UpworkMcpClient,
  clockedClient?: ClockedClient,
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
    draftsGenerated: 0,
  };

  // -- Step 1: Poll Saved Searches -------------------------------------------
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

  // -- Step 2: Run Hard Filters (Module 2) ------------------------------------
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
      budgetAmountFixed:
        job.budgetAmountFixed !== null && job.budgetAmountFixed !== undefined
          ? Number(job.budgetAmountFixed)
          : null,
      hourlyRateMax:
        job.hourlyRateMax !== null && job.hourlyRateMax !== undefined
          ? Number(job.hourlyRateMax)
          : null,
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

  // -- Step 3: Run AI Scoring (Module 3) --------------------------------------
  const jobsToScore = await prisma.job.findMany({
    where: { profileId, status: 'SCORED_PENDING' },
  });

  if (jobsToScore.length > 0) {
    const isClockedEnabled =
      process.env.CLOCKED_ENABLED === 'true' ||
      process.env.CLOCKED_ENABLED === '1';

    let aiProvider: ReturnType<typeof createAiProvider> | undefined;
    try {
      aiProvider = createAiProvider();
    } catch {
      if (!isClockedEnabled) {
        console.warn('[Pipeline] AI_API_KEY not configured. Skipping AI scoring step.');
        return summary;
      }
    }

    const activeClockedClient =
      isClockedEnabled
        ? clockedClient ||
          new ClockedClient({
            apiKey: process.env.CLOCKED_API_KEY,
            baseUrl: process.env.CLOCKED_BASE_URL,
          })
        : undefined;

    for (const job of jobsToScore) {
      try {
        const normalized: NormalizedJob = {
          upworkJobId: job.upworkJobId,
          title: job.title,
          description: job.description,
          budgetType: job.budgetType as 'HOURLY' | 'FIXED' | null,
          budgetAmountFixed:
            job.budgetAmountFixed !== null && job.budgetAmountFixed !== undefined
              ? Number(job.budgetAmountFixed)
              : null,
          hourlyRateMin:
            job.hourlyRateMin !== null && job.hourlyRateMin !== undefined
              ? Number(job.hourlyRateMin)
              : null,
          hourlyRateMax:
            job.hourlyRateMax !== null && job.hourlyRateMax !== undefined
              ? Number(job.hourlyRateMax)
              : null,
          clientCountry: job.clientCountry,
          clientTotalSpend:
            job.clientTotalSpend !== null && job.clientTotalSpend !== undefined
              ? Number(job.clientTotalSpend)
              : null,
          clientHireRate:
            job.clientHireRate !== null && job.clientHireRate !== undefined
              ? Number(job.clientHireRate)
              : null,
          paymentVerified: job.paymentVerified,
          proposalCount: job.proposalCount,
          postedAt: job.postedAt,
          skills: job.skills,
          jobUrl: job.jobUrl,
        };

        if (isClockedEnabled && activeClockedClient) {
          // Clocked Pipeline execution path
          const clockedJobInput: ClockedJobInput = {
            upworkJobId: job.upworkJobId,
            title: job.title,
            description: job.description,
            budgetType: job.budgetType as 'HOURLY' | 'FIXED' | null,
            budgetAmountFixed:
              job.budgetAmountFixed !== null && job.budgetAmountFixed !== undefined
                ? Number(job.budgetAmountFixed)
                : null,
            hourlyRateMin:
              job.hourlyRateMin !== null && job.hourlyRateMin !== undefined
                ? Number(job.hourlyRateMin)
                : null,
            hourlyRateMax:
              job.hourlyRateMax !== null && job.hourlyRateMax !== undefined
                ? Number(job.hourlyRateMax)
                : null,
            clientCountry: job.clientCountry,
            clientTotalSpend:
              job.clientTotalSpend !== null && job.clientTotalSpend !== undefined
                ? Number(job.clientTotalSpend)
                : null,
            clientHireRate:
              job.clientHireRate !== null && job.clientHireRate !== undefined
                ? Number(job.clientHireRate)
                : null,
            paymentVerified: job.paymentVerified,
            proposalCount: job.proposalCount,
            postedAt: job.postedAt,
            skills: job.skills,
            jobUrl: job.jobUrl,
          };

          const clockedResult = await verifyJobWithClocked(clockedJobInput, activeClockedClient);

          // Rule 1: Guard flags injection high or critical -> human review, no score, no draft
          if (
            clockedResult.guardSeverity === 'high' ||
            clockedResult.guardSeverity === 'critical'
          ) {
            await prisma.job.update({
              where: { id: job.id },
              data: {
                status: 'IN_REVIEW',
                filterReason:
                  clockedResult.flaggedReason ||
                  `Prompt injection detected by Guard (${clockedResult.guardSeverity}). Routed to human review.`,
              },
            });
            console.log(
              `[Pipeline] Job ${job.upworkJobId} Clocked action: ${clockedResult.label}, confidence: ${clockedResult.confidence.toFixed(2)}, credits used: ${clockedResult.creditsUsed}, outcome: human review`,
            );
            continue;
          }

          // Rule 2: Decide confidence under 0.75 -> human review, no draft
          if (clockedResult.confidence < activeClockedClient.threshold) {
            await prisma.job.update({
              where: { id: job.id },
              data: {
                status: 'IN_REVIEW',
                filterReason:
                  clockedResult.flaggedReason ||
                  `Clocked Decide confidence (${clockedResult.confidence.toFixed(2)}) is below 0.75 threshold. Routed to human review.`,
              },
            });
            console.log(
              `[Pipeline] Job ${job.upworkJobId} Clocked action: ${clockedResult.label}, confidence: ${clockedResult.confidence.toFixed(2)}, credits used: ${clockedResult.creditsUsed}, outcome: human review`,
            );
            continue;
          }

          // Rule 3: Clocked fails or Verify finds ungrounded claim -> human review, no draft
          if (clockedResult.routing === 'HUMAN_REVIEW' || !clockedResult.clockedVerified) {
            await prisma.job.update({
              where: { id: job.id },
              data: {
                status: 'IN_REVIEW',
                filterReason:
                  clockedResult.flaggedReason ||
                  'Clocked verification failed or ungrounded claim. Routed to human review.',
              },
            });
            console.log(
              `[Pipeline] Job ${job.upworkJobId} Clocked action: ${clockedResult.label}, confidence: ${clockedResult.confidence.toFixed(2)}, credits used: ${clockedResult.creditsUsed}, outcome: human review`,
            );
            continue;
          }

          // Rule 4: Clocked passes Guard and Verify, and Decide says APPLY or APPLY_PLUS_BOOST -> draft & scorecard
          if (clockedResult.label === 'APPLY' || clockedResult.label === 'APPLY_PLUS_BOOST') {
            const scorecardReasons = [
              ...clockedResult.reasons,
              `clockedVerified: true`,
              `confidence: ${clockedResult.confidence.toFixed(2)}`,
              `creditsUsed: ${clockedResult.creditsUsed}`,
            ];

            await prisma.jobScore.create({
              data: {
                profileId,
                jobId: job.id,
                label: clockedResult.label,
                score: clockedResult.score,
                reasons: scorecardReasons,
                modelName: 'clocked-pipeline',
                promptVersion: '1.0.0',
              },
            });

            summary.jobsScored++;
            if (clockedResult.label === 'APPLY') summary.scoredApply++;
            else if (clockedResult.label === 'APPLY_PLUS_BOOST') summary.scoredBoost++;

            console.log(
              `[Pipeline] Job ${job.upworkJobId} Clocked action: ${clockedResult.label}, confidence: ${clockedResult.confidence.toFixed(2)}, credits used: ${clockedResult.creditsUsed}, outcome: draft`,
            );

            // Generate proposal draft via Gemini
            if (aiProvider) {
              try {
                const dbPortfolio = await prisma.portfolioItem.findMany({
                  where: { profileId, isActive: true },
                });

                const portfolioItems: PortfolioItemInput[] = dbPortfolio.map((p) => ({
                  id: p.id,
                  title: p.title,
                  nicheTags: p.nicheTags,
                  link: p.link,
                  isActive: p.isActive,
                }));

                const matchResult = matchPortfolioItem(
                  `${job.title || ''} ${job.description || ''} ${job.skills.join(' ')}`,
                  portfolioItems,
                );

                const draftResult = await draftProposalWithAi(
                  normalized,
                  matchResult.matchedItem,
                  aiProvider,
                );

                const existingDrafts = await prisma.draft.findMany({
                  where: { jobId: job.id },
                  select: { version: true },
                });
                const nextVersion =
                  existingDrafts.length > 0 ? Math.max(...existingDrafts.map((d) => d.version)) + 1 : 1;

                await prisma.draft.create({
                  data: {
                    profileId,
                    jobId: job.id,
                    version: nextVersion,
                    draftText: draftResult.draftText,
                    status: draftResult.status,
                    failureReason: draftResult.failureReason,
                    portfolioItemId: draftResult.portfolioItemId,
                    wordCount: draftResult.wordCount,
                  },
                });

                await prisma.job.update({
                  where: { id: job.id },
                  data: { status: 'DRAFT_READY' },
                });

                summary.draftsGenerated++;
              } catch (draftErr) {
                console.error(
                  `[Pipeline] Failed to draft proposal for job ${job.upworkJobId}:`,
                  draftErr,
                );
              }
            }
            continue;
          }

          // Rule 5: Decide says SKIP -> no draft, record reason
          if (clockedResult.label === 'SKIP') {
            const scorecardReasons = [
              ...clockedResult.reasons,
              `clockedVerified: ${clockedResult.clockedVerified}`,
              `confidence: ${clockedResult.confidence.toFixed(2)}`,
              `creditsUsed: ${clockedResult.creditsUsed}`,
            ];

            await prisma.jobScore.create({
              data: {
                profileId,
                jobId: job.id,
                label: 'SKIP',
                score: clockedResult.score,
                reasons: scorecardReasons,
                modelName: 'clocked-pipeline',
                promptVersion: '1.0.0',
              },
            });

            await prisma.job.update({
              where: { id: job.id },
              data: {
                status: 'SKIPPED',
                filterReason: clockedResult.reasons[0] || 'Clocked Decide: SKIP',
              },
            });

            summary.jobsScored++;
            summary.scoredSkip++;

            console.log(
              `[Pipeline] Job ${job.upworkJobId} Clocked action: SKIP, confidence: ${clockedResult.confidence.toFixed(2)}, credits used: ${clockedResult.creditsUsed}, outcome: skip`,
            );
            continue;
          }
        } else {
          // Standard Gemini scoring path (flag off)
          if (!aiProvider) {
            console.warn('[Pipeline] AI provider not available for scoring. Skipping.');
            continue;
          }

          const scoreOutput = await scoreJobWithAi(normalized, aiProvider);

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

          summary.jobsScored++;
          if (scoreOutput.label === 'APPLY') summary.scoredApply++;
          else if (scoreOutput.label === 'APPLY_PLUS_BOOST') summary.scoredBoost++;
          else if (scoreOutput.label === 'SKIP') summary.scoredSkip++;

          if (scoreOutput.label === 'SKIP') {
            await prisma.job.update({
              where: { id: job.id },
              data: { status: 'SKIPPED' },
            });
            continue;
          }

          // Draft Engine & Portfolio Match for standard path
          try {
            const dbPortfolio = await prisma.portfolioItem.findMany({
              where: { profileId, isActive: true },
            });

            const portfolioItems: PortfolioItemInput[] = dbPortfolio.map((p) => ({
              id: p.id,
              title: p.title,
              nicheTags: p.nicheTags,
              link: p.link,
              isActive: p.isActive,
            }));

            const matchResult = matchPortfolioItem(
              `${job.title || ''} ${job.description || ''} ${job.skills.join(' ')}`,
              portfolioItems,
            );

            const draftResult = await draftProposalWithAi(
              normalized,
              matchResult.matchedItem,
              aiProvider,
            );

            const existingDrafts = await prisma.draft.findMany({
              where: { jobId: job.id },
              select: { version: true },
            });
            const nextVersion =
              existingDrafts.length > 0 ? Math.max(...existingDrafts.map((d) => d.version)) + 1 : 1;

            await prisma.draft.create({
              data: {
                profileId,
                jobId: job.id,
                version: nextVersion,
                draftText: draftResult.draftText,
                status: draftResult.status,
                failureReason: draftResult.failureReason,
                portfolioItemId: draftResult.portfolioItemId,
                wordCount: draftResult.wordCount,
              },
            });

            await prisma.job.update({
              where: { id: job.id },
              data: { status: 'DRAFT_READY' },
            });

            summary.draftsGenerated++;
          } catch (draftErr) {
            console.error(
              `[Pipeline] Failed to draft proposal for job ${job.upworkJobId}:`,
              draftErr,
            );
          }
        }
      } catch (scoreErr) {
        console.error(`[Pipeline] Failed to score job ${job.upworkJobId}:`, scoreErr);
      }
    }
  }

  return summary;
}
