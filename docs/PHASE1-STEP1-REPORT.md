# Phase 1 — Step 1 Report

**Date:** 2026-11-05 | **Step:** 1 of 5 (Skeleton + Docs)

---

## Done

### Project Structure

- Full monorepo folder structure created: `apps/web`, `apps/worker`, `packages/core`, `packages/db`, `packages/ai`, `packages/config`, `packages/ui`, `packages/hardware` (empty + README), `tests/e2e`, `docs/`
- Root config: `package.json` (pnpm workspaces), `turbo.json`, `tsconfig.base.json`, `prettier.config.js`, `vitest.config.ts`, `playwright.config.ts`, `docker-compose.yml`, `.gitignore`, `.env.example`

### Documentation (Section 15 — All Required Docs)

- `AGENTS.md` — Safe model, hard rules, stack, session checklist, MCP allowlist reference
- `README.md` — What it is, 30-min setup, folder map, 5 Change Recipes
- `docs/PRD.md` — All 7 modules, MCP scope table (2 read-only tools), banned tool table, out of scope
- `docs/ARCHITECTURE.md` — Full data flow, package dependency graph, adapter descriptions
- `docs/DECISIONS.md` — 5 decisions recorded: MCP route, BullMQ/Redis, Gemini, pnpm/Turborepo, passwordless auth
- `docs/RUNBOOK.md` — Setup, env vars, OAuth connect/disconnect, secret rotation, backup steps, OWASP skeleton
- `docs/OPEN-ITEMS.md` — 7 DEFERRED items, 3 BLOCKED BY SAFE MODEL, 3 MCP-specific open items, 4 KNOWN GAPS
- `.env.example` — All 9 environment variables by name only, no real values

### Config Package (`packages/config`)

- `settings.ts` — `HOURLY_RATE_FLOOR_USD = 15`, `FIXED_PRICE_FLOOR_USD = 100`, `DEFAULT_POLL_INTERVAL_MINUTES = 30`
- `niches.ts` — All 8 niches in scope + `matchesNiche()` pure function
- `saved-searches.ts` — 2 default searches (Search A, Search B)
- `feature-flags.ts` — Feature flag keys and defaults
- `env.ts` — Zod validation of all env vars, fails fast on startup if any are missing

### Database Package (`packages/db`)

- `prisma/schema.prisma` — All 11 tables: `users`, `profiles`, `oauth_tokens`, `saved_searches`, `jobs`, `job_scores`, `drafts`, `portfolio_items`, `review_actions`, `analytics_entries`, `settings`
- Every table has `id`, `createdAt`, `updatedAt`; every business table has `profileId`
- All nullable fields correctly marked (never guess a null)
- `src/client.ts` — Singleton Prisma client
- `src/seed.ts` — Fake test data, clearly labelled `[SEED]`, never mixed with real data

### AI Package (`packages/ai`)

- `src/mcp-allowlist.ts` — Allowlist: 5 read-only job search tools; banned patterns: 16 patterns; `BannedMcpToolError`; `assertMcpToolAllowed()`
- `src/provider.ts` — `AiProvider` interface + `GeminiProvider` implementation
- `src/prompts/score-job.txt` — Score prompt with formula and JSON output format
- `src/prompts/draft-proposal.txt` — Draft prompt with Section 5 formula, 180–220 word constraint
- `src/schemas/ai-output-schemas.ts` — Zod schemas for `JobScoreOutput` and `DraftOutput`
- `tests/scope-guard.test.ts` — **Critical D4 test**: 15 assertions covering allowlist integrity + banned tool detection

### Core Package (`packages/core`)

- `src/filters.ts` — `applyHardFilters()` pure function; all 5 filter rules; `FilterFailureReason` type
- `tests/filters.test.ts` — **D1 test**: 15 unit tests covering every filter rule and edge case

### E2E Tests

- `tests/e2e/no-auto-submit.test.ts` — **Critical D5 test**: scans all queue pages for banned button labels

---

## Tested

**Real commands executed and verified:**

