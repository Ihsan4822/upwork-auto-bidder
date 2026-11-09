/**
 * criteria.test.ts — Unit tests for the Criteria Settings module.
 *
 * The criteria page saves these values and the worker reads them on every
 * poll cycle. These tests prove the defaults, the validation, and the
 * stored-value parsing (missing or bad stored values fall back to defaults
 * instead of breaking the poll cycle).
 */

import { describe, it, expect } from 'vitest';
import {
  CriteriaSchema,
  parseStoredCriteria,
  criteriaToStoredPairs,
  DEFAULT_JOB_CRITERIA,
} from '../src/criteria';

describe('Criteria Settings — Module 2 criteria', () => {
  describe('Defaults', () => {
    it('defaults to the config floors: $15/hr, $100 fixed, no spend minimum', () => {
      expect(DEFAULT_JOB_CRITERIA.hourlyRateFloorUsd).toBe(15);
      expect(DEFAULT_JOB_CRITERIA.fixedPriceFloorUsd).toBe(100);
      expect(DEFAULT_JOB_CRITERIA.clientMinTotalSpendUsd).toBe(0);
      expect(DEFAULT_JOB_CRITERIA.paymentVerifiedRequired).toBe(true);
      expect(DEFAULT_JOB_CRITERIA.nicheKeywords.length).toBeGreaterThan(0);
    });
  });

  describe('CriteriaSchema validation', () => {
    it('accepts a valid criteria object, including an hourly floor below $15', () => {
      // The hourly minimum is deliberately NOT blocked below Farid's $15/hr
      // rate; the settings page shows his rate so he decides knowingly.
      const result = CriteriaSchema.safeParse({
        hourlyRateFloorUsd: 5,
        fixedPriceFloorUsd: 50,
        clientMinTotalSpendUsd: 0,
        paymentVerifiedRequired: true,
        nicheKeywords: ['A+ Content'],
      });
      expect(result.success).toBe(true);
    });

    it('rejects a negative hourly floor', () => {
      const result = CriteriaSchema.safeParse({
        ...DEFAULT_JOB_CRITERIA,
        hourlyRateFloorUsd: -1,
      });
      expect(result.success).toBe(false);
    });

    it('rejects an empty niche keyword list', () => {
      const result = CriteriaSchema.safeParse({
        ...DEFAULT_JOB_CRITERIA,
        nicheKeywords: [],
      });
      expect(result.success).toBe(false);
    });

    it('rejects more than 20 niche keywords', () => {
      const result = CriteriaSchema.safeParse({
        ...DEFAULT_JOB_CRITERIA,
        nicheKeywords: Array.from({ length: 21 }, (_, i) => `Keyword ${i}`),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('parseStoredCriteria', () => {
    it('returns defaults when nothing is stored', () => {
      const criteria = parseStoredCriteria({});
      expect(criteria).toEqual(DEFAULT_JOB_CRITERIA);
    });

    it('applies stored numeric and boolean values over the defaults', () => {
      const criteria = parseStoredCriteria({
        hourlyRateFloorUsd: '10',
        fixedPriceFloorUsd: '200',
        clientMinTotalSpendUsd: '5000',
        paymentVerifiedRequired: 'false',
        nicheKeywords: JSON.stringify(['Packaging Design']),
      });
      expect(criteria.hourlyRateFloorUsd).toBe(10);
      expect(criteria.fixedPriceFloorUsd).toBe(200);
      expect(criteria.clientMinTotalSpendUsd).toBe(5000);
      expect(criteria.paymentVerifiedRequired).toBe(false);
      expect(criteria.nicheKeywords).toEqual(['Packaging Design']);
    });

    it('falls back to the default for an unparsable stored number', () => {
      const criteria = parseStoredCriteria({ hourlyRateFloorUsd: 'not-a-number' });
      expect(criteria.hourlyRateFloorUsd).toBe(DEFAULT_JOB_CRITERIA.hourlyRateFloorUsd);
    });

    it('falls back to the default niche list for unparsable stored JSON', () => {
      const criteria = parseStoredCriteria({ nicheKeywords: '{broken json' });
      expect(criteria.nicheKeywords).toEqual(DEFAULT_JOB_CRITERIA.nicheKeywords);
    });

    it('falls back to defaults when a stored value is out of range', () => {
      const criteria = parseStoredCriteria({ hourlyRateFloorUsd: '999999' });
      expect(criteria.hourlyRateFloorUsd).toBe(DEFAULT_JOB_CRITERIA.hourlyRateFloorUsd);
    });
  });

  describe('criteriaToStoredPairs', () => {
    it('round-trips through parseStoredCriteria', () => {
      const pairs = criteriaToStoredPairs({
        hourlyRateFloorUsd: 10,
        fixedPriceFloorUsd: 200,
        clientMinTotalSpendUsd: 5000,
        paymentVerifiedRequired: false,
        nicheKeywords: ['Packaging Design', 'A+ Content'],
      });
      const criteria = parseStoredCriteria(pairs);
      expect(criteria.hourlyRateFloorUsd).toBe(10);
      expect(criteria.fixedPriceFloorUsd).toBe(200);
      expect(criteria.clientMinTotalSpendUsd).toBe(5000);
      expect(criteria.paymentVerifiedRequired).toBe(false);
      expect(criteria.nicheKeywords).toEqual(['Packaging Design', 'A+ Content']);
    });
  });
});
