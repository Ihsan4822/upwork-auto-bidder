# docs/ARCHITECTURE.md

**Last updated:** 2026-11-05 | **Phase:** 1

---

## Shape: Modular Monolith + One Worker

```
┌─────────────────────────────────────────────────────────────┐
│  apps/web  (Next.js)                                        │
│  Dashboard, Review Queue, Settings, Analytics               │
│  → Reads from DB via packages/db                            │
│  → Calls packages/core for business logic display           │
│  → Never polls Upwork directly                              │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP (server actions / API routes)
┌─────────────────────▼───────────────────────────────────────┐
│  PostgreSQL (packages/db — Prisma)                          │
│  Single source of truth for all data                        │
└─────────────────────▲───────────────────────────────────────┘
                      │ Prisma queries
┌─────────────────────┴───────────────────────────────────────┐
│  apps/worker  (Node.js + BullMQ)                            │
│  Job 1: poll-upwork  → calls packages/ai MCP adapter       │
│  Job 2: run-filters  → calls packages/core hard filters     │
│  Job 3: score-job    → calls packages/ai scoring            │
│  Job 4: draft-job    → calls packages/ai drafting           │
└─────────────────────┬───────────────────────────────────────┘
                      │ BullMQ queues
┌─────────────────────▼───────────────────────────────────────┐
│  Redis                                                      │
│  Job queue, rate limit state, retry tracking                │
└─────────────────────────────────────────────────────────────┘
```

---

## Package Dependency Graph

```
apps/web  ──────────────────────► packages/core
apps/web  ──────────────────────► packages/db
apps/web  ──────────────────────► packages/ui
apps/web  ──────────────────────► packages/config

apps/worker ────────────────────► packages/core
apps/worker ────────────────────► packages/db
apps/worker ────────────────────► packages/ai
apps/worker ────────────────────► packages/config

packages/ai ────────────────────► packages/config
packages/core ──────────────────► packages/config
packages/db ────────────────────► (Prisma only, no internal deps)
packages/ui ────────────────────► (components only, no business deps)
```

**Rule: packages never reach into apps. apps never reach into each other.**

---

## Data Flow — 7 Steps

```
1. SCHEDULE
   BullMQ timer fires → enqueues "poll-upwork" job

2. POLL (apps/worker → packages/ai → Upwork MCP)
   packages/ai/src/mcp-client.ts calls ONLY allowed MCP tools
   (search_jobs, get_job_details)
   New jobs stored in DB via packages/db — deduplicated by upwork_job_id

3. HARD FILTERS (apps/worker → packages/core)
   packages/core/src/filters.ts applies all rules from packages/config
   Failed jobs: status = FILTERED_OUT, filter_reason stored in plain words
   Passed jobs: status = SCORED_PENDING, enqueued for scoring

4. AI SCORING (apps/worker → packages/ai)
   packages/ai/src/scorer.ts sends job to AI model
   Output validated by Zod schema before storing
   Result stored in job_scores table: label, score, reasons, model, prompt version

5. DRAFT (apps/worker → packages/ai)
   APPLY and APPLY_PLUS_BOOST jobs only
   packages/ai/src/drafter.ts uses prompt from packages/ai/src/prompts/
   packages/ai/src/portfolio-matcher.ts selects best portfolio item
   Draft stored in drafts table as version 1

6. REVIEW (apps/web)
   Farid opens the review queue
   Sees: draft text, portfolio suggestion, job URL, score label + reasons
   Can edit (new version created), approve, or skip
   Approval sets status = APPROVED

7. MANUAL SUBMIT + RECORD
   Farid copies draft, opens Upwork in his own browser, submits himself
   Returns to app, clicks "Mark as Submitted Manually"
   analytics_entries row created with submitted_at timestamp
   App spends zero Connects
```

---

## Adapters (All External Calls Sit Behind These)

### Upwork MCP Adapter (`packages/ai/src/mcp-client.ts`)

- Connects to `https://mcp.upwork.com/mcp` via HTTP MCP transport
- Uses OAuth 2.1 token from `oauth_tokens` table (encrypted, server-side only)
- **Allowlist enforced:** only calls tools in `mcp-allowlist.ts`
- Any call to a banned tool throws `BannedMcpToolError` before the request is sent
- Implements: timeout (10s default), exponential backoff on 429/5xx, structured logging
- On scope change detection: stops all polling, emits `MCP_SCOPE_CHANGED` event, waits for human

### AI Model Adapter (`packages/ai/src/provider.ts`)

- Single interface: `AiProvider` with methods `score(job)` and `draft(job, portfolioItem)`
- Current implementation: Gemini 1.5 Pro via `@google/generative-ai`
- Swapping the model = editing this one file only
- All outputs validated by Zod schemas before returning

---

## Modules and Their Boundaries

| Module          | Package                             | External dependencies | Owned tables                  |
| --------------- | ----------------------------------- | --------------------- | ----------------------------- |
| Job Monitoring  | `apps/worker` + `packages/ai` (MCP) | Upwork MCP            | `jobs`                        |
| Hard Filters    | `packages/core`                     | None                  | writes to `jobs.status`       |
| AI Scoring      | `packages/ai`                       | AI model provider     | `job_scores`                  |
| Draft Engine    | `packages/ai`                       | AI model provider     | `drafts`                      |
| Portfolio Match | `packages/core`                     | None                  | reads `portfolio_items`       |
| Review Queue    | `apps/web`                          | None                  | reads/writes `review_actions` |
| Analytics       | `apps/web`                          | None                  | reads `analytics_entries`     |

**Rule: A module never reads or writes another module's owned tables directly.
All cross-module reads go through typed interfaces in `packages/core`.**

---

## Feature Flags

All feature flags live in `packages/config/src/feature-flags.ts` and the `settings` DB table.
New features ship with their flag set to `false`. Flag is enabled only after tests pass.

| Flag                  | Default | Enables                                      |
| --------------------- | ------- | -------------------------------------------- |
| `ENABLE_AI_SCORING`   | `true`  | AI scoring of filtered jobs                  |
| `ENABLE_DRAFT_ENGINE` | `true`  | Auto-drafting of APPLY/APPLY_PLUS_BOOST jobs |
| `ENABLE_ANALYTICS`    | `true`  | Analytics module                             |

---

## Hardware

**Not applicable in this MVP.**
See `packages/hardware/README.md` for the Section 13 rule that applies when hardware is added.
