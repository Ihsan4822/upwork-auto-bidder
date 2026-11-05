/**
 * job-mapper.test.ts — Unit tests for normalizing raw Upwork MCP job feeds.
 *
 * Verifies honest null extraction per Module 1 rules.
 */

import { describe, it, expect } from 'vitest';
import { normalizeMcpJob } from '../src/job-mapper';
import type { RawMcpJob } from '../src/mcp-client';

describe('Job Mapper — Module 1 Honest Nulls', () => {
  it('correctly maps full job data without altering values', () => {
    const raw: RawMcpJob = {
      id: 'job_123',
      title: 'Amazon A Plus Content Designer Needed',
      description: 'Looking for high quality listing graphics',
      budget_type: 'FIXED',
      budget_fixed: 450,
      client_country: 'United States',
      client_total_spend: 12500,
      client_hire_rate: 0.85,
      payment_verified: true,
      proposal_count: 4,
      posted_time: '2026-11-05T12:00:00.000Z',
      skills: ['Amazon A+ Content', 'Photoshop'],
      url: 'https://www.upwork.com/jobs/custom-123',
    };

    const normalized = normalizeMcpJob(raw);

    expect(normalized.upworkJobId).toBe('job_123');
    expect(normalized.title).toBe('Amazon A Plus Content Designer Needed');
    expect(normalized.budgetType).toBe('FIXED');
    expect(normalized.budgetAmountFixed).toBe(450);
    expect(normalized.clientCountry).toBe('United States');
    expect(normalized.clientTotalSpend).toBe(12500);
    expect(normalized.clientHireRate).toBe(0.85);
    expect(normalized.paymentVerified).toBe(true);
    expect(normalized.proposalCount).toBe(4);
    expect(normalized.skills).toEqual(['Amazon A+ Content', 'Photoshop']);
    expect(normalized.jobUrl).toBe('https://www.upwork.com/jobs/custom-123');
  });

  it('stores honest nulls when fields are missing from MCP output (never guesses)', () => {
    const minimalRaw: RawMcpJob = {
      id: 'job_sparse_456',
      title: 'Minimal Job',
    };

    const normalized = normalizeMcpJob(minimalRaw);

    expect(normalized.upworkJobId).toBe('job_sparse_456');
    expect(normalized.title).toBe('Minimal Job');
    expect(normalized.description).toBeNull();
    expect(normalized.budgetType).toBeNull();
    expect(normalized.budgetAmountFixed).toBeNull();
    expect(normalized.hourlyRateMin).toBeNull();
    expect(normalized.hourlyRateMax).toBeNull();
    expect(normalized.clientCountry).toBeNull();
    expect(normalized.clientTotalSpend).toBeNull();
    expect(normalized.clientHireRate).toBeNull();
    expect(normalized.paymentVerified).toBeNull();
    expect(normalized.proposalCount).toBeNull();
    expect(normalized.postedAt).toBeNull();
    expect(normalized.skills).toEqual([]);
    expect(normalized.jobUrl).toBe('https://www.upwork.com/jobs/~job_sparse_456');
  });

  it('infers HOURLY budget type when hourly rates are supplied without explicit type', () => {
    const raw: RawMcpJob = {
      id: 'job_hourly_789',
      hourly_min: 20,
      hourly_max: 35,
    };

    const normalized = normalizeMcpJob(raw);
    expect(normalized.budgetType).toBe('HOURLY');
    expect(normalized.hourlyRateMin).toBe(20);
    expect(normalized.hourlyRateMax).toBe(35);
  });
});
