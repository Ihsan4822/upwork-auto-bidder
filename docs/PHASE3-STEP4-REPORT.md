# Phase 3 — Step 4 Report: Draft Engine, Portfolio Match & Review Queue

**Date:** 2026-11-05 | **Developer:** Muhammad Ihsan Aslam | **Target Profile:** Farid Malik

---

## Done

1. **Module 4: Proposal Draft Engine (`packages/ai/src/drafter.ts`):**
   - Implements Farid Malik's 6-part proposal formula:
     1. First 2 lines: Hook naming client's product/problem + custom mini-plan.
     2. Proof: Calm, factual reference to 1 matched portfolio sample (no hype, no invented numbers).
     3. Buyer benefits: Features rewritten as buyer benefits.
     4. Question: At most one clear question.
     5. Call to action: Small paid test task before full project.
     6. Sign-off: "— Farid Malik", target ~200 words (180–240 words).
   - Unprovable Claims & Hype Detection (`validateProposalClaims`): Automatically flags and rejects drafts containing banned phrases (`guarantee`, `skyrocket`, `boost sales by`, etc.) or missing mandatory sign-off.
   - Word count counter (`countWords`).

2. **Module 5: Portfolio Matcher (`packages/ai/src/portfolio-matcher.ts`):**
   - Matches incoming job text against Farid's registered portfolio samples using niche tags and title keywords.
   - Suggests exactly ONE best-matching sample with a 1-line reason.
   - Never invents samples, links, or client results.
   - Allows Farid to switch or remove the matched sample in the review UI.

3. **Module 6: Review Queue & Versioning (`packages/core/src/review-queue.ts`, `apps/web`):**
   - State Machine: `NEW` → `DRAFT_READY` → `IN_REVIEW` → `APPROVED` → `SUBMITTED_MANUALLY` / `SKIPPED`.
   - Immutable Versioning: Editing a proposal draft generates a new version row (`v2`, `v3`...), preserving all historical revisions.
   - Approved View: Displays copyable proposal text, direct Upwork job link, and the "Mark as Submitted Manually" button.
   - Audit Logging: Every edit, approval, skip, and submission logged in `review_actions`.

4. **Web UI Pages & Endpoints (`apps/web`):**
   - `/queue`: Review queue dashboard with status tabs (`ALL`, `DRAFT_READY`, `IN_REVIEW`, `APPROVED`, etc.).
   - `/queue/[jobId]`: Dedicated single-job review screen with version switcher, live word counter, and proposal editor.
   - `/portfolio`: Portfolio management screen to add genuine samples with niche tags and links.
   - API endpoints: `/api/queue/jobs`, `/api/queue/jobs/[jobId]`, `/api/queue/jobs/[jobId]/action`, `/api/portfolio`.

5. **Safety Tests (Section D3 & D5):**
   - `tests/e2e/no-auto-submit.test.ts`: Playwright test verifying that no banned button labels (`Submit to Upwork`, `Auto Bid`, `Send Proposal`) exist anywhere across all application pages.
   - `tests/e2e/review-queue-flow.spec.ts`: End-to-end human flow test covering View → Edit Version → Approve → Mark Submitted Manually.

---

## Tested

- `pnpm test`:
  - `packages/ai/tests/scope-guard.test.ts`: **19 passed**
  - `packages/ai/tests/drafter.test.ts`: **6 passed**
  - `packages/ai/tests/portfolio-matcher.test.ts`: **4 passed**
  - `packages/ai/tests/scorer.test.ts`: **4 passed**
  - `packages/ai/tests/job-mapper.test.ts`: **3 passed**
  - `packages/core/tests/filters.test.ts`: **16 passed**
  - `packages/core/tests/review-queue.test.ts`: **4 passed**
  - `packages/core/tests/oauth.test.ts`: **7 passed**
  - `packages/core/tests/crypto.test.ts`: **5 passed**
  - `packages/core/tests/connection-service.test.ts`: **4 passed**
  - Total: **72 passed (72), 0 failed** in 5.11s
- `pnpm --filter worker build`: **0 errors (clean tsc build)**
- `pnpm --filter web build`: **0 errors (18/18 static and dynamic routes compiled successfully)**

---

## Standards

- **A1–A15 (Readable code):** Explicit names, zero magic numbers, modular architecture.
- **B1–B10 (Scalable):** Monolithic core, immutable draft versioning, audit logging.
- **C1–C6 (Secure):** Zero submit buttons, Zod output validation, hype claims detection.
- **D1–D5 (Testing & Safety):** Fixed sample drafting unit tests (D2), E2E review queue flow (D3), scope guard test (D4), no-auto-submit UI test (D5).
- **Section 11 (No-break rule):** Existing modules and database structures preserved.
- **Section 12 (Human easy change):** Plain English proposal formula and portfolio matcher.
- **Section 13 (Hardware):** Not applicable in this step.

---

## Safe Model Check

- ✅ Absolutely no automatic proposal submission route or button.
- ✅ The only submit-related action is "Mark as Submitted Manually", which records that Farid submitted the proposal with his own hands on Upwork.
- ✅ No unprovable claims: proposals flagged if hype phrases (`guarantee`, `skyrocket`, etc.) appear.
- ✅ Draft edits never overwrite older drafts.

---

## Hardware Check

- ✅ No hardware in this step. `packages/hardware/` remains empty per Section 13 standards.

---

## Not Done

- Module 7 (Analytics, view/reply tracking, connects tracking) and final security hardening — scheduled for Phase 4 (Step 5).

---

## Risks and Open Items

- `GAP-003`: Generic draft and hype detection implemented and verified in `packages/ai/src/drafter.ts`.

---

## Next Step

- **Phase 4 (Step 5):** Basic Analytics (Module 7), OWASP Top 10 2025 check, backup verification, and project handover.
- **Gate needed:** Reply with **"Step 5 approved"** to proceed to Analytics and final hardening.
