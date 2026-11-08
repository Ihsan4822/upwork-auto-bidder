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
