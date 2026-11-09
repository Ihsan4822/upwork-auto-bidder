/**
 * filters.test.ts — Unit tests for all hard filter rules.
 *
 * Section D1: "Every business rule in packages/core has unit tests,
 * including every hard filter and the fee floors."
 *
 * These tests use fixed sample jobs so changes to filter logic are
 * immediately visible. Never delete a failing test to go green.
 */

import { describe, it, expect } from 'vitest';
import { applyHardFilters, type JobFilterInput, type FilterFloors } from '../src/filters';

/** Default floors matching the config defaults */
const DEFAULT_FLOORS: FilterFloors = {
  hourlyRateFloorUsd: 15,
  fixedPriceFloorUsd: 100,
};

/** A job that passes all filters — baseline for positive tests */
const PASSING_FIXED_JOB: JobFilterInput = {
  upworkJobId: 'TEST_001',
  title: 'Need Amazon A Plus Content Designer',
  description: 'Looking for someone to create A Plus Content for our brand',
  budgetType: 'FIXED',
  budgetAmountFixed: 500,
  hourlyRateMax: null,
  paymentVerified: true,
};

const PASSING_HOURLY_JOB: JobFilterInput = {
  upworkJobId: 'TEST_002',
  title: 'Amazon Storefront Design — Hourly',
  description: 'Need ongoing storefront design work for Amazon brand',
  budgetType: 'HOURLY',
  budgetAmountFixed: null,
  hourlyRateMax: 25,
  paymentVerified: true,
};

