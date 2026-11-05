/**
 * index.ts — Background worker entry point for Upwork Auto Bidder.
 *
 * Runs scheduled polling, filtering, and scoring jobs.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// Native environment variable loader for monorepo dev
function loadEnv() {
  const envPaths = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
    resolve(__dirname, '../.env'),
    resolve(__dirname, '../../../.env'),
  ];
  for (const envPath of envPaths) {
    if (existsSync(envPath)) {
      const lines = readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, ...rest] = trimmed.split('=');
          const val = rest.join('=').trim().replace(/^["']|["']$/g, '');
          const cleanKey = key.trim();
          if (cleanKey && !process.env[cleanKey]) {
            process.env[cleanKey] = val;
          }
        }
      }
    }
  }
}

loadEnv();

import { prisma } from '@upwork-bidder/db';
import { decryptToken } from '@upwork-bidder/core';
import { UpworkMcpClient } from '@upwork-bidder/ai';
import { DEFAULT_POLL_INTERVAL_MINUTES } from '@upwork-bidder/config';
import { executePipelineCycle } from './pipeline';

let isRunning = false;

export async function runWorkerIteration(): Promise<void> {
  if (isRunning) {
    console.log('[Worker] Previous iteration still in progress. Skipping tick.');
    return;
  }

  isRunning = true;
  console.log(`[Worker] Starting scheduled iteration at ${new Date().toISOString()}`);

  try {
    const encryptionKey = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
    if (!encryptionKey) {
      console.warn('[Worker] OAUTH_TOKEN_ENCRYPTION_KEY is not set. Worker idle.');
      return;
    }

    // Find connected profiles
    const profiles = await prisma.profile.findMany({
      where: { connectionStatus: 'CONNECTED' },
      include: {
        oauthTokens: {
          where: { revokedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (profiles.length === 0) {
      console.log('[Worker] No connected Upwork profiles found. Waiting for user to connect in UI.');
      return;
    }

    for (const profile of profiles) {
      const tokenRecord = profile.oauthTokens[0];
      if (!tokenRecord) continue;

      try {
        const decryptedToken = decryptToken(tokenRecord.encryptedAccessToken, encryptionKey);
        const mcpUrl = process.env.UPWORK_MCP_URL || 'https://mcp.upwork.com/mcp';
        const client = new UpworkMcpClient(decryptedToken, mcpUrl);

        console.log(`[Worker] Running pipeline for profile: ${profile.displayName} (${profile.id})`);
        const summary = await executePipelineCycle(profile.id, client);

        console.log('[Worker] Pipeline cycle completed successfully:');
        console.table(summary);
      } catch (err: unknown) {
        console.error(`[Worker] Error processing profile ${profile.id}:`, err);
      }
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Can't reach database server")) {
      console.warn('[Worker] PostgreSQL server at localhost:5432 is not currently running.');
      console.warn('[Worker] Please start PostgreSQL (or provide a cloud DATABASE_URL in .env). Worker will retry on next scheduled interval.');
    } else {
      console.error('[Worker] Fatal error during iteration:', err);
    }
  } finally {
    isRunning = false;
  }
}

// Start polling loop when executed directly
if (require.main === module) {
  const pollIntervalMs = (Number(process.env.POLL_INTERVAL_MINUTES) || DEFAULT_POLL_INTERVAL_MINUTES) * 60 * 1000;
  console.log(`[Worker] Worker process started. Polling every ${pollIntervalMs / 60000} minutes.`);

  // Immediate first run
  runWorkerIteration().catch(console.error);

  // Recurring schedule
  setInterval(() => {
    runWorkerIteration().catch(console.error);
  }, pollIntervalMs);
}
