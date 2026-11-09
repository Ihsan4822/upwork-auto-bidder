# docs/DECISIONS.md

**Format:** Date · Decision · Reason · Rejected alternative

---

## 2026-11-05 · Use Upwork MCP Server instead of Developer API

**Decision:** Connect to Upwork via the official MCP server at `https://mcp.upwork.com/mcp`
using OAuth 2.1, instead of the Upwork Developer REST API with an API key.

**Reason:** Farid has not registered a developer app and does not want to. The MCP server
supports OAuth 2.1 with no API key registration required. It is the official, permitted route.

**Rejected:** Upwork Developer REST API (requires app registration, client ID, client secret).

**Risk noted:** The MCP server exposes tools beyond read-only job search (proposal submission,
messaging, contracts). The MCP adapter in `packages/ai/src/mcp-client.ts` enforces an
allowlist. The scope guard test fails the build if any banned tool appears in config.
See `docs/OPEN-ITEMS.md` — MCP-TOOLS-SCOPE.

---

## 2026-11-05 · BullMQ on Redis for the background job queue

**Decision:** Use BullMQ (Redis-backed) for the worker job queue.

**Reason:** Provides reliable scheduling, retries with exponential backoff, job deduplication,
and rate limiting — all required by the brief. Mature, well-documented, Node-native.

**Rejected:** `pg-boss` (PostgreSQL-backed queue). Avoids Redis but is less mature for
high-frequency polling patterns. Would also create tight coupling between the queue and
the application database.

---

## 2026-11-05 · Gemini 1.5 Pro as AI runtime provider

**Decision:** Use Google Gemini 1.5 Pro via `@google/generative-ai` for scoring and drafting.

**Reason:** Farid already has a Google AI Pro account. Good quality for structured output
generation with Zod validation. All calls go through `packages/ai/src/provider.ts` —
the model can be swapped by editing one file. Decision is not forced by the build tool choice.

**Rejected:** OpenAI GPT-4o (requires separate billing setup). Anthropic Claude (same reason).
Both are valid alternatives; swapping is a one-file change.

---

## 2026-11-05 · pnpm workspaces + Turborepo for monorepo tooling

**Decision:** Use pnpm workspaces for package management and Turborepo for build orchestration.

**Reason:** Standard, well-supported combination for TypeScript monorepos of this shape.
Single lockfile, faster installs, cached builds. Minimal configuration overhead.

**Rejected:** npm workspaces (slower, less mature workspace features). Yarn Berry (more
complex configuration for a small team). Nx (more powerful but significantly more complex
for this project size).

---

## 2026-11-05 · Passwordless (magic link) for app login

**Decision:** Use passwordless / magic link authentication for Farid's login to the web app.

**Reason:** Single-user MVP. Simpler than storing hashed passwords. No password column in
`users` table. Same security level as a strong password for a single-user internal tool.

**Rejected:** Hashed password login (adds bcrypt complexity, password reset flow, and a
password column — unnecessary for one user). SSO/OAuth for the app itself (overkill for MVP).

**Note:** The `users` table has a `magic_link_token` column and `magic_link_expires_at`.
If password login is needed in a future phase, it is added without breaking this design.

---

## 2026-11-08 · Add list_accounts to ALLOWED_MCP_TOOLS for Upwork MCP account discovery

**Decision:** Add `list_accounts` to `ALLOWED_MCP_TOOLS` in `packages/ai/src/mcp-allowlist.ts`.

**Reason:** The official Upwork MCP server (`https://mcp.upwork.com/mcp`) requires `org_uid` as a mandatory argument for `upwork__find_jobs`. Calling `upwork__list_accounts` is required to discover the user's freelancer `org_uid` before executing read-only job searches. The tool is strictly read-only, has no write capabilities, and matches none of the banned tool patterns.

**Rejected:** Hardcoding a static `org_uid` in environment configuration (fragile if account details change or during multi-account support).

---

## 2026-11-08 · Score deduplication, draft quality hardening, and Upwork MCP protocol alignment

**Decision:**
1. Check for existing score records (`jobScore.findFirst`) before invoking scoring in the worker pipeline, and deduplicate by `jobId` in `/api/jobs/scored` so only the latest score is displayed while preserving full historical audit records in PostgreSQL. Older duplicate rows are marked as superseded in their reasons field rather than deleted.
2. In the proposal drafter and prompt template, omit the portfolio sample section completely when no matching portfolio item exists. Explicitly forbid referencing nonexistent samples and ban "Not Available" text in proposal output.
3. Clamp Upwork MCP `find_jobs` search limit to 10 in both client and pipeline to strictly respect Upwork MCP server constraints (`limit cannot exceed 10`).
4. Implement session-based JSON-RPC protocol (`ensureSession`, `mcp-session-id`, `Authorization: Bearer`) for `getJobDetails` when connecting to live `upwork.com` MCP endpoints.
5. Provide `registeredAppName` in `/api/auth/upwork/status` so connection status page reliably displays the registered app name upon settlement.

