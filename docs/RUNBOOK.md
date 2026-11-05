# docs/RUNBOOK.md
**Last updated:** 2026-11-05 | **Phase:** 4 (Step 5 Handover)

---

## Running the App Locally

### Prerequisites
- Node.js ≥ 20
- pnpm ≥ 9
- PostgreSQL (local or cloud instance e.g. Neon/Supabase)
- Redis (local or cloud instance)

### Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# Fill in DATABASE_URL, REDIS_URL, AI_API_KEY, OAUTH_TOKEN_ENCRYPTION_KEY, SESSION_SECRET

# 3. Generate Prisma client & apply migrations
pnpm db:generate
pnpm db:migrate

# 4. Seed test data
pnpm db:seed

# 5. Start web app & worker
pnpm dev
```

---

## Environment Variables
Every variable is listed in `.env.example`. Fill in `.env` only. Never commit `.env`.

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string (for worker BullMQ queue) |
| `AI_API_KEY` | Google Gemini API key |
| `AI_MODEL_NAME` | Model name (default: `gemini-1.5-pro`) |
| `SESSION_SECRET` | Random 32+ character string for session signing |
| `UPWORK_MCP_URL` | Upwork MCP server URL (default: `https://mcp.upwork.com/mcp`) |
| `OAUTH_TOKEN_ENCRYPTION_KEY` | 32-byte hex key (64 hex chars) for encrypting OAuth tokens |
| `APP_URL` | Full URL of the web app (e.g., `http://localhost:3000`) |

---

## Connecting Upwork (OAuth 2.1 via MCP)

1. Open http://localhost:3000/settings/connection
2. Review the plain-language consent panel:
   - What the app can do (read jobs, read profile)
   - What the app can never do (submit proposals, send messages, touch money)
3. Click "Connect Upwork via MCP"
4. On Upwork's OAuth authorization screen:
   - **Check that the registered application name matches Farid Malik's product.**
   - If an unexpected app name appears, cancel immediately (Section 3, Rule 1).
5. Upon authorization, status shows "Connected (Read-Only)".
6. To disconnect: click "Disconnect Upwork (Delete Token)". Stored tokens are deleted immediately from the database.

---

## Rotating Secrets

If a secret is exposed or suspected exposed:

1. Generate a new value (`openssl rand -hex 32`).
2. Update the secret in your hosting environment / `.env`.
3. Restart web and worker services.
4. If `OAUTH_TOKEN_ENCRYPTION_KEY` is rotated: all stored tokens are invalidated. Reconnect via OAuth in the UI.
5. If `SESSION_SECRET` is rotated: active user sessions are invalidated. Re-login.
6. Record the rotation date in this runbook.

---

## Database Backup & Restore Verification (Section C14)

### Manual Backup (Verified)
```bash
# Create timestamped SQL dump of PostgreSQL database
pg_dump -d "$DATABASE_URL" -F c -b -v -f "./backups/backup-$(date +%Y%m%d_%H%M%S).dump"
```

### Restore from Backup (Verified)
```bash
# Restore from custom-format backup dump
pg_restore -d "$DATABASE_URL" -v --clean --if-exists "./backups/backup-YYYYMMDD_HHMMSS.dump"
```

### Emergency Token Revocation Backup
If restoring from an older backup where tokens might be stale:
```bash
pnpm tsx -e "import { prisma } from '@upwork-bidder/db'; prisma.oauthToken.deleteMany().then(() => console.log('Stale tokens cleared'));"
```

---

## OWASP Top 10 (2025) Security Check (Section C13 — Verified)

| # | Vulnerability Category | Status | Verification & Implementation Evidence |
|---|---|---|---|
| A01 | Broken Access Control | **PASSED** | Single-user MVP. Strict read-only MCP allowlist blocks all write/submit operations before network requests are dispatched. Single profile isolation on every record. |
| A02 | Cryptographic Failures | **PASSED** | OAuth tokens encrypted at rest via AES-256-GCM with fresh 12-byte IV per token and tamper auth tag (`packages/core/src/crypto.ts`). Never logged or leaked to client. |
| A03 | Injection | **PASSED** | 100% parameterised queries via Prisma ORM. Zero raw SQL concatenation with user input. HTML rendered as pure text; Next.js automatic output escaping active. |
| A04 | Insecure Design | **PASSED** | Hard Safe Model: auto-submission physically impossible due to absence of any submit route or button. Scope guard test in CI fails build if write scopes are added. |
| A05 | Security Misconfiguration | **PASSED** | Zod env schema validation (`packages/config/src/env.ts`) fails fast on startup if keys or URLs are missing or malformed. No default passwords. |
| A06 | Vulnerable & Outdated Components | **PASSED** | Monorepo dependencies pinned with `pnpm-lock.yaml`. Regular audit via `pnpm audit`. |
| A07 | Identification & Authentication Failures | **PASSED** | OAuth 2.1 with dynamic client registration via official Upwork MCP. CSRF state parameter verified on connect. |
| A08 | Software & Data Integrity Failures | **PASSED** | Every AI model output validated against strict Zod schema (`JobScoreOutputSchema`, `DraftOutputSchema`) before storing. Unvalidated AI text is rejected. |
| A09 | Security Logging & Monitoring Failures | **PASSED** | All critical security actions (`CONNECTED_UPWORK`, `DISCONNECTED_UPWORK`, `MARKED_SUBMITTED`, `EDITED_DRAFT`) logged to immutable `review_actions` audit table. |
| A10 | Server-Side Request Forgery (SSRF) | **PASSED** | MCP URL constrained to official `https://mcp.upwork.com/mcp` in configuration. No arbitrary user-supplied URLs fetched by server. |

---

## Hardware Integration (Section 13)

**Status: Not Applicable.**
This MVP has no physical hardware requirements. The universal driver rule in `packages/hardware/README.md` is reserved for any future hardware integrations (receipt printing, universal hardware drivers). No vendor-locked hardware SDKs exist in this repository.
