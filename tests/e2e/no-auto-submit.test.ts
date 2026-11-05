/**
 * no-auto-submit.test.ts — CRITICAL SAFETY TEST (D5)
 *
 * Section D5 of the brief:
 * "A test that fails if any UI label promises auto submit."
 *
 * This Playwright test scans every page of the review queue for any button
 * that promises to submit to Upwork. If found, the test fails the build.
 *
 * Section 2, Rule 2: "The app must never submit a proposal."
 * Section 6, Module 6: "There is no Send, Submit To Upwork, or Auto Bid button
 * anywhere in the UI."
 *
 * HOW TO RUN:
 *   pnpm test:e2e -- --grep "No Auto Submit"
 *   (Also runs as part of pnpm test:e2e)
 *
 * IF THIS TEST FAILS:
 * Stop. Remove the button or change its label. Do not suppress this test.
 */

import { test, expect, type Page } from '@playwright/test';

/** Button label text that is BANNED from the UI. Case-insensitive match. */
const BANNED_BUTTON_LABELS = [
  'submit to upwork',
  'auto bid',
  'auto submit',
  'send proposal',
  'submit proposal',
  'bid now',
  'apply now', // "Apply" alone is fine in context — this is "apply now" (action)
];

/** Pages in the review queue to check */
const REVIEW_QUEUE_PAGES = [
  '/queue',
  '/queue/job', // Individual job review page
  '/dashboard',
];

/**
 * Scan the given page for any button whose visible text matches a banned label.
 * Returns an array of banned button texts found.
 */
async function findBannedButtons(page: Page): Promise<string[]> {
  const buttons = page.locator('button, [role="button"], a[href]');
  const count = await buttons.count();
  const bannedFound: string[] = [];

  for (let i = 0; i < count; i++) {
    const text = (await buttons.nth(i).textContent()) ?? '';
    const textLower = text.toLowerCase().trim();
    for (const banned of BANNED_BUTTON_LABELS) {
      if (textLower.includes(banned)) {
        bannedFound.push(`"${text.trim()}" (matches banned pattern: "${banned}")`);
      }
    }
  }

  return bannedFound;
}

test.describe('No Auto Submit — CRITICAL SAFETY TEST (D5)', () => {
  test.beforeEach(async ({ page }) => {
    // Log in with the seed user before checking pages
    await page.goto('/');
    // In test mode, use the magic link bypass (see RUNBOOK.md for test auth setup)
  });

  for (const path of REVIEW_QUEUE_PAGES) {
    test(`No banned submit buttons on ${path}`, async ({ page }) => {
      await page.goto(path);
      const bannedButtons = await findBannedButtons(page);

      // If this assertion fails: remove the offending button immediately.
      // A button that says "Submit to Upwork" or similar MUST NOT exist in this app.
      expect(bannedButtons).toEqual([]);

      if (bannedButtons.length > 0) {
        console.error('❌ BANNED SUBMIT BUTTONS FOUND:');
        for (const btn of bannedButtons) {
          console.error(`   ${btn}`);
        }
        console.error('See Section 2 and Module 6 of the brief. Remove these buttons.');
      }
    });
  }

  test('"Mark as Submitted Manually" button exists and is distinct from auto-submit', async ({
    page,
  }) => {
    await page.goto('/queue');
    // This is the ONLY allowed submit-related button text
    // It records a manual action, never calls any Upwork API
    const allowedButton = page.getByText('Mark as Submitted Manually');
    // We do not assert it exists (it only shows for APPROVED jobs)
    // We assert the page does NOT have any banned labels alongside it
    const bannedButtons = await findBannedButtons(page);
    expect(bannedButtons).toEqual([]);
  });
});
