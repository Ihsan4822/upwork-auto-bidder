/**
 * index.ts — Public exports for packages/db
 */

export { prisma } from './client';
export { Prisma, PrismaClient } from '@prisma/client';
// Re-export all Prisma generated types for use across the monorepo
export type {
  User,
  Profile,
  OauthToken,
  SavedSearch,
  Job,
  JobScore,
  Draft,
  PortfolioItem,
  ReviewAction,
  AnalyticsEntry,
  Setting,
} from '@prisma/client';
