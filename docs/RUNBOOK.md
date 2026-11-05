# docs/RUNBOOK.md
**Last updated:** 2026-11-05 | **Phase:** 1

---

## Running the App Locally

### Prerequisites
- Node.js ≥ 20
- pnpm ≥ 9
- PostgreSQL (local or Docker)
- Redis (local or Docker)

### Quick Start with Docker Compose (recommended for local dev)

```bash
# Start PostgreSQL and Redis
docker compose up -d

# Install dependencies
pnpm install

# Copy env and fill in values
cp .env.example .env

# Run migrations
pnpm db:migrate

# Seed fake test data
pnpm db:seed

# Start web + worker
pnpm dev
```

### Environment Variables
Every variable is listed in `.env.example`. Fill in `.env` only. Never commit `.env`.

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `AI_API_KEY` | Google Gemini API key |
| `AI_MODEL_NAME` | Model name (default: `gemini-1.5-pro`) |
| `SESSION_SECRET` | Random 32+ character string for session signing |
| `UPWORK_MCP_URL` | Upwork MCP server URL (default: `https://mcp.upwork.com/mcp`) |
| `OAUTH_TOKEN_ENCRYPTION_KEY` | 32-byte hex key for encrypting stored OAuth tokens |
| `APP_URL` | Full URL of the web app (e.g., `http://localhost:3000`) |

---

## Seed User Credentials (Development Only)

After running `pnpm db:seed`, the app creates a seed user:
- **Email:** `farid@example.dev` *(fake, seed data only)*
- **Login:** Use the magic link sent to the email (in dev mode, the link is logged to the console)

**This is fake seed data. Never use real credentials in development.**

---

## Connecting Upwork (OAuth 2.1 via MCP)

1. Log in to the web app
2. Go to Settings → Upwork Connection
3. Read the plain-language panel showing what the app can and cannot do
4. Click "Connect Upwork"
5. You are redirected to Upwork's OAuth screen
6. **Check the app name on the screen matches the name you registered**
7. If it matches: authorize. If it does not match: **close immediately and report it**
8. You are redirected back. Connection status shows "Connected"

**To disconnect:** Settings → Upwork Connection → Disconnect. Token is deleted immediately.

---

## Rotating Secrets

If a secret is exposed or suspected exposed:

1. Generate a new value (use `openssl rand -hex 32` for key secrets)
2. Update the secret in your hosting environment's secret store
3. Update your local `.env` file
4. Restart the web and worker services
5. If `OAUTH_TOKEN_ENCRYPTION_KEY` is rotated: all stored OAuth tokens are invalidated.
   Farid must reconnect via the OAuth flow.
6. If `SESSION_SECRET` is rotated: all active sessions are invalidated. Farid must log in again.
7. Record the rotation in this runbook: date, reason (without exposing the old value)

---

## Database Backup

> **Status: Steps written. Backup test to be run once before Phase 4 completes. (GAP-002)**

### Manual Backup
```bash
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql
```

### Restore from Backup
```bash
psql $DATABASE_URL < backup-YYYYMMDD-HHMMSS.sql
```

### Automated Backups
In production: configure daily automated backups on your hosting provider (Railway, Supabase,
Render, etc.). Retain at least 7 days. Test restore once before the MVP is called complete.

---

## Rollback Per Phase

### Phase 1 Rollback (skeleton + docs)
No database migrations yet with data. Rollback = `git checkout main`.

### Phase 2 Rollback (data + OAuth connection)
1. Run `pnpm db:migrate:reset` to roll back migrations (caution: destroys data)
2. Or restore from the backup taken at the start of Phase 2
3. `git checkout` the Phase 1 tag

### General Rollback Rule
Every phase is tagged in git before the next phase starts. Rolling back = checkout the tag +
restore the database backup from that point. Target: under 15 minutes.

---

## OWASP Top 10 (2025) Check

> **Status: To be completed in Phase 4. (GAP-001)**

| # | Item | Status | Notes |
|---|---|---|---|
| A01 | Broken Access Control | PENDING | |
| A02 | Cryptographic Failures | PENDING | |
| A03 | Injection | PENDING | Parameterised queries via Prisma; Zod on all inputs |
| A04 | Insecure Design | PENDING | |
| A05 | Security Misconfiguration | PENDING | |
| A06 | Vulnerable and Outdated Components | PENDING | |
| A07 | Identification and Authentication Failures | PENDING | |
| A08 | Software and Data Integrity Failures | PENDING | |
| A09 | Security Logging and Monitoring Failures | PENDING | |
| A10 | Server-Side Request Forgery | PENDING | |

---

## Hardware

**Not applicable in this MVP.** No hardware is connected or required.
If hardware is added in a future phase, this section will list each device by name and model,
its connection type, its standard protocol or universal driver, and its test method.