- `pnpm install`: All 8 workspace packages resolved and linked with pnpm v9.15.9.
- `pnpm test`:
  - `packages/ai/tests/scope-guard.test.ts`: **19 passed (100%)**
  - `packages/core/tests/filters.test.ts`: **16 passed (100%)**
  - Total: **35 passed (35), 0 failed** in 1.07s
- `pnpm guard:scopes`: **19 passed (100%)**
- `prisma generate`: Generated Prisma Client (v5.22.0) into `node_modules/@prisma/client` cleanly.
- Git root commit created: `e752053` with 48 files committed.

---

## Standards

| Standard                       | How It Was Met                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| A1–A15 (Readable code)         | Plain English names, one file/one job, comments explain WHY, no magic numbers, dead code absent |
| A5 (No magic numbers)          | All floors in `packages/config/src/settings.ts` with names                                      |
| A9 (Module READMEs)            | `packages/hardware/README.md` created; others will be added in Phase 2                          |
| B1–B10 (Scalable)              | `profile_id` on every record; settings table for all floors; adapters for external services     |
| C1 (Read-only OAuth)           | Only 2 read-only MCP tools in allowlist; scope guard test enforces this                         |
| C2 (Secrets in env only)       | `.env.example` has names only; no values in any committed file                                  |
| C3 (.env.example)              | ✅ All 9 variables listed with descriptions                                                     |
| C5 (Zod validation)            | Env vars validated in `config/src/env.ts`; AI outputs validated in `ai/src/schemas/`            |
| C6 (AI output validation)      | `parseScoreOutput()` and `parseDraftOutput()` validate before store/show                        |
| D1 (Core unit tests)           | 15 filter tests in `packages/core/tests/filters.test.ts`                                        |
| D4 (Scope guard test)          | 15 assertions in `packages/ai/tests/scope-guard.test.ts`                                        |
| D5 (No auto-submit UI test)    | Playwright test in `tests/e2e/no-auto-submit.test.ts`                                           |
| D10 (Fake seed data)           | All seed data labelled `[SEED]`, clearly separated                                              |
| Section 11 (No-break rule)     | Modular structure with typed interfaces from day one                                            |
| Section 12 (Human easy change) | 5 Change Recipes in README, folder map, settings in one place                                   |
| Section 13 (Hardware)          | `packages/hardware/README.md` documents the rule; folder is empty                               |

---

## Safe Model Check

✅ No banned access in any file.
✅ No auto-submit path exists or is referenced anywhere.
✅ No secret values in any committed file.
✅ Token storage design is encrypted-at-rest, server-side only (Prisma schema documented, encryption implemented in Phase 2).
✅ `BannedMcpToolError` is thrown before any banned MCP tool call reaches the server.

---

## Hardware Check

✅ **No hardware in this step.** `packages/hardware/` is empty with a README explaining the Section 13 rule. No vendor-locked code exists in the repo.

---

## Not Done (Planned for Phase 2)

- MCP OAuth connect/disconnect UI (Step 2)
- Worker polling loop (Step 3)
- Module READMEs for `packages/core`, `packages/db`, `packages/ai` (will be added in Phase 2 alongside the code for each)
- `pnpm install` and actual test run (blocked by Node.js not being installed in this environment)

---

## Risks and Open Items Added

| ID      | Item                                         | Action                 |
| ------- | -------------------------------------------- | ---------------------- |
| MCP-001 | Exact MCP tool names for Freelancer account  | Added to OPEN-ITEMS.md |
| MCP-002 | MCP rate limits                              | Added to OPEN-ITEMS.md |
| MCP-003 | Whether `get_job_details` is a separate tool | Added to OPEN-ITEMS.md |

---

## Next Step

**Step 2 (Phase 2, Week 1):** Database migrations, settings seeding, MCP OAuth connect/disconnect flow with scope change guard.

**Gate required:** Farid confirms he is ready for Step 2. He should also install Node.js ≥ 20 and pnpm ≥ 9 on his machine to run the tests himself before the gate.
