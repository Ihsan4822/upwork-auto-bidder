/**
 * portfolio-matcher.test.ts — Unit tests for portfolio matching (Module 5).
 *
 * Verifies:
 * - Selects best matching item based on niche tags
 * - Suggests general sample if no specific tag matches
 * - Returns clear reason string
 * - Never invents items or links
 */

import { describe, it, expect } from 'vitest';
import { matchPortfolioItem, type PortfolioItemInput } from '../src/portfolio-matcher';

const SAMPLE_PORTFOLIO: PortfolioItemInput[] = [
  {
    id: 'port_1',
    title: 'Kitchen Brand Premium A Plus Content & Story',
    nicheTags: ['Amazon A Plus Content', 'Premium A Plus', 'Brand Story'],
    link: 'https://faridmalik.design/kitchen-aplus',
    isActive: true,
  },
  {
    id: 'port_2',
    title: 'Electronics Storefront & Infographics Suite',
    nicheTags: ['Storefront Design', 'Infographics'],
    link: 'https://faridmalik.design/electronics-storefront',
    isActive: true,
  },
  {
    id: 'port_3',
    title: 'Cosmetics Packaging & Listing Images',
    nicheTags: ['Listing Images', 'Packaging Design'],
    link: 'https://faridmalik.design/cosmetics-packaging',
    isActive: false, // Inactive! Must not be matched
  },
];

describe('Portfolio Matcher — Module 5', () => {
  it('matches A Plus Content job to the A Plus portfolio sample', () => {
    const jobText = 'Looking for an experienced designer to create Premium A Plus pages for Amazon';
    const result = matchPortfolioItem(jobText, SAMPLE_PORTFOLIO);

    expect(result.matchedItem).not.toBeNull();
    expect(result.matchedItem?.id).toBe('port_1');
    expect(result.matchReason).toContain('Premium A Plus');
  });

  it('matches Storefront job to the storefront sample', () => {
    const jobText = 'Need a complete Amazon storefront redesign with modern banners';
    const result = matchPortfolioItem(jobText, SAMPLE_PORTFOLIO);

    expect(result.matchedItem?.id).toBe('port_2');
    expect(result.matchReason).toContain('Storefront Design');
  });

  it('does not select inactive portfolio items', () => {
    // Only port_3 has Packaging Design, but it is inactive
    const jobText = 'Packaging design for a new Amazon product box';
    const result = matchPortfolioItem(jobText, SAMPLE_PORTFOLIO);

    expect(result.matchedItem?.id).not.toBe('port_3');
    // Fallback to active sample
    expect(result.matchedItem?.isActive).toBe(true);
  });

  it('handles empty portfolio gracefully', () => {
    const result = matchPortfolioItem('Any job text', []);
    expect(result.matchedItem).toBeNull();
    expect(result.matchReason).toContain('No active portfolio');
  });
});
