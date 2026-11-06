/**
 * client.ts — Singleton Prisma client.
 *
 * WHY SINGLETON: Next.js hot reload creates new module instances in development,
 * causing "too many connections" errors if Prisma is instantiated per module.
 * The global singleton pattern prevents this.
 */

import { PrismaClient } from '@prisma/client';

// Ensure DATABASE_URL is defined so Prisma Client never crashes on initialization
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