**Reason:** Eliminates duplicate scores across poll cycles, ensures proposals remain grounded without referencing nonexistent samples, and prevents runtime protocol errors when calling Upwork MCP server.

**Rejected:** Silently deleting older duplicate scores from the database (violates audit history retention).

---

## 2026-11-08 · AI model changed from Gemini 1.5 Pro to Gemini 3.5 Flash

**Decision:** Change the default AI model in `packages/ai/src/provider.ts` from `gemini-1.5-pro` to `gemini-3.5-flash` (via `AI_MODEL_NAME`, default `gemini-3.5-flash`).

**Reason:** The live run on 2026-11-08 used gemini-3.5-flash and produced the first real drafts, so the code default now matches the model actually in use. AGENTS.md, ARCHITECTURE.md, and RUNBOOK.md updated to match.

**Rejected:** Keeping the stale 1.5 Pro default in code while the live run used 3.5 Flash (docs and code would disagree about which model scores jobs).

---

## 2026-11-09 · Criteria Settings page and Invitations job source

**Decision:**
1. Add a Criteria Settings page at `/settings/criteria` backed by the `settings` table. Farid sets his own minimum hourly rate, minimum fixed budget, minimum client total spend, payment-verified required (on/off), and niche keywords. The worker reads them fresh on every poll cycle, so no restart is needed. Defaults are $15/hr, $100 fixed, no spend minimum, payment verified required, and the default Amazon design niche list. The hourly minimum is deliberately NOT blocked from going below Farid's $15/hr Upwork rate; the page shows his rate next to the field so he decides knowingly.
2. Add a second job source: invitations. The worker calls the Upwork MCP tool `list_freelancer_proposals` FIRST each poll cycle, before the saved searches. Invitation jobs get `source = INVITATION`, are stored like any other job, pass the same hard filters and scoring, and sit on top of the review queue (ordered by source, then posted date) with an Invitation badge. The tool only reads; it never accepts, declines, or submits anything.
3. Add a `source` column to the `jobs` table (migration `2_criteria_invitations`, default `SEARCH`). The migration must be applied to the live Supabase database before the code that reads it is deployed.

**Reason:** Farid asked for both on 2026-11-08: only relevant jobs should arrive (irrelevant jobs were passing through the broad saved searches), and he wants to set the minimums himself. Invitations are the highest-value jobs because the client chose Farid directly, so they get priority.

**Investigation (invitations):** Upwork's own MCP page and a live tool definition read (2026-11-03) confirm the server can list a freelancer's proposals and invitations, and reading proposals is a read operation (20/min, 250/hour, 750/day). The exact tool name `list_freelancer_proposals` and its response shape are NOT confirmed from public sources, so the client tries that tool and parses defensively: on any failure (unknown tool, unexpected shape, HTTP error) it returns an empty list and logs, and the pipeline continues with saved searches. The first live run must confirm the tool exists and returns invitations; the client logs the response field names (never values) so the shape can be corrected. `list_freelancer_proposals` passes the scope guard (no banned pattern, starts with `list_`).

**Rejected:** Hard-blocking the hourly minimum at $15 (Farid explicitly wants to set it himself, including $5 or $10 examples). Building an invitations workaround that needs new OAuth scopes or write access (the current scopes jobs:read and profile:read are read-only, and the feature must work within them). Scraping the Upwork website for invitations (against the safe model; official MCP route only).

---

## 2026-11-09 · Correction: priority source is the notification feed, not invitations

**Correction:** The 2026-11-09 criteria/invitations decision treated the priority source as client invitations (list_freelancer_proposals). Ihsan corrected this with a screenshot of the Upwork notification bell: the items are "New job" alerts, and "Invites from clients" is a separate count, 0 at the time. The priority source is the notification feed, not invitations.

**Decision:**
1. Add `listNotificationJobs()` in the MCP client: `find_jobs` with action `smart_search`, mode `most_recent`. This is Upwork's own recommender for Farid's profile, no query and no skills needed. Its matches come from Upwork's Best Matches and Most Recent feeds, the same ones behind the Find Work page and the notification bell. The pipeline fetches these FIRST each cycle, stores them with source `NOTIFICATION`, and shows them near the top of the review queue with a "New job" badge.
2. Fix `listInvitations()`: the action is `invitations`, not `list`. Action `list` returns proposals Farid already submitted; action `invitations` returns the client invitations. Invitations stay as a second priority source (source `INVITATION`), fetched after the notification jobs and before saved searches. Queue order by source: INVITATION, NOTIFICATION, then SEARCH.
3. The `jobs.source` column is plain TEXT with no constraint, so `NOTIFICATION` needs no new database migration. The migration `2_criteria_invitations` already added the column.

