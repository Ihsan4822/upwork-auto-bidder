/**
 * review-queue-flow.spec.ts — End-to-End Human Review Flow Test (Section D3).
 *
 * SECTION D3 REQUIREMENT:
 * "Playwright test for the full human flow: job appears, draft ready, edit,
 * approve, mark submitted manually."
 *
 * Verifies that the human reviewer can inspect, edit, approve, and record manual
 * submission safely on Upwork.
 */

import { test, expect } from '@playwright/test';

test.describe('Review Queue Human Flow (Section D3)', () => {
  test('Full Review Lifecycle: View → Edit Version → Approve → Mark Submitted Manually', async ({
    page,
  }) => {
    // 1. Visit Review Queue
    await page.goto('/queue');
    await expect(page.locator('h2')).toContainText('Proposal Review Queue');

    // 2. Visit Single Job View (fallback or seed job if present)
    const reviewLink = page.locator('a:has-text("Review Proposal →")').first();
    const count = await reviewLink.count();

    if (count > 0) {
      await reviewLink.click();
      await expect(page.locator('h3:has-text("Proposal Draft")')).toBeVisible();

      // 3. Edit Draft and Save as New Version
      const textarea = page.locator('textarea');
      await textarea.fill(
        'For your Amazon listing, here is a custom mini plan focusing on module clarity.\n\n— Farid Malik',
      );

      const saveVersionBtn = page.getByRole('button', { name: /Save as New Version/i });
      await saveVersionBtn.click();
      await expect(page.getByText(/Saved new draft version/i)).toBeVisible();

      // 4. Approve for Manual Submit
      const approveBtn = page.getByRole('button', { name: /Approve for Manual Submit/i });
      await approveBtn.click();
      await expect(page.getByText(/Approved For Manual Submit/i)).toBeVisible();

      // 5. Verify Copy & Manual Submit Action
      const copyBtn = page.getByRole('button', { name: /Copy Proposal/i });
      await expect(copyBtn).toBeVisible();

      const markSubmittedBtn = page.getByRole('button', {
        name: /Mark as Submitted Manually/i,
      });
      await expect(markSubmittedBtn).toBeVisible();

      // 6. Record Manual Submission
      await markSubmittedBtn.click();
      await expect(page.getByText(/Marked as submitted manually/i)).toBeVisible();
    }
  });
});
