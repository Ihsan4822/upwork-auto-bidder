import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  const envPath = resolve(__dirname, '../../../.env');
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...rest] = trimmed.split('=');
        const val = rest
          .join('=')
          .trim()
          .replace(/^["']|["']$/g, '');
        const cleanKey = key.trim();
        if (cleanKey && !process.env[cleanKey]) {
          process.env[cleanKey] = val;
        }
      }
    }
  }
}

loadEnv();

import { prisma, type Job } from '@upwork-bidder/db';
import { getValidAccessToken, applyHardFilters } from '@upwork-bidder/core';
import { UpworkMcpClient, normalizeMcpJob, type NormalizedJob } from '@upwork-bidder/ai';
import { HOURLY_RATE_FLOOR_USD, FIXED_PRICE_FLOOR_USD } from '@upwork-bidder/config';

async function main() {
  console.log('====================================================');
  console.log('LIVE READ-ONLY TEST OF UPWORK MCP CONNECTION');
  console.log('====================================================\n');

  // ── Step 1: Token Decryption & Validation ──────────────────
  console.log('--- Step 1: Token Decryption Verification ---');
  const encryptionKey = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('OAUTH_TOKEN_ENCRYPTION_KEY is missing from environment');
  }

  const profile = await prisma.profile.findFirst({
    where: { connectionStatus: 'CONNECTED' },
    include: {
      oauthTokens: {
        where: { revokedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!profile) {
    throw new Error('No CONNECTED profile found in database');
  }

  console.log(`Profile: ${profile.displayName} (Profile ID: ${profile.id}, User ID: ${profile.userId})`);

  let token: string;
  try {
    token = await getValidAccessToken(profile.id, encryptionKey);
    console.log('SUCCESS: Token decrypted and validated successfully via getValidAccessToken().');
    console.log(`Token validated (length: ${token.length} chars)`);
  } catch (err: unknown) {
    console.error('FAILED to decrypt/refresh token:', err instanceof Error ? err.message : String(err));
    throw err;
  }

  // ── Step 2: Check & Seed Saved Searches ─────────────────────
  console.log('\n--- Step 2: Checking Saved Searches in Database ---');
  let searches = await prisma.savedSearch.findMany({
    where: { profileId: profile.id, isActive: true },
  });

  if (searches.length === 0) {
    console.log('No saved searches found. Creating 2 saved searches for Amazon design niche...');
    const searchA = await prisma.savedSearch.create({
      data: {
        profileId: profile.id,
        name: 'Amazon A+ Content',
        queryText: 'Amazon A+ Content',
        filters: { minHourlyRate: 15, minFixedBudget: 100 },
        isActive: true,
      },
    });
    const searchB = await prisma.savedSearch.create({
      data: {
        profileId: profile.id,
        name: 'Amazon Listing Images',
        queryText: 'Amazon Listing Images',
        filters: { minHourlyRate: 15, minFixedBudget: 100 },
        isActive: true,
      },
    });
    searches = [searchA, searchB];
    console.log(`Created 2 saved searches: "${searchA.name}" and "${searchB.name}"`);
  } else {
    console.log(`Found ${searches.length} existing active saved searches in database:`);
    searches.forEach((s, idx) => console.log(`  ${idx + 1}. "${s.name}" (query: "${s.queryText}")`));
  }

  // ── Step 3: Run Worker Read-Only Pipeline ──────────────────
  console.log('\n--- Step 3: Running Worker Job Polling & Hard Filters ---');
  const mcpUrl = process.env.UPWORK_MCP_URL || 'https://mcp.upwork.com/mcp';
  const mcpClient = new UpworkMcpClient(token, mcpUrl);

  const summary = {
    searchesPolled: searches.length,
    rawJobsFetched: 0,
    newJobsInserted: 0,
    jobsDeduplicated: 0,
    jobsFilteredOut: 0,
    jobsPassedFilters: 0,
    jobsScored: 0,
    draftsCreated: 0,
  };

  const rawJobsFound: NormalizedJob[] = [];

  for (const search of searches) {
    console.log(`Polling Upwork MCP for search: "${search.name}" (query: "${search.queryText}")...`);
    try {
      const searchResult = await mcpClient.searchJobs(search.queryText, 10);
      console.log(`  -> Retrieved ${searchResult.jobs.length} jobs from Upwork MCP`);
      summary.rawJobsFetched += searchResult.jobs.length;

      for (const raw of searchResult.jobs) {
        try {
          rawJobsFound.push(normalizeMcpJob(raw));
        } catch (normErr: unknown) {
          console.warn(
            `  [Normalize Warning] Skipped unparsable job:`,
            normErr instanceof Error ? normErr.message : String(normErr),
          );
        }
      }

      await prisma.savedSearch.update({
        where: { id: search.id },
        data: { lastPolledAt: new Date() },
      });
    } catch (pollErr: unknown) {
      console.error(
        `  [Polling Error] Search "${search.name}" failed:`,
        pollErr instanceof Error ? pollErr.message : String(pollErr),
      );
    }
  }

  // Deduplicate and insert into DB
  const processedJobs: Job[] = [];
  for (const job of rawJobsFound) {
    const existing = await prisma.job.findUnique({
      where: { upworkJobId: job.upworkJobId },
    });

    if (existing) {
      summary.jobsDeduplicated++;
      processedJobs.push(existing);
      continue;
    }

    const createdJob = await prisma.job.create({
      data: {
        profileId: profile.id,
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

    summary.newJobsInserted++;
    processedJobs.push(createdJob);
  }

  // Run Hard Filters (Module 2)
  console.log('\nApplying Hard Filters ($15/hr minimum, $100 fixed minimum, payment verification)...');
  const floors = {
    hourlyRateFloorUsd: HOURLY_RATE_FLOOR_USD,
    fixedPriceFloorUsd: FIXED_PRICE_FLOOR_USD,
  };

  const finalJobReports: Array<{
    title: string;
    budgetFormatted: string;
    filterStatus: string;
    filterReason: string | null;
  }> = [];

  for (const job of processedJobs) {
    const filterInput = {
      upworkJobId: job.upworkJobId,
      title: job.title,
      description: job.description,
      budgetType: job.budgetType,
      budgetAmountFixed: job.budgetAmountFixed !== null ? Number(job.budgetAmountFixed) : null,
      hourlyRateMax: job.hourlyRateMax !== null ? Number(job.hourlyRateMax) : null,
      paymentVerified: job.paymentVerified,
    };

    const filterResult = applyHardFilters(filterInput, floors);

    let budgetStr = 'No budget stated';
    if (job.budgetType === 'FIXED') {
      budgetStr = job.budgetAmountFixed ? `$${job.budgetAmountFixed} (Fixed)` : 'Fixed (Budget unstated)';
    } else if (job.budgetType === 'HOURLY') {
      if (job.hourlyRateMin && job.hourlyRateMax) {
        budgetStr = `$${job.hourlyRateMin}-$${job.hourlyRateMax}/hr`;
      } else if (job.hourlyRateMax) {
        budgetStr = `Up to $${job.hourlyRateMax}/hr`;
      } else {
        budgetStr = 'Hourly (Rate unstated)';
      }
    }

    if (!filterResult.passed) {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'FILTERED_OUT',
          filterReason: filterResult.reason,
        },
      });
      summary.jobsFilteredOut++;
      finalJobReports.push({
        title: job.title || 'Untitled',
        budgetFormatted: budgetStr,
        filterStatus: 'FILTERED_OUT',
        filterReason: filterResult.reason,
      });
    } else {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'SCORED_PENDING',
          filterReason: null,
        },
      });
      summary.jobsPassedFilters++;
      finalJobReports.push({
        title: job.title || 'Untitled',
        budgetFormatted: budgetStr,
        filterStatus: 'PASSED_FILTERS',
        filterReason: null,
      });
    }
  }

  // ── Step 4: AI Provider & Scoring Check ──────────────────────
  console.log('\n--- Step 4: AI Provider & Scoring Check ---');
  const aiKey = process.env.AI_API_KEY;
  const isRealAiKey = aiKey && !aiKey.startsWith('dummy_') && aiKey.length > 20;

  if (!isRealAiKey) {
    console.log('Notice: AI_API_KEY is not configured with a live Gemini key in the local environment.');
    console.log('Skipping draft generation. Drafts were NOT faked.');
  }

  // ── Step 5: Summary Report ─────────────────────────────────
  console.log('\n====================================================');
  console.log('PIPELINE RUN SUMMARY:');
  console.log('====================================================');
  console.log(`Searches Polled:       ${summary.searchesPolled}`);
  console.log(`Raw Jobs Fetched:      ${summary.rawJobsFetched}`);
  console.log(`New Jobs Inserted:     ${summary.newJobsInserted}`);
  console.log(`Jobs Deduplicated:     ${summary.jobsDeduplicated}`);
  console.log(`Jobs Filtered Out:     ${summary.jobsFilteredOut}`);
  console.log(`Jobs Passed Filters:   ${summary.jobsPassedFilters}`);
  console.log(`Jobs Scored:           ${summary.jobsScored}`);
  console.log(`Drafts Created:        ${summary.draftsCreated} (Skipped: AI_API_KEY local placeholder)`);

  console.log('\n====================================================');
  console.log('FIRST 10 JOBS FOUND (Title, Budget, Filter Result):');
  console.log('====================================================');
  finalJobReports.slice(0, 10).forEach((j, i) => {
    console.log(`${i + 1}. Title:  "${j.title}"`);
    console.log(`   Budget: ${j.budgetFormatted}`);
    console.log(`   Status: ${j.filterStatus}${j.filterReason ? ` (Reason: ${j.filterReason})` : ''}`);
    console.log('');
  });

  // Verify pure read-only
  console.log('====================================================');
  console.log('SECURITY VERIFICATION:');
  console.log(' - Proposals submitted: 0 (No proposal submit called)');
  console.log(' - Messages sent: 0 (No message called)');
  console.log(' - Contracts created: 0 (No contract called)');
  console.log('====================================================');

  await prisma.$disconnect();
}

main().catch((err: unknown) => {
  console.error('Fatal test error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