**Investigation:** A third-party MCP skill file (jobpilot, read from GitHub) lists the tool actions: `find_jobs` has `search`, `smart_search` (mode `best_match` or `most_recent`), and `get`; `get_freelancer_dashboard` has a `check` action returning invitations, offers, messages, matched jobs, and the Connects balance in one call; `list_freelancer_proposals` has `list`, `invitations`, `get`, and `get_room`. Upwork's own MCP page confirms the freelancer dashboard summary includes matched jobs. The exact `smart_search` response shape is NOT confirmed from public sources, so the client parses defensively and returns [] on failure. The first live run must confirm both the smart_search shape and the invitations action.

**Rejected:** Keeping `list` as the invitations action (it returns submitted proposals, not invitations). Treating the notification bell as invitations (the bell's "New job" items and the "Invites from clients" count are different things).

---

## 2026-11-09 · Build failure: client components must not import the core barrel (fs)

**Problem:** The Vercel production builds for PR #15, PR #16, and PR #17 all failed with "Failed to compile. Module not found: Can't resolve 'fs'", import trace db/src/index.ts, core/src/token-service.ts, core/src/index.ts, the settings criteria page. The live site kept serving the older PR #14 build, so the Criteria Settings page returned 404 and the notification badges never appeared. A live check on 2026-11-09 15:00 PKT confirmed this.

**Root cause:** The criteria page was a client component importing DEFAULT_JOB_CRITERIA from the @upwork-bidder/core barrel. The barrel re-exports everything, including token-service, which imports the Prisma client from @upwork-bidder/db, and the db client imports Node's `fs` module to read .env files. No package declares "sideEffects": false, so webpack includes the whole barrel in the client bundle, and `fs` does not exist in the browser. The `fs` loader was added to the db client in PR #15, which is why PR #14 deployed fine and every build after it failed. The connection page had the same defect (it imported the consent text and scope list from the same barrel), so fixing only the criteria page would still have left the build broken.

**Decision:** Split both pages into a Server Component page plus a Client Component form.
1. Criteria page: page.tsx is now a Server Component that reads the criteria from the settings table and passes the current values and the defaults as props to CriteriaForm. The form imports only the JobCriteria type (erased at compile time) and saves through POST /api/settings/criteria as before.
2. Connection page: page.tsx is now a Server Component that builds the consent text and the approved scope list and passes them as props to ConnectionForm. The form keeps its client-side status fetch, Connect, and Disconnect logic, and imports nothing from core at runtime.
3. Rule going forward: no client component may import @upwork-bidder/core or @upwork-bidder/db at runtime. Server Components pass what the form needs as props. Type-only imports are fine because they are erased at compile time.

**Verification:** After the split, a local `next build` no longer reports any "Can't resolve 'fs'" error. The only remaining local build error is "Can't resolve '.prisma/client/default'", which is a local environment limit (Prisma generate cannot run here because binaries.prisma.sh is unreachable). On Vercel, Prisma generate runs during the build, so that error does not occur there. A repo-wide scan confirms no client component has a runtime core or db import. Tests 164/164, web lint 0, web typecheck 17 (baseline).

**Rejected:** Removing the `fs` loader from the db client. The worker on Ihsan's PC has no dotenv dependency and relies on that loader to find DATABASE_URL in its .env file, so removing it would break the worker. Adding "sideEffects": false to the core package (fragile, depends on webpack tree-shaking behavior, and the db client has real side effects). Deep-importing the criteria module from a client component (fragile, depends on the package exports map).

---

## 2026-11-09 · Criteria page must be dynamic, not statically prerendered

**Problem:** After PR #18 deployed successfully, /settings/criteria loaded but showed a red banner "Could not load the current criteria. Showing defaults." Diagnosis: the database is healthy at runtime (GET /api/settings/criteria returns HTTP 200 with the real stored criteria, and the Dashboard reads work). The banner was baked in at build time. Next.js statically prerendered /settings/criteria during `next build`, and the build environment has no production DATABASE_URL, so Prisma fell back to the local-dev default (localhost:5432) and the read failed. The page caught the error and rendered the banner plus defaults into the static HTML, and that stale page is served on every visit. The build log confirms it: "prisma:error, Can't reach database server at localhost:5432" during "Generating static pages", and the route table showed "○ /settings/criteria" (static) versus "ƒ /api/settings/criteria" (dynamic).

**Decision:** Add `export const dynamic = 'force-dynamic'` to the criteria page. It now renders on the server at request time and reads the database with the runtime DATABASE_URL, like the API route. A settings page must also show fresh values after a save, not a build-time snapshot, so static prerendering was wrong for this page regardless of the build-time database issue.

**Note:** The build-time DATABASE_URL gap (Turborepo warnings that env vars are missing from turbo.json) is a separate, pre-existing issue. It does not affect runtime reads on Vercel, and fixing it is not needed for this page now that the page is dynamic. The connection page does not read the database server-side, so it needs no change.
