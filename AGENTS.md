# AGENTS.md — Single Source of Truth for AI Tools

**Read this first. Every session. Every AI tool.**
Last updated: 2026-11-05 | Phase: 1

---

## What This Product Is

Internal Upwork Job Finder, Scorer and Proposal Draft Assistant.
One user: Farid Malik. One Upwork profile. Amazon design services.

**The app reads jobs. Farid submits proposals manually. The app never submits anything.**

---

## Hard Rules — Never Break These

### 1. Safe Model (Section 2 of the brief — non-negotiable)

| Rule                      | Detail                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Read-only MCP access only | Connect via official Upwork MCP at `https://mcp.upwork.com/mcp`, OAuth 2.1                                                                 |
| Allowed MCP tools         | Job search / job read tools ONLY. See `packages/ai/src/mcp-allowlist.ts`                                                                   |
| Banned MCP tools          | submit_proposal, send_message, read_messages, manage_contracts, manage_offers, payment actions, profile_write, timesheets — ANY write tool |
| No auto submit            | No submit endpoint exists. No Send button exists. UI test fails if one is added                                                            |
| No password handling      | Never store Farid's Upwork password. OAuth only                                                                                            |
| No browser extension      | No Chrome extension, no simulated clicks, no headless browsing                                                                             |
| No scraping               | Official MCP route only. If data is unavailable, store null, show "Not Available"                                                          |
| Token safety              | Tokens encrypted at rest, server-side only, never in browser/git/logs                                                                      |
| Human submit always       | Farid copies the draft, goes to Upwork, submits himself, then marks it in the app                                                          |

### 2. No-Break Rule (Section 11)

- Never change a module's internal implementation in a way that breaks its interface
- Never rename or delete a database column in the same release that stops using it
- New features ship behind a feature flag, default off
- Run the full test suite before AND after every change

### 3. Human Easy Change Rule (Section 12)

- Plain English names. No clever tricks. No hidden global state
- Every folder has a README. Root README has 5+ Change Recipes
- A new human must be able to make a change and run tests in under 30 minutes

### 4. Hardware Rule (Section 13)

- This MVP has NO hardware
- If hardware is ever added: universal driver or standard protocol FIRST
- No vendor-locked SDK in core code, ever
- See `packages/hardware/README.md`

---

## MCP Scope Guard — Critical

The MCP allowlist lives in `packages/ai/src/mcp-allowlist.ts`.
The scope guard test is at `packages/ai/tests/scope-guard.test.ts`.
**This test must pass before any deployment. Never skip it.**

The allowed MCP tools (read-only job search only):

- Tools whose names match: `search_jobs`, `get_job`, `get_job_details`, `find_jobs`, `list_jobs`, `list_accounts`
- Any tool variant that reads job postings from the Upwork MCP server

Banned tool patterns (fail the build if any appear in allowlist or config):

- `submit`, `send`, `message`, `contract`, `offer`, `payment`, `hire`, `invite`, `profile_write`, `timesheet`

---

## Stack at a Glance

| Layer      | Choice                                           |
| ---------- | ------------------------------------------------ |
| Language   | TypeScript (strict, no `any` without comment)    |
| Web        | Next.js App Router, server components            |
| Worker     | Node.js + BullMQ on Redis                        |
| Database   | PostgreSQL via Prisma                            |
| Validation | Zod everywhere (inputs, AI outputs, env vars)    |
| UI         | Tailwind CSS + shadcn/ui                         |
| AI Runtime | Gemini 1.5 Pro via `packages/ai/src/provider.ts` |
| Testing    | Vitest (unit/integration) + Playwright (e2e)     |

---

## How to Run Tests (required before reporting anything as done)

```bash
pnpm test              # All Vitest tests
pnpm test:e2e          # Playwright e2e
pnpm guard:scopes      # Scope guard (critical)
pnpm lint              # ESLint
pnpm typecheck         # TypeScript strict check
```

---

## Session Start Checklist

Before doing any work in this codebase:

1. Read this file (AGENTS.md) ✅
2. Read `docs/PRD.md` — scope, modules, what is out of scope
3. Read `docs/OPEN-ITEMS.md` — what is deferred or blocked
4. Check `docs/DECISIONS.md` for relevant past decisions
5. Run `pnpm test` and confirm all tests pass before touching code

---

## Docs Update Rule

**Code and docs update in the same step. Always.**
A merged PR with stale docs is incomplete work.
If you update business logic, update the relevant doc.
If you add a feature, update OPEN-ITEMS (remove it from deferred).
If you make an architectural decision, add it to DECISIONS.md.
