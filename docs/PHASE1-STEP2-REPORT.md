# Phase 1 — Step 2 Report: Data & Safe Connection

**Date:** 2026-11-05 | **Developer:** Muhammad Ihsan Aslam | **Target Profile:** Farid Malik

---

## Done

1. **Database Schema & Checked-in Migrations:**
   - Generated initial PostgreSQL migration `0_init/migration.sql` via Prisma for all 11 tables with foreign keys, constraints, and indexes.
   - Checked-in `migration_lock.toml` configured for PostgreSQL.
   - Prisma Client compiled and generated cleanly.

2. **Security & Cryptography at Rest (Section 2, Rule 7):**
   - Implemented `packages/core/src/crypto.ts`: AES-256-GCM token encryption and decryption with unique 12-byte IV per secret and tamper detection.
   - Verified that OAuth tokens are never logged or stored in plaintext.

3. **Read-Only OAuth 2.1 Scope Enforcement (Section 3):**
   - Implemented `packages/core/src/oauth.ts` with strict allowlist: exactly 2 read-only scopes (`jobs:read`, `profile:read`).
   - Banned pattern detection for all submit, message, contract, payment, offer, and write access.
   - Scope change guard (`validateGrantedScopes`): immediately flags and rejects unapproved scopes if Upwork ever expands permissions.
   - Cryptographic CSRF state token generation.

4. **Connection Lifecycle Service (Section C11):**
   - Implemented `packages/core/src/connection-service.ts`:
     - Token preparation and validation before database storage.
     - 1-click token deletion on Disconnect.
     - Audit logging in `review_actions` table for `CONNECTED_UPWORK` and `DISCONNECTED_UPWORK`.

5. **Web Application & UI (Apps/Web):**
   - Configured Next.js 15 App Router with Tailwind CSS.
   - Built Upwork Connection UI (`/settings/connection`) featuring:
     - Mandatory Plain-Language Consent Panel meeting Section 3, Rule 4 ("What this app CAN do" vs "What this app CAN NEVER do").
     - 5 November 2026 Lesson Notice reminding Farid to check the registered app name before authorizing.
     - Approved Read-Only Scopes breakdown.
     - Live connection status badge (Connected / Disconnected / Scope Change Detected).
     - "Connect Upwork via MCP" and "Disconnect Upwork (Delete Token)" actions.
   - Built API Routes:
     - `/api/auth/upwork/status`: Current connection state & granted scopes.
     - `/api/auth/upwork/connect`: Generates MCP OAuth 2.1 authorization URL.
     - `/api/auth/upwork/callback`: Scope validation, AES-256-GCM encryption, and token storage.
     - `/api/auth/upwork/disconnect`: Immediate token deletion and audit log recording.

---

## Tested

- `pnpm test`:
  - `packages/ai/tests/scope-guard.test.ts`: **19 passed**
  - `packages/core/tests/connection-service.test.ts`: **4 passed**
  - `packages/core/tests/filters.test.ts`: **16 passed**
  - `packages/core/tests/oauth.test.ts`: **7 passed**
  - `packages/core/tests/crypto.test.ts`: **5 passed**
  - Total: **51 passed (51), 0 failed** in 1.80s
- `pnpm --filter @upwork-bidder/core typecheck`: **0 errors (clean)**
- `pnpm --filter web build`: **Production build succeeded (10/10 static/dynamic pages compiled cleanly)**

---

## Standards

- **A1–A15 (Readable code):** Explicit names, zero magic numbers, modular files.
- **B1–B10 (Scalable):** Monolithic core service, `profile_id` on every database record.
- **C1–C7 (Secure):** AES-256-GCM token encryption, read-only OAuth, CSRF state protection, Zod validation.
- **Section 11 (No-break rule):** All changes backward-compatible; core packages unit tested.
- **Section 12 (Human easy change):** Plain English interfaces, no hidden global state.
- **Section 13 (Hardware):** Reserved, no hardware code in this step.

---

## Safe Model Check

- ✅ No banned access: Zero write scopes allowed, zero proposal submission routes.
- ✅ No auto submit path: App contains no proposal submission endpoint or button.
- ✅ Token safety: Encrypted at rest using AES-256-GCM; deleted completely upon disconnect.
- ✅ No secret in code: Keys configured via environment variables.

---

## Hardware Check

- ✅ No hardware in this step. `packages/hardware/` remains empty per Section 13 standards.

---

## Not Done

- Live end-to-end OAuth callback exchange with real Upwork credentials (awaits Farid's test during Step 2 human gate).

---

## Risks and Open Items

- `MCP-001`: When connecting to the live Upwork MCP server, confirm that the returned scopes match `['jobs:read', 'profile:read']`.

---

## Next Step

- **Phase 2 (Step 3):** Job monitoring, hard filters execution in worker, and AI scoring (APPLY / APPLY PLUS BOOST / SKIP).
- **Gate needed:** Farid Malik checks the documented scope list, connects Upwork via the UI, and approves Phase 2 in chat.
