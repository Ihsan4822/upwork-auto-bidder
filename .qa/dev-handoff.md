# QA Handoff Report for Muse AI

## Branch and Commit
- Target Branch: fix/loopback-bootstrap
- Base Commit: 019617d (main)
- Do NOT merge until QA PASS, then merge per normal flow.

## Verification Status
- Typecheck: PASSED (9/9 packages)
- Lint: PASSED (7/7 packages)
- Tests: PASSED (15/15 test files, 132/132 tests passed)
- Scope Guard: PASSED (19/19 tests)
- Em Dash Scan: PASSED (0 occurrences in codebase and diff)

## Feature: Upwork Loopback Bootstrap & RFC 8707 Resource Parameter Support
- Files Changed:
  - .env.example
  - apps/web/src/app/api/auth/upwork/connect/route.ts
  - apps/web/src/app/api/auth/upwork/callback/route.ts
  - apps/web/src/app/api/auth/upwork/status/route.ts
  - packages/config/src/env.ts
  - packages/core/src/token-service.ts
  - packages/core/tests/token-service.test.ts
- Changes Implemented:
  1. Optional `UPWORK_CLIENT_ID` env support: When defined, used as client_id in the authorize URL (connect route) and in the token exchange (callback route) and refresh requests (token-service). When unset, falls back to the client metadata document URL.
  2. Documented in `.env.example` that `UPWORK_CLIENT_ID` is strictly local-only for loopback bootstrap and must NEVER be set in Vercel production.
  3. Added RFC 8707 resource parameter (`resource=https://mcp.upwork.com/mcp`) to authorize URL, token exchange, and refresh requests per the MCP Authorization spec.
  4. Added unit test verifying token refresh incorporates `UPWORK_CLIENT_ID` and the RFC 8707 resource parameter.
  5. Implemented RFC 6749 Section 5.1 default scope handling in callback route: when Upwork token response omits scope or returns empty string, defaults to requested ALLOWED_OAUTH_SCOPES (jobs:read, profile:read). When present, validates strictly for exact required scopes. Logs token response field names only (Object.keys) for diagnosis.

## Preserved Invariants
- Client metadata document route preserved intact.
- Hourly floor ($15/hr) and fixed floor ($100) strictly preserved.
- Safe model, zero auto-submit, OAuth/MCP flows, scoring, and Clocked code intact.
