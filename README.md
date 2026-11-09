# Upwork Auto Bidder — Internal MVP

**Owner:** Muhammad Ihsan (`Ihsan4822`) | **Target Profile:** Farid Malik | **Status:** MVP Delivered & Hardened

---

## What This Is

An internal tool that finds Upwork jobs matching Farid's Amazon design services, scores them,
and drafts proposals in Farid's formula. Farid reviews every draft and **submits manually on
Upwork himself.** This app never submits anything.

> **The app reads jobs. Farid submits proposals. Always.**

---

## 30-Minute Setup (Fresh Clone)

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9 (`npm install -g pnpm`)
- PostgreSQL running locally (or free cloud Postgres from Neon / Supabase)
- Redis running locally (or Docker)

### Steps

```bash
# 1. Clone
git clone https://github.com/Ihsan4822/upwork-auto-bidder.git
cd upwork-auto-bidder

# 2. Install dependencies
pnpm install

# 3. Copy env file and fill in your values
cp .env.example .env
# Open .env and configure:
# - DATABASE_URL (PostgreSQL connection string)
# - OAUTH_TOKEN_ENCRYPTION_KEY (64 hex characters)
# - LOGIN_ALLOWED_EMAILS (e.g. your_email@example.com)
# - MAGIC_LINK_DEV_LOG=true (for localhost development login link in console) or RESEND_API_KEY
# See docs/RUNBOOK.md for full variable details.

# 4. Run database migrations
pnpm db:migrate

# 5. Seed initial settings and portfolio
pnpm db:seed

# 6. Start the application
pnpm dev

# 7. Open http://localhost:3000
# Enter your allowlisted email on /login, copy the verification link from your console log (or email),
# open /queue, then navigate to "Upwork Connection" to link Upwork.
```

**Full setup help:** see [`docs/RUNBOOK.md`](docs/RUNBOOK.md)

---

## Folder Map

```
upwork-auto-bidder/
├── apps/
│   ├── web/          → Next.js dashboard, connection, and review queue
│   └── worker/       → Background polling, scoring, drafting
├── packages/
│   ├── core/         → Business rules: filters, scoring, proposal formula, crypto
│   ├── db/           → Prisma schema, migrations, seed data, client
│   ├── ai/           → AI adapter, prompt files, output validators, allowlist
│   ├── config/       → Fee floors, niche list, feature flags, env validation
│   ├── ui/           → Shared UI helpers
│   └── hardware/     → NOT APPLICABLE (reserved, see Section 13)
├── tests/e2e/        → Playwright end-to-end tests
└── docs/             → PRD, Architecture, Decisions, Runbook, Open Items
```

---

## Change Recipes

Small, safe changes anyone can make. Run the tests listed after each change.

### Recipe 1 — Change the Fee Floor

> **Change the hourly or fixed-price minimum.**

1. Open `packages/config/src/settings.ts`
2. Update `HOURLY_RATE_FLOOR_USD` or `FIXED_PRICE_FLOOR_USD`
3. The same value is seeded to the `settings` database table on first run. For an existing
   database, update the row: `UPDATE settings SET value = '20' WHERE key = 'hourlyRateFloorUsd';`
4. Run: `pnpm --filter @upwork-bidder/core test` — the filter unit tests will verify the new floor

### Recipe 2 — Add a New Niche

> **Add a new Amazon design niche to the matching list.**

1. Open `packages/config/src/niches.ts`
2. Add the niche string to the `NICHES_IN_SCOPE` array
3. Run: `pnpm --filter @upwork-bidder/core test` — niche filter tests cover this

### Recipe 3 — Add a Saved Search

> **Add a new Upwork keyword search.**

1. Add your keyword string to `DEFAULT_SAVED_SEARCHES` in `packages/config/src/saved-searches.ts`
2. OR: add a row directly to the `saved_searches` database table with `is_active = true`
3. The worker picks it up on the next poll cycle (default: 30 minutes)

### Recipe 4 — Change the Proposal Formula

> **Edit the order or wording of the proposal sections.**

