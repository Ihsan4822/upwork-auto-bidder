/**
 * saved-searches.ts — Default saved searches for Farid's Upwork polling.
 *
 * WHY: Section 5 of the brief specifies two starting searches. These seed the
 * `saved_searches` DB table on first run. Farid can add, edit, or disable
 * searches from the dashboard without touching this file.
 *
 * HOW TO ADD A SEARCH:
 * - For a permanent default, add it to this array and run: pnpm db:seed
 * - For a one-off, use the dashboard → Settings → Saved Searches → Add New
 */

export interface DefaultSavedSearch {
  /** Human-readable name shown in the dashboard */
  name: string;
  /** Keywords to send to the Upwork MCP job search tool */
  queryText: string;
  /** Whether this search is active on first seed */
  isActive: boolean;
  /** Poll interval in minutes. null = use the global default */
  pollIntervalMinutes: number | null;
}

export const DEFAULT_SAVED_SEARCHES: DefaultSavedSearch[] = [
  {
    name: 'Search A — A Plus Content',
    queryText: 'A Plus Content Listing Images Premium A Plus',
    isActive: true,
    pollIntervalMinutes: null, // Uses global default (30 min)
  },
  {
    name: 'Search B — Storefront & Branding',
    queryText: 'Storefront Brand Story Infographics Packaging',
    isActive: true,
    pollIntervalMinutes: null,
  },
];
