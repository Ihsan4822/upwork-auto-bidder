# Phase 2 — Step 3 Report: Jobs, Filters & Scoring
**Date:** 2026-11-05 | **Developer:** Muhammad Ihsan Aslam | **Target Profile:** Farid Malik

---

## Done

1. **Module 1: Job Monitoring & MCP Ingestion (`packages/ai/src/mcp-client.ts`, `job-mapper.ts`):**
   - Implemented `UpworkMcpClient`: executes read-only tool calls (`search_jobs`, `get_job_details`) strictly checked against `ALLOWED_MCP_TOOLS`.
   - Any banned tool invocation (`submit_proposal`, `send_message`, etc.) triggers a hard stop (`BannedMcpToolError`) before hitting network.
   - Built `normalizeMcpJob`: normalizes job feeds while guaranteeing honest `null` values for unavailable client fields (spend, hire rate, proposals, etc.). Never invents or guesses missing data.
   - Job deduplication by `upwork_job_id` ensures no duplicate records.

2. **Module 2: Hard Filters Pipeline (`packages/core/src/filters.ts`, `apps/worker/src/pipeline.ts`):**
   - Applies Section 5 rules before any AI model interaction:
     - Minimum hourly rate: `$15/hr` floor
     - Minimum fixed price: `$100` floor
     - Client payment verified: required
     - Amazon niche match: required
   - Jobs failing hard filters are marked `FILTERED_OUT` with exact stored reasons (`Below Fee Floor`, `Budget Too Low`, `Payment Not Verified`, `Outside Niche`).
   - Filtered out jobs are permanently preserved for auditing and are never silently deleted.

3. **Module 3: AI Scoring Engine (`packages/ai/src/scorer.ts`):**
   - Sends filtered jobs to Gemini 1.5 Pro via structured prompt `score-job.txt`.
   - Enforces single label: `APPLY`, `APPLY_PLUS_BOOST`, or `SKIP`.
   - Outputs score (0 to 100) and 3 to 5 structured reasons.
   - Explicitly notes missing/null client fields in reasons rather than hallucinating details.
   - Validates all AI outputs with Zod schema (`JobScoreOutputSchema`) before database insertion.

4. **Background Worker Service (`apps/worker/src/pipeline.ts`, `index.ts`):**
   - Complete pipeline: Poll saved searches → Deduplicate → Hard Filter → AI Score.
   - Background polling daemon with configurable schedule and graceful shutdown.

5. **Web Interface (`apps/web`):**
   - `/jobs/filtered`: Filtered Out Jobs Audit screen showing reasons and budget breakdowns.
   - `/jobs/scored`: Scored Jobs screen showing label badges (APPLY / BOOST / SKIP), score out of 100, and AI reasoning.
   - `/`: Live dashboard counts displaying total jobs found, filtered out, and scored by AI.
   - API endpoints: `/api/jobs/stats`, `/api/jobs/filtered`, `/api/jobs/scored`.

---

## Tested

- `pnpm test`:
  - `packages/ai/tests/scope-guard.test.ts`: **19 passed**
  - `packages/ai/tests/scorer.test.ts`: **4 passed**
  - `packages/ai/tests/job-mapper.test.ts`: **3 passed**
  - `packages/core/tests/filters.test.ts`: **16 passed**
  - `packages/core/tests/oauth.test.ts`: **7 passed**
  - `packages/core/tests/crypto.test.ts`: **5 passed**
  - `packages/core/tests/connection-service.test.ts`: **4 passed**
  - Total: **58 passed (58), 0 failed** in 5.30s
- `pnpm --filter worker build`: **0 errors (clean tsc output)**
- `pnpm --filter web build`: **0 errors (15/15 static and dynamic pages compiled successfully)**

---

## Standards

- **A1–A15 (Readable code):** Pure functions for job mapping, clear types on all interfaces.
- **B1–B10 (Scalable):** Monolithic worker pipeline, deduplication by unique indexed `upwork_job_id`.
- **C1–C6 (Secure):** Allowlist pre-check on every MCP tool call, honest nulls for absent data, Zod validation for every AI output.
- **D1–D2 (Testing):** Unit tests covering hard filters and AI scoring schemas with sample data.
- **Section 11 (No-break rule):** Built alongside existing Step 1 and Step 2 modules without breaking changes.
- **Section 12 (Human easy change):** Plain English audit reasons, customizable search queries.
- **Section 13 (Hardware):** Not applicable in this step.

---

## Safe Model Check

- ✅ No auto submit endpoint or trigger.
- ✅ MCP client asserts allowed read-only tools on every call.
- ✅ Hard filters discard unviable jobs before calling AI (reduces cost and eliminates irrelevant bids).
- ✅ Secrets accessed exclusively through environment variables.

---

## Hardware Check

- ✅ No hardware in this step. `packages/hardware/` remains empty per Section 13 standards.

---

## Not Done

- Module 4 (Draft Proposal Engine), Module 5 (Portfolio Matcher), and Module 6 (Review Queue approval flow) — scheduled for Phase 3 (Step 4).

---

## Risks and Open Items

- `MCP-002`: Poll frequency defaults to 30 minutes to stay well within Upwork rate limits.

---

## Next Step

- **Phase 3 (Step 4):** Proposal Draft Engine (Module 4), Portfolio Matcher (Module 5), and Review Queue (Module 6) with manual submit audit action.
- **Gate needed:** Reply with **"Step 4 approved"** to proceed to proposal drafting and the review queue flow.
