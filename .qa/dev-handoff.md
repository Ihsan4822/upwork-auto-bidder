# QA Handoff Report for Muse AI

## Branch and Commit
- Target Branch: fix/qa-followups
- Commit SHA: c860789
- Base Commit: 1aaf07d (main)
- Do NOT merge until QA PASS, then merge per normal flow.

## Verification Status
- Typecheck: PASSED (9/9 packages)
- Lint: PASSED (7/7 packages, 0 errors)
- Tests: PASSED (16/16 test files, 136/136 tests passed)
- Scope Guard: PASSED (19/19 tests)
- Em Dash Scan: PASSED (0 occurrences in added diff)

## QA Feedback Fixes Applied
1. **Duplicate Scoring Prevention and Historical Deduplication:**
   - Worker scoring loop in `apps/worker/src/pipeline.ts` now checks for existing score records (`prisma.jobScore.findFirst({ where: { jobId: job.id } })`) before scoring to ensure jobs are never rescored within or across poll cycles.
   - `/api/jobs/scored` now deduplicates by `jobId`, returning only the latest score per unique job to the UI.
   - Existing duplicate rows in the database (`cmw86n69y0001qrwj38ol2b39` and `cmw869usr000b7t55pl90qzme`) are marked with `[SUPERSEDED]` in their `reasons` field, preserving full historical and audit data in PostgreSQL without deletion.

2. **Draft Engine Quality and Missing Portfolio Sample Fix:**
   - In `packages/ai/src/prompts/draft-proposal.txt` and `packages/ai/src/drafter.ts`, the portfolio sample line is completely omitted when no matching portfolio item exists. Nonexistent sample references and the phrase "Not Available" are explicitly forbidden.
   - Updated `validateProposalClaims` to reject any draft containing "Not Available".
   - Regenerated version 2 proposal drafts for both CleanKoala (`2119439015822954320`, 185 words) and Lubrication bottle (`2119186224388467845`, 201 words). Both drafts contain zero occurrences of "Not Available" and zero em dashes.

3. **Upwork MCP Limit Alignment:**
   - Aligned `apps/worker/src/pipeline.ts` to call `searchJobs(query, 10)` to comply with Upwork MCP server's enforced limit constraint (`limit cannot exceed 10`).

4. **Upwork MCP Error Handling:**
   - Added JSON-RPC error checking in `UpworkMcpClient.searchJobs` to throw an error with the server's error message instead of failing silently.

5. **Upwork MCP Live getJobDetails Protocol:**
   - Updated `UpworkMcpClient.getJobDetails` to execute via session headers (`mcp-session-id`, `Authorization: Bearer`) and JSON-RPC for live `upwork.com` MCP endpoints.

6. **Freelancer Account Selection Heuristic:**
   - Updated `UpworkMcpClient` to accept `preferredName` (passing `profile.displayName` from the worker) and prioritize matching talent accounts.

7. **Registered App Name Display:**
   - Added `registeredAppName` to `/api/auth/upwork/status` response and state fallback in `/settings/connection` so the app name is always displayed.

8. **Documentation Updates:**
   - Added Clocked Agent Pipeline section to `README.md` documenting the 6 pipeline stages (Guard, Protect, Extract, Decide, Fill, Verify), decision impact, human review fallback, and environment configuration.
   - Recorded live Clocked API execution numbers in `docs/CLOCKED-LIVE-TEST.md`.
   - Recorded formal architecture decisions in `docs/DECISIONS.md`.

## QA Test Instructions for Muse
1. Inspect `/jobs/scored` route: confirm exactly 2 unique jobs appear (CleanKoala with latest score 65, and Lubrication bottle with latest score 70).
2. Inspect review queue or drafts: verify CleanKoala and Lubrication bottle have version 2 drafts that do not mention "Not Available" or nonexistent portfolio items.
3. Inspect `/settings/connection`: verify "Registered App: Upwork Proposal Assistant (Farid Malik)" is visible when settled.