describe('Hard Filters — Module 2', () => {
  describe('Payment verification filter', () => {
    it('passes a job with payment verified = true', () => {
      const result = applyHardFilters(PASSING_FIXED_JOB, DEFAULT_FLOORS);
      expect(result.passed).toBe(true);
    });

    it('rejects a job with payment verified = false', () => {
      const job: JobFilterInput = { ...PASSING_FIXED_JOB, paymentVerified: false };
      const result = applyHardFilters(job, DEFAULT_FLOORS);
      expect(result.passed).toBe(false);
      if (!result.passed) {
        expect(result.reason).toBe('Payment Not Verified');
      }
    });

    it('rejects a job with payment verified = null (not returned by MCP)', () => {
      // null = unavailable from MCP. Safe default = reject (treat as not verified)
      const job: JobFilterInput = { ...PASSING_FIXED_JOB, paymentVerified: null };
      const result = applyHardFilters(job, DEFAULT_FLOORS);
      expect(result.passed).toBe(false);
      if (!result.passed) {
        expect(result.reason).toBe('Payment Not Verified');
      }
    });
  });

  describe('Niche match filter', () => {
    it('passes a job with an A Plus Content title', () => {
      const result = applyHardFilters(PASSING_FIXED_JOB, DEFAULT_FLOORS);
      expect(result.passed).toBe(true);
    });

    it('passes a job with Storefront Design in description', () => {
      const result = applyHardFilters(PASSING_HOURLY_JOB, DEFAULT_FLOORS);
      expect(result.passed).toBe(true);
    });

    it('rejects a job completely outside niche (web development)', () => {
      const job: JobFilterInput = {
        ...PASSING_FIXED_JOB,
        title: 'Need a React developer for SaaS app',
        description: 'Looking for a frontend developer with React and TypeScript',
      };
      const result = applyHardFilters(job, DEFAULT_FLOORS);
      expect(result.passed).toBe(false);
      if (!result.passed) {
        expect(result.reason).toBe('Outside Niche');
      }
    });

    it('rejects a job with no title or description', () => {
      const job: JobFilterInput = {
        ...PASSING_FIXED_JOB,
        title: null,
        description: null,
      };
      const result = applyHardFilters(job, DEFAULT_FLOORS);
      expect(result.passed).toBe(false);
      if (!result.passed) {
        expect(result.reason).toBe('Outside Niche');
      }
    });
  });

  describe('Fixed price budget filter', () => {
    it('passes a fixed job at exactly the floor ($100)', () => {
      const job: JobFilterInput = { ...PASSING_FIXED_JOB, budgetAmountFixed: 100 };
      const result = applyHardFilters(job, DEFAULT_FLOORS);
      expect(result.passed).toBe(true);
    });

    it('rejects a fixed job below the floor ($99)', () => {
      const job: JobFilterInput = { ...PASSING_FIXED_JOB, budgetAmountFixed: 99 };
      const result = applyHardFilters(job, DEFAULT_FLOORS);
      expect(result.passed).toBe(false);
      if (!result.passed) {
        expect(result.reason).toBe('Budget Too Low');
      }
    });

    it('rejects a fixed job with null budget (MCP did not return it)', () => {
      const job: JobFilterInput = { ...PASSING_FIXED_JOB, budgetAmountFixed: null };
      const result = applyHardFilters(job, DEFAULT_FLOORS);
      expect(result.passed).toBe(false);
      if (!result.passed) {
        expect(result.reason).toBe('Missing Budget Information');
      }
    });
  });

  describe('Hourly rate floor filter', () => {
    it('passes an hourly job at exactly the floor ($15/hr)', () => {
      const job: JobFilterInput = { ...PASSING_HOURLY_JOB, hourlyRateMax: 15 };
      const result = applyHardFilters(job, DEFAULT_FLOORS);
      expect(result.passed).toBe(true);
    });

    it('rejects an hourly job below the floor ($14/hr)', () => {
      const job: JobFilterInput = { ...PASSING_HOURLY_JOB, hourlyRateMax: 14 };
      const result = applyHardFilters(job, DEFAULT_FLOORS);
      expect(result.passed).toBe(false);
      if (!result.passed) {
        expect(result.reason).toBe('Below Fee Floor');
      }
    });

    it('rejects an hourly job with null rate (MCP did not return it)', () => {
      const job: JobFilterInput = { ...PASSING_HOURLY_JOB, hourlyRateMax: null };
      const result = applyHardFilters(job, DEFAULT_FLOORS);
      expect(result.passed).toBe(false);
      if (!result.passed) {
        expect(result.reason).toBe('Missing Budget Information');
      }
    });
  });

  describe('Custom floor values', () => {
    it('respects a raised hourly floor of $20/hr', () => {
      const raisedFloors: FilterFloors = { hourlyRateFloorUsd: 20, fixedPriceFloorUsd: 100 };
      const job: JobFilterInput = { ...PASSING_HOURLY_JOB, hourlyRateMax: 18 };
      const result = applyHardFilters(job, raisedFloors);
      expect(result.passed).toBe(false);
      if (!result.passed) {
        expect(result.reason).toBe('Below Fee Floor');
      }
    });

    it('respects a raised fixed floor of $200', () => {
      const raisedFloors: FilterFloors = { hourlyRateFloorUsd: 15, fixedPriceFloorUsd: 200 };
      const job: JobFilterInput = { ...PASSING_FIXED_JOB, budgetAmountFixed: 150 };
      const result = applyHardFilters(job, raisedFloors);
      expect(result.passed).toBe(false);
      if (!result.passed) {
        expect(result.reason).toBe('Budget Too Low');
      }
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('rejects a job with hourlyRateMax at $14.99 (just below $15.00 floor)', () => {
      const job: JobFilterInput = { ...PASSING_HOURLY_JOB, hourlyRateMax: 14.99 };
      const result = applyHardFilters(job, DEFAULT_FLOORS);
      expect(result.passed).toBe(false);
      if (!result.passed) {
        expect(result.reason).toBe('Below Fee Floor');
      }
    });

    it('rejects a job with fixed budget at $99.99 (just below $100 floor)', () => {
      const job: JobFilterInput = { ...PASSING_FIXED_JOB, budgetAmountFixed: 99.99 };
      const result = applyHardFilters(job, DEFAULT_FLOORS);
      expect(result.passed).toBe(false);
      if (!result.passed) {
        expect(result.reason).toBe('Budget Too Low');
      }
    });

    it('rejects a job with NaN hourlyRateMax', () => {
      const job: JobFilterInput = { ...PASSING_HOURLY_JOB, hourlyRateMax: NaN };
      const result = applyHardFilters(job, DEFAULT_FLOORS);
      expect(result.passed).toBe(false);
      if (!result.passed) {
        expect(result.reason).toBe('Missing Budget Information');
      }
    });

    it('rejects a job with NaN budgetAmountFixed', () => {
      const job: JobFilterInput = { ...PASSING_FIXED_JOB, budgetAmountFixed: NaN };
      const result = applyHardFilters(job, DEFAULT_FLOORS);
      expect(result.passed).toBe(false);
      if (!result.passed) {
        expect(result.reason).toBe('Missing Budget Information');
      }
    });

    it('rejects a job with an unknown budgetType (e.g. WEEKLY)', () => {
      const job: JobFilterInput = { ...PASSING_FIXED_JOB, budgetType: 'WEEKLY' };
      const result = applyHardFilters(job, DEFAULT_FLOORS);
      expect(result.passed).toBe(false);
      if (!result.passed) {
        expect(result.reason).toBe('Missing Budget Information');
      }
    });
  });

  describe('Missing budget type', () => {
    it('rejects a job with null budgetType', () => {
      const job: JobFilterInput = { ...PASSING_FIXED_JOB, budgetType: null };
      const result = applyHardFilters(job, DEFAULT_FLOORS);
      expect(result.passed).toBe(false);
      if (!result.passed) {
        expect(result.reason).toBe('Missing Budget Information');
      }
    });
  });

  describe('Client spend filter', () => {
    it('passes a job when no spend minimum is set (0)', () => {
      const job: JobFilterInput = { ...PASSING_FIXED_JOB, clientTotalSpend: 0 };
      const result = applyHardFilters(job, { ...DEFAULT_FLOORS, clientMinTotalSpendUsd: 0 });
      expect(result.passed).toBe(true);
    });

    it('rejects a job whose client spend is below the minimum', () => {
      const job: JobFilterInput = { ...PASSING_FIXED_JOB, clientTotalSpend: 500 };
      const result = applyHardFilters(job, { ...DEFAULT_FLOORS, clientMinTotalSpendUsd: 1000 });
      expect(result.passed).toBe(false);
      if (!result.passed) {
        expect(result.reason).toBe('Client Spend Too Low');
      }
    });

    it('passes a job whose client spend is exactly at the minimum', () => {
      const job: JobFilterInput = { ...PASSING_FIXED_JOB, clientTotalSpend: 1000 };
      const result = applyHardFilters(job, { ...DEFAULT_FLOORS, clientMinTotalSpendUsd: 1000 });
      expect(result.passed).toBe(true);
    });

    it('passes a job when client spend is null (not returned by MCP)', () => {
      // A null spend is not punished: the filter only rejects a known low spend.
      const job: JobFilterInput = { ...PASSING_FIXED_JOB, clientTotalSpend: null };
      const result = applyHardFilters(job, { ...DEFAULT_FLOORS, clientMinTotalSpendUsd: 1000 });
      expect(result.passed).toBe(true);
    });
  });

  describe('Payment verified toggle', () => {
    it('passes an unverified job when paymentVerifiedRequired is false', () => {
      const job: JobFilterInput = { ...PASSING_FIXED_JOB, paymentVerified: false };
      const result = applyHardFilters(job, {
        ...DEFAULT_FLOORS,
        paymentVerifiedRequired: false,
      });
      expect(result.passed).toBe(true);
    });

    it('still rejects an unverified job when paymentVerifiedRequired is true', () => {
      const job: JobFilterInput = { ...PASSING_FIXED_JOB, paymentVerified: false };
      const result = applyHardFilters(job, {
        ...DEFAULT_FLOORS,
        paymentVerifiedRequired: true,
      });
      expect(result.passed).toBe(false);
      if (!result.passed) {
        expect(result.reason).toBe('Payment Not Verified');
      }
    });
  });

  describe('Custom niche keywords', () => {
    it('passes a job matching a custom keyword not in the default list', () => {
      const job: JobFilterInput = {
        ...PASSING_FIXED_JOB,
        title: 'Need Amazon Listing Optimization expert',
        description: 'Help us improve our Amazon Listing Optimization',
      };
      const result = applyHardFilters(job, {
        ...DEFAULT_FLOORS,
        nicheKeywords: ['Amazon Listing Optimization'],
      });
      expect(result.passed).toBe(true);
    });

    it('rejects a job that matches only a default niche when custom keywords replace them', () => {
      // "A Plus Content" is a default niche, but the custom list is only
      // Packaging Design, so this job is outside the configured niche.
      const result = applyHardFilters(PASSING_FIXED_JOB, {
        ...DEFAULT_FLOORS,
        nicheKeywords: ['Packaging Design'],
      });
      expect(result.passed).toBe(false);
      if (!result.passed) {
        expect(result.reason).toBe('Outside Niche');
      }
    });
  });
});