1. Open `packages/ai/src/prompts/draft-proposal.txt`
2. Edit the prompt sections (numbered 1–6 matching Section 5 of the brief)
3. Run: `pnpm --filter @upwork-bidder/ai test` — fixed-sample draft tests will show the effect
4. Commit the prompt file — all prompts are versioned in git

### Recipe 5 — Change the AI Model

> **Swap to a different AI provider or model.**

1. Open `packages/ai/src/provider.ts` — this is the **only** file to change
2. Update the provider class and model name
3. Update `AI_MODEL_NAME` in `.env` and `.env.example`
4. Add an entry in `docs/DECISIONS.md` with date, old model, new model, and reason
5. Run: `pnpm --filter @upwork-bidder/ai test` to verify outputs still pass Zod validators

---

## Clocked Agent Pipeline (Module 3 Verification)

The application integrates with the Rezolve Clocked pipeline (`packages/clocked`) for multi-stage safety, extraction, and automated decision making before any proposal draft is generated.

### Six Pipeline Stages

1. **Guard (Prompt Injection Detection):**
   - Scans job descriptions for malicious prompt injection or instructions designed to manipulate AI behavior.
   - Any job triggering high or critical injection severity is immediately routed to human review (`IN_REVIEW`), skipping automated scoring and drafting.

2. **Protect (PII Redaction):**
   - Inspects job content for sensitive personal identification information and ensures client privacy.

3. **Extract (Attribute Extraction):**
   - Extracts structured project attributes (budget amount, client total spend, client hire rate, proposal count) with strict confidence scoring.

4. **Decide (Classification and Action Recommendation):**
   - Evaluates project fit, budget validity, and client quality against Farid's criteria.
   - Generates calibrated probabilities across `APPLY_PLUS_BOOST`, `APPLY`, and `SKIP`.
   - Requires decision confidence >= 0.75 floor. If confidence falls below 0.75, the job is routed to human review.

5. **Fill (Structured Scorecard):**
   - Populates rate floor compliance, niche match quality, and factual justification reasons.

6. **Verify (Grounding and Hallucination Check):**
   - Cross-checks all assertions and extracted attributes against the raw job posting text.
   - If verification fails or claims are ungrounded, the job is safely routed to human review.

### Human Review Fallback

Clocked acts as a strict gatekeeper:
- `APPLY` / `APPLY_PLUS_BOOST`: Proceeds to draft generation via Gemini and sets status to `DRAFT_READY`.
- `SKIP`: Marked as `SKIPPED` in the database with logged reasons.
- Guard flag, low confidence (< 0.75), or ungrounded claim: Automatically routed to `IN_REVIEW` for human assessment. Zero automated assumptions made.

### Environment Setup

Configured server-side in `.env`:
- `CLOCKED_API_KEY`: Rezolve Clocked live API key (e.g. `clk_live_...`).
- `CLOCKED_BASE_URL`: API endpoint (defaults to `https://clocked.rezolve.ai/clocked`).
- `CLOCKED_ENABLED`: Set to `true` or `1` to activate Clocked evaluation in the worker pipeline.

---

## Key Documents

| Document                                       | Purpose                                               |
| ---------------------------------------------- | ----------------------------------------------------- |
| [`docs/PRD.md`](docs/PRD.md)                   | Product scope, modules, OAuth/MCP scope, out-of-scope |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Modules, data flow, adapters, queue                   |
| [`docs/DECISIONS.md`](docs/DECISIONS.md)       | Every important choice, dated, with reason            |
| [`docs/RUNBOOK.md`](docs/RUNBOOK.md)           | Run, deploy, backup, restore, security                |
| [`docs/OPEN-ITEMS.md`](docs/OPEN-ITEMS.md)     | Deferred scope, blocked items, known gaps             |
| [`AGENTS.md`](AGENTS.md)                       | First file any AI tool must read                      |

---

## Running Tests

```bash
pnpm test                  # All 80 unit and integration tests (Vitest)
pnpm test:e2e              # Playwright end-to-end tests
pnpm guard:scopes          # Scope guard test only (critical — run before every deploy)
pnpm lint                  # ESLint check
pnpm typecheck             # TypeScript strict check
pnpm format:check          # Prettier check
```

**A red test means work is not done. Never delete a failing test to go green.**
