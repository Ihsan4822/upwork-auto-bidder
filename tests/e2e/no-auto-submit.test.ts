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
  'apply now',
];

/** Pages across the app to check */
const REVIEW_QUEUE_PAGES = [
  '/',
  '/queue',
  '/portfolio',
  '/settings/connection',
  '/jobs/filtered',
  '/jobs/scored',
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
  for (const path of REVIEW_QUEUE_PAGES) {
    test(`No banned submit buttons on ${path}`, async ({ page }) => {
      await page.goto(path);
      const bannedButtons = await findBannedButtons(page);

      // If this assertion fails: remove the offending button immediately.
      expect(bannedButtons).toEqual([]);

      if (bannedButtons.length > 0) {
        console.error('❌ BANNED SUBMIT BUTTONS FOUND:');
        for (const btn of bannedButtons) {
          console.error(`   ${btn}`);
        }
      }
    });
  }

  test('"Mark as Submitted Manually" button is distinct from auto-submit', async ({ page }) => {
    await page.goto('/queue');
    const bannedButtons = await findBannedButtons(page);
    expect(bannedButtons).toEqual([]);
  });
});
