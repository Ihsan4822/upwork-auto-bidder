# docs/PRD.md — Product Requirements Document
**Product:** Upwork Auto Bidder, Internal MVP
**Owner:** Farid Malik | **Date:** 2026-11-05 | **Phase:** 1

---

## 1. Purpose

An internal tool that:
1. Finds Upwork jobs matching Farid's Amazon design services early
2. Rejects wrong jobs fast, with clear stored reasons
3. Drafts strong, job-specific proposals in Farid's formula
4. Keeps a clean record of drafts, submissions, views, and replies

**What it is NOT:** A SaaS product. An auto-bidder. A replacement for Farid's judgement.

---

## 2. The Safe Model (Non-Negotiable)

The app connects to Upwork via the **official Upwork MCP server** at `https://mcp.upwork.com/mcp`
using **OAuth 2.1**. No developer API key registration required.

### Permitted MCP Tools (Read-Only Job Data Only)

| # | MCP Tool Pattern | Why It Is Needed |
|---|---|---|
| 1 | `search_jobs` / `find_jobs` / `list_jobs` | Run saved searches to find new job postings |
| 2 | `get_job` / `get_job_details` | Fetch full details of a specific job posting |

**Every permitted tool is read-only. No exceptions.**

### Banned MCP Tools (Build Fails If Any Appear in Config)

| Banned Pattern | Why It Is Banned |
|---|---|
| `submit_proposal` / `submit` | No auto submit, ever |
| `send_message` / `message` | No write access to messages |
| `manage_contract` / `contract` | No contract access |
| `manage_offer` / `offer` | No offer access |
| `payment` / `escrow` / `hire` | No money actions |
| `profile_write` / `edit_profile` | No profile editing |
| `timesheet` | No timesheet access |
| Any tool with `write` in the name | No write access of any kind |

> **The scope guard test at `packages/ai/tests/scope-guard.test.ts` enforces this list.
> It runs on every commit. A failure stops the build.**

### OAuth Connect Screen — Required Plain-Language Text

Before the OAuth redirect, the UI shows:

> **This app can:** Read Upwork job postings matching your searches · Read enough of your profile to match jobs to your services
>
> **This app can NEVER:** Submit a proposal or spend your Connects · Send or read messages · Touch contracts, offers, payments, or timesheets · Edit your Upwork profile
>
> The name shown on the next screen must match the name you registered with Upwork. If it does not match, close the screen immediately and report it.

---

## 3. The 7 Modules

### Module 1: Job Monitoring
- Poll the Upwork MCP on a configurable schedule (default 30 min, never faster than MCP rate limits)
- Run saved searches from the `saved_searches` table
- Deduplicate by Upwork job id — one row per job, ever
- Store all available fields; store `null` for unavailable fields; never guess

### Module 2: Hard Filters
- Run before any AI call. Failed jobs marked `FILTERED_OUT` with a plain-word reason
- Filtered jobs stay visible in a separate list — never deleted silently
- Rules (all in `packages/config/src/settings.ts` and the `settings` DB table):
  - Hourly jobs: reject if client max < `hourlyRateFloorUsd` (default: $15/hr)
  - Fixed jobs: reject if budget < `fixedPriceFloorUsd` (default: $100)
  - Reject if `payment_verified` is not true
  - Reject if job niche does not match `NICHES_IN_SCOPE`

### Module 3: AI Scoring
- Input: jobs that passed all hard filters
- Output: exactly one label (`APPLY`, `APPLY_PLUS_BOOST`, or `SKIP`), score 0–100, 3–5 reasons
- If any input is `null`, the reason list must say so explicitly
- Never invent a client fact

### Module 4: Draft Engine
- Draft proposals for `APPLY` and `APPLY_PLUS_BOOST` jobs only
- Formula from Section 5 (6 steps, ~200 words, Farid Malik sign-off)
- Generic drafts are detected, marked `DRAFT_FAILED`, with reason stored
- No invented numbers, no guaranteed conversions, no fake clients
- Every edit creates a new version row — originals never overwritten

### Module 5: Portfolio Match
- Library of Farid's portfolio items (title, niche tags, link — human-entered)
- Suggest exactly one best-matching item per draft, with a one-line reason
- Farid can change or remove the suggestion
- Never invent a sample, link, or result

### Module 6: Review Queue
- States: `NEW` → `DRAFT_READY` → `IN_REVIEW` → `APPROVED` → `SUBMITTED_MANUALLY` / `SKIPPED` / `EXPIRED`
- One screen per job: draft, suggested portfolio, job URL, action buttons
- **No "Send", "Submit to Upwork", or "Auto Bid" button anywhere in the UI**
- "Mark as Submitted" button records that Farid submitted manually — nothing else

### Module 7: Basic Analytics
- Counts only: found, filtered, scored, drafted, approved, submitted
- View rate and reply rate from Farid's manual entries only — if no data: "Not Tracked"
- Connects shown only from Farid's manual entries — the app spends zero Connects

---

## 4. Business Rules (Farid's Niches and Searches)

### Niches in Scope
Defined in `packages/config/src/niches.ts`:
- Amazon A Plus Content
- Premium A Plus
- Listing Images
- Storefront Design
- Brand Story
- Infographics
- Packaging Design

### Saved Searches (starting defaults)
Defined in `packages/config/src/saved-searches.ts` and seeded to DB:
- **Search A:** A Plus Content, Listing Images, Premium A Plus
- **Search B:** Storefront, Brand Story, Infographics, Packaging

### Proposal Formula (Section 5 of brief)
Every draft follows this order:
1. **Hook (2 lines):** Specific to this job — name the client's product or problem, give a mini plan
2. **Proof:** One portfolio sample (from Module 5), calm and factual, no hype
3. **Benefits:** Features rewritten as buyer benefits, short lines
4. **Question:** At most one clear question for the client
5. **Call to Action:** Suggest a small paid test task before the full project
6. **Close:** ~200 words total. Strong action words in hook and close. Sign off: Farid Malik

---

## 5. Out of Scope for the MVP

All items below are in `docs/OPEN-ITEMS.md` with status `DEFERRED`.

- SaaS: multi-user, public signup, billing, admin panel
- Auto submit, auto boost, auto messaging, auto replies
- Browser extension of any kind
- More than one Upwork profile (data model is profile-aware for future)
- Mobile apps (responsive web only)
- Any integration beyond the Upwork MCP and AI model provider
- Outreach, email sending, or social posting

---

## 6. Acceptance Criteria

The MVP is complete only when all 11 criteria in Section 17 of the brief are verified.
See `docs/RUNBOOK.md` for the verification checklist.
