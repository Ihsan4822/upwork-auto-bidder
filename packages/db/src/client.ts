/**
 * client.ts — Singleton Prisma client.
 *
 * WHY SINGLETON: Next.js hot reload creates new module instances in development,
 * causing "too many connections" errors if Prisma is instantiated per module.
 * The global singleton pattern prevents this.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

// Ensure DATABASE_URL is defined from environment or .env file before fallback
if (!process.env.DATABASE_URL) {
  const candidatePaths = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../.env'),
    resolve(process.cwd(), '../../.env'),
    resolve(__dirname, '../../../.env'),
    resolve(__dirname, '../../../../.env'),
  ];
  for (const p of candidatePaths) {
    if (existsSync(p)) {
      const lines = readFileSync(p, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('DATABASE_URL=')) {
          const val = trimmed.slice(13).trim().replace(/^["']|["']$/g, '');
          process.env.DATABASE_URL = val;
          break;
        }
      }
      if (process.env.DATABASE_URL) break;
    }
  }
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/upwork_bidder';
}

// Extend globalThis to avoid TypeScript errors on the global property
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

// In production: always create a new instance (single long-lived process)
// In development: reuse the global instance across hot reloads
export const prisma: PrismaClient = globalThis.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}
