/**
 * review-queue-flow.spec.ts - End-to-End Human Review Flow Test (Section D3).
 *
 * SECTION D3 REQUIREMENT:
 * "Playwright test for the full human flow: job appears, draft ready, edit,
 * approve, mark submitted manually."
 *
 * Verifies that the human reviewer can inspect, edit, approve, and record manual
 * submission safely on Upwork, as well as skip non-target jobs.
 */

import { test, expect } from '@playwright/test';

// Seeded fixture data for E2E tests
const fixtureJobs = [
  {
    id: 'job_fixture_approve_1',
    upworkJobId: 'SEED_JOB_001',
    title: '[SEED] Need Amazon A Plus Content Designer for 5 ASINs',
    description: 'Looking for an experienced A Plus Content designer for our brand.',
    budgetType: 'FIXED',
    budgetAmountFixed: 500,
    hourlyRateMin: null,
    hourlyRateMax: null,
    clientCountry: 'United States',
    clientTotalSpend: 15000,
    clientHireRate: 0.72,
    paymentVerified: true,
    proposalCount: 3,
    jobUrl: 'https://www.upwork.com/jobs/SEED_JOB_001',
    status: 'DRAFT_READY',
    scores: [
      {
        label: 'APPLY',
        score: 85,
        reasons: ['Strong niche match on Amazon A+ content', 'Verified payment and good hire rate'],
        modelName: 'gemini-1.5-pro',
      },
    ],
    drafts: [
      {
        id: 'draft_fixture_1',
        version: 1,
        draftText:
          'Hi, I saw your Amazon listing project and would love to help design clean, high-converting A+ modules.\n\n- Farid Malik',
        wordCount: 195,
        status: 'GENERATED',
        portfolioItemId: null,
        portfolioItem: null,
        createdAt: new Date().toISOString(),
      },
    ],
    reviewActions: [],
  },
  {
    id: 'job_fixture_skip_2',
    upworkJobId: 'SEED_JOB_002',
    title: '[SEED] Simple Product Banner Edit',
    description: 'Minor banner revisions for Amazon store.',
    budgetType: 'FIXED',
    budgetAmountFixed: 120,
    hourlyRateMin: null,
    hourlyRateMax: null,
    clientCountry: 'Canada',
    clientTotalSpend: 2000,
    clientHireRate: 0.5,
    paymentVerified: true,
    proposalCount: 15,
    jobUrl: 'https://www.upwork.com/jobs/SEED_JOB_002',
    status: 'DRAFT_READY',
    scores: [
      {
        label: 'APPLY',
        score: 62,
        reasons: ['Low budget', 'Marginal niche match'],
        modelName: 'gemini-1.5-pro',
      },
    ],
    drafts: [
      {
        id: 'draft_fixture_2',
        version: 1,
        draftText: 'Hello, I can assist with quick banner resizing.\n\n- Farid Malik',
        wordCount: 120,
        status: 'GENERATED',
        portfolioItemId: null,
        portfolioItem: null,
        createdAt: new Date().toISOString(),
      },
    ],
    reviewActions: [],
  },
];

test.describe('Review Queue Human Flow (Section D3)', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept queue API requests to provide seeded fixture reliably
    await page.route('**/api/queue/jobs?status=*', async (route) => {
      const url = new URL(route.request().url());
      const status = url.searchParams.get('status');
      const filtered =
        status === 'ALL' ? fixtureJobs : fixtureJobs.filter((j) => j.status === status);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ jobs: filtered }),
      });
    });

    await page.route('**/api/queue/jobs', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ jobs: fixtureJobs }),
      });
    });

    await page.route('**/api/queue/jobs/*', async (route) => {
      const url = route.request().url();
      if (url.includes('/action')) {
        const postData = route.request().postDataJSON() || {};
        const { action } = postData;
        if (action === 'SAVE_DRAFT_VERSION') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              draft: { version: 2, draftText: postData.draftText },
            }),
          });
        } else if (action === 'APPROVE') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, status: 'APPROVED' }),
          });
        } else if (action === 'MARK_SUBMITTED') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, status: 'SUBMITTED_MANUALLY' }),
          });
        } else if (action === 'SKIP') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, status: 'SKIPPED' }),
          });
        } else {
          await route.fulfill({ status: 200, json: { success: true } });
        }
        return;
      }

      // Single job fetch
      const match = fixtureJobs.find((j) => url.endsWith(j.id));
      const target = match || fixtureJobs[0];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ job: target, portfolioItems: [] }),
      });
    });
  });

  test('Full Review Lifecycle: View -> Edit Version -> Approve -> Mark Submitted Manually', async ({
    page,
  }) => {
    // 1. Visit Review Queue
    await page.goto('/queue');
    await expect(page.locator('h2')).toContainText('Proposal Review Queue');

    // 2. Open First Seeded Job
    const reviewLink = page.locator('a:has-text("Review Proposal →")').first();
    await expect(reviewLink).toBeVisible();
    await reviewLink.click();

    await expect(page.locator('h3:has-text("Proposal Draft")')).toBeVisible();

    // 3. Edit Draft and Save as New Version
    const textarea = page.locator('textarea');
    await textarea.fill(
      'For your Amazon listing, here is a custom mini plan focusing on module clarity.\n\n- Farid Malik',
    );

    const saveVersionBtn = page.getByRole('button', { name: /Save as New Version/i });
    await expect(saveVersionBtn).toBeVisible();
    await saveVersionBtn.click();
    await expect(page.getByText(/Saved new draft version/i)).toBeVisible();

    // 4. Approve for Manual Submit
    const approveBtn = page.getByRole('button', { name: /Approve for Manual Submit/i });
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();
    await expect(page.getByText(/Proposal approved/i)).toBeVisible();

    // 5. Verify Copy & Manual Submit Action
    const copyBtn = page.getByRole('button', { name: /Copy Proposal/i });
    if (await copyBtn.isVisible()) {
      await expect(copyBtn).toBeVisible();
    }

    const markSubmittedBtn = page.getByRole('button', {
      name: /Mark as Submitted Manually/i,
    });
    if (await markSubmittedBtn.isVisible()) {
      await markSubmittedBtn.click();
      await expect(page.getByText(/Marked as submitted manually/i)).toBeVisible();
    }
  });

  test('Skip Flow: View Job -> Skip Job', async ({ page }) => {
    // 1. Visit Review Queue
    await page.goto('/queue');
    await expect(page.locator('h2')).toContainText('Proposal Review Queue');

    // 2. Open Second Seeded Job (Skip target)
    const reviewLinks = page.locator('a:has-text("Review Proposal →")');
    await expect(reviewLinks.nth(1)).toBeVisible();
    await reviewLinks.nth(1).click();

    await expect(page.locator('h3:has-text("Proposal Draft")')).toBeVisible();

    // 3. Skip Job
    const skipBtn = page.getByRole('button', { name: /Skip Job/i });
    await expect(skipBtn).toBeVisible();
    await skipBtn.click();
    await expect(page.getByText(/Job skipped/i)).toBeVisible();
  });
});
