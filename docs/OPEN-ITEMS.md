# docs/OPEN-ITEMS.md

**All deferred scope, blocked items, and known gaps live here.**
**Single source of truth for all tools and human developers.**

---

## DEFERRED — Out of Scope for MVP

| ID      | Item                                                  | Status              | Notes                                                                                                  |
| ------- | ----------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------ |
| DEF-001 | SaaS: multi-user, public signup, billing, admin panel | DEFERRED            | Data model uses `profile_id` on every record — adding a second profile does not need a schema rewrite. |
| DEF-002 | Auto submit, auto boost, auto messaging, auto replies | DEFERRED — HARD BAN | Banned by Safe Model (Section 2). Cannot be added without breaking safe model guarantees.              |
| DEF-003 | Browser extension of any kind                         | DEFERRED — HARD BAN | Banned by Section 2.                                                                                   |
| DEF-004 | More than one Upwork profile simultaneously           | DEFERRED            | Schema is profile-aware. Add a profile row when needed.                                                |
| DEF-005 | Mobile apps                                           | DEFERRED            | Responsive web only in MVP.                                                                            |
| DEF-006 | Outreach, email sending, social posting               | DEFERRED            | No integration built or planned.                                                                       |
| DEF-007 | Hardware integration                                  | DEFERRED            | Section 13 rule applies when this is approved. Reserved in `packages/hardware/README.md`.              |

---

## BLOCKED BY SAFE MODEL

| ID      | Item                                                       | Blocked By                                               | Notes                                                                               |
| ------- | ---------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| BLK-001 | Reading client message history to improve scoring          | Section 2, Rule 3 — No message access                    | Messages are a write-adjacent scope. Mark client responsiveness as "Not Available". |
| BLK-002 | Automatically boosting a proposal with Connects            | Section 2, Rule 2 — No auto submit, no Connects spending | App can SUGGEST a boost. Farid decides and boosts manually on Upwork.               |
| BLK-003 | Tracking whether Upwork delivered a notification for a job | Section 2 — No write/notification scope                  | Use polling timestamp as a proxy for "early" timing.                                |

---

## MCP-SPECIFIC ITEMS

| ID      | Item                                            | Status             | Notes                                                                                        |
| ------- | ----------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------- |
| MCP-001 | Exact list of tools exposed by `mcp.upwork.com` | RESOLVED & GUARDED | Enforced by `ALLOWED_MCP_TOOLS` allowlist and automated scope guard test in CI.              |
| MCP-002 | MCP rate limits for job search polling          | RESOLVED           | Default poll interval set to 30 minutes in settings; exponential backoff active on HTTP 429. |
| MCP-003 | Job details fetch format                        | RESOLVED           | `normalizeMcpJob` extracts honest nulls for all optional/unreturned fields.                  |
| MCP-004 | `list_freelancer_proposals` action and `find_jobs` smart_search shape for notification jobs | PENDING LIVE VERIFICATION | Client uses action `invitations` (not `list`) and smart_search mode `most_recent`; both parse defensively and return [] on failure. First live worker run must confirm the actions exist and return invitations and matched jobs. See docs/DECISIONS.md 2026-11-09 correction. |
| DEMO-001 | Demo mode for judges (one-click login, sample data) | CODE DONE, SEED PENDING | Demo mode is built: POST /api/auth/demo signs in the demo user, all business queries are scoped to the current user's profile, criteria POST and Upwork connect reject demo users. The demo seed SQL (goal files, demo-seed.sql) still needs applying in Supabase, and the live demo login still needs a browser check. See docs/DECISIONS.md 2026-11-09 demo mode entry. |
| BUILD-001 | Vercel production build failed for PR #15, #16, #17 ("Can't resolve 'fs'") | FIXED, AWAITING DEPLOY VERIFICATION | Root cause: the criteria and connection pages were client components importing the @upwork-bidder/core barrel, which pulls token-service and the Prisma client (Node `fs`) into the browser bundle. Both pages are now split into a Server Component page plus a Client Component form; no client component has a runtime core or db import. Local `next build` no longer reports the fs error. The live deploy after merge was checked: the build passed on Vercel and the Criteria Settings page loads, but it showed a baked-in "Could not load the current criteria" banner because the page was statically prerendered at build time when the database was unreachable (localhost:5432). Fixed by making the page dynamic (force-dynamic); the live page after that merge must be checked to confirm the banner is gone. See docs/DECISIONS.md 2026-11-09 build failure entry and 2026-11-09 dynamic criteria page entry. |

---

## RESOLVED GAPS (MVP Hardening)

| ID      | Item                                  | Resolution                                                                                       | Verified In                                                                                 |
| ------- | ------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| GAP-001 | OWASP Top 10 2025 security check      | All 10 items analyzed and passed with specific codebase evidence.                                | `docs/RUNBOOK.md`                                                                           |
| GAP-002 | Database backup & restore procedure   | Custom-format dump and restore commands verified.                                                | `docs/RUNBOOK.md`                                                                           |
| GAP-003 | Generic draft & hype claim detector   | `validateProposalClaims` flags banned hype words and generic templates.                          | `packages/ai/src/drafter.ts`                                                                |
| GAP-004 | Connects & manual metrics tracking UI | Complete table with inline Connects, view, and reply inputs.                                     | `apps/web/src/app/analytics/page.tsx`                                                       |
| PH2-001 | Magic link passwordless login         | Allowed emails, rate limiting, token hashing, session management and middleware DB verification. | `packages/core/src/auth.ts`, `apps/web/src/lib/auth.ts`, `apps/web/src/middleware.ts`       |
| PH2-002 | Upwork MCP OAuth 2.1 PKCE switch      | Removed developer app client ID/secret, switched to MCP S256 PKCE flow.                          | `apps/web/src/app/api/auth/upwork/connect/route.ts`, `callback/route.ts`, `mcp_config.json` |
| PH2-003 | Refresh token flow and 401 retry      | Central token service with optimistic locking, skew window, 401 retry, and NeedsReconnectError.  | `packages/core/src/token-service.ts`, `apps/worker/src/index.ts`                            |
