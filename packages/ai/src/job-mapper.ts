/**
 * job-mapper.ts — Maps raw Upwork MCP response to sanitized database Job records.
 *
 * SECTION 4, MODULE 1 RULE:
 * "Store: title, description, budget type and amount, hourly range if given,
 * client country, client total spend if given, client hire rate if given,
 * payment verified status, number of proposals so far if given, posted time,
 * skills, job URL.
 * If a field is not available from the permitted route, store it as null and
 * show it as Not Available. Never guess it."
 */

import { RawMcpJob } from './mcp-client';

export interface NormalizedJob {
  upworkJobId: string;
  title: string | null;
  description: string | null;
  budgetType: 'HOURLY' | 'FIXED' | null;
  budgetAmountFixed: number | null;
  hourlyRateMin: number | null;
  hourlyRateMax: number | null;
  clientCountry: string | null;
  clientTotalSpend: number | null;
  clientHireRate: number | null;
  paymentVerified: boolean | null;
  proposalCount: number | null;
  postedAt: Date | null;
  skills: string[];
  jobUrl: string | null;
}

/**
 * Normalizes a raw job received from the Upwork MCP server.
 * Ensures honest nulls for any field not explicitly provided.
 *
 * @param raw - The raw job payload from Upwork MCP
 * @returns NormalizedJob ready for Prisma storage
 */
export function normalizeMcpJob(raw: RawMcpJob): NormalizedJob {
  if (!raw.id || typeof raw.id !== 'string') {
    throw new Error('Raw MCP job must contain a valid string id');
  }

  // Parse budget type cleanly
  let budgetType: 'HOURLY' | 'FIXED' | null = null;
  if (raw.budget_type === 'HOURLY' || raw.budget_type === 'FIXED') {
    budgetType = raw.budget_type;
  } else if (typeof raw.hourly_max === 'number' || typeof raw.hourly_min === 'number') {
    budgetType = 'HOURLY';
  } else if (typeof raw.budget_fixed === 'number') {
    budgetType = 'FIXED';
  }

  // Parse posted time
  let postedAt: Date | null = null;
  if (raw.posted_time) {
    const parsedDate = new Date(raw.posted_time);
    if (!isNaN(parsedDate.getTime())) {
      postedAt = parsedDate;
    }
  }

  return {
    upworkJobId: raw.id,
    title: raw.title?.trim() || null,
    description: raw.description?.trim() || null,
    budgetType,
    budgetAmountFixed: typeof raw.budget_fixed === 'number' ? raw.budget_fixed : null,
    hourlyRateMin: typeof raw.hourly_min === 'number' ? raw.hourly_min : null,
    hourlyRateMax: typeof raw.hourly_max === 'number' ? raw.hourly_max : null,
    clientCountry: raw.client_country?.trim() || null,
    clientTotalSpend: typeof raw.client_total_spend === 'number' ? raw.client_total_spend : null,
    clientHireRate: typeof raw.client_hire_rate === 'number' ? raw.client_hire_rate : null,
    paymentVerified: typeof raw.payment_verified === 'boolean' ? raw.payment_verified : null,
    proposalCount: typeof raw.proposal_count === 'number' ? Math.max(0, raw.proposal_count) : null,
    postedAt,
    skills: Array.isArray(raw.skills)
      ? raw.skills.filter((s): s is string => typeof s === 'string')
      : [],
    jobUrl: raw.url?.trim() || null,
  };
}
