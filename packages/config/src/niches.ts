/**
 * niches.ts — The canonical list of niches Farid serves on Upwork.
 *
 * WHY: Section 5 of the brief defines the niches in scope. Hard filters
 * reject any job whose title/description does not match this list.
 * To add a niche, add it here and run: pnpm test --filter core
 */

export const NICHES_IN_SCOPE = [
  'Amazon A Plus Content',
  'Premium A Plus',
  'A+ Content',
  'Listing Images',
  'Storefront Design',
  'Brand Story',
  'Infographics',
  'Packaging Design',
] as const;

export type NicheInScope = (typeof NICHES_IN_SCOPE)[number];

/**
 * Returns true if the given text matches at least one niche.
 * Case-insensitive substring match.
 *
 * @param text - Job title or description to check
 * @returns true if at least one niche keyword is found
 * @example matchesNiche("Need A Plus Content designer") // true
 */
export function matchesNiche(text: string): boolean {
  const lower = text.toLowerCase();
  return NICHES_IN_SCOPE.some((niche) => lower.includes(niche.toLowerCase()));
}
