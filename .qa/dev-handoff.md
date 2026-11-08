# QA Handoff Report for Muse AI

## Branch and Commit
- Target Branch: fix/login-prisma-engine
- Base Commit: ddd0bfd (main)
- Do NOT merge to main without approval.

## Verification Status
- Typecheck: PASSED (9/9 packages)
- Lint: PASSED (7/7 packages)
- Tests: PASSED (15/15 test files, 131/131 tests passed)
- Scope Guard: PASSED (19/19 tests)
- Next.js Web Build: PASSED (27/27 pages compiled successfully)
- Build Output Inspection: PASSED (libquery_engine-rhel-openssl-3.0.x.so.node confirmed present in .next/server/app/login alongside page.js and traced in page.js.nft.json)
- Em Dash Scan: PASSED (0 occurrences in codebase and diff)

## Bug Fix: Prisma Query Engine Bundling for Login Page Server Bundle
- Files Changed:
  - apps/web/next.config.mjs
  - apps/web/src/app/login/page.tsx
- Root Cause:
  The Next.js outputFileTracingIncludes glob and afterEmit copy plugin in next.config.mjs covered only `/api/**/*` routes. When `apps/web/src/app/login/page.tsx` executed on Vercel as a Server Component, the query engine binary (`libquery_engine-rhel-openssl-3.0.x.so.node`) was not packaged in the `/login` serverless lambda bundle, throwing "Prisma Client could not locate the Query Engine for runtime rhel-openssl-3.0.x".
- Solutions Applied:
  1. Extended `outputFileTracingIncludes` in next.config.mjs to cover `/**/*`, `/login`, and `/login/**/*` alongside `/api/**/*`.
  2. Extended the webpack engine copy plugin to ensure `libquery_engine-rhel-openssl-3.0.x.so.node` is copied into `.next/server/app/login`, `.next/server/app`, `.next/server/chunks`, and `.next/server`.
  3. Added `console.error('[LoginPage] Session lookup failed:', err)` in the catch block of `login/page.tsx` for full visibility in Vercel runtime logs.
  4. Verified all Server Component pages in `apps/web/src/app`: `login/page.tsx` is the only page importing Prisma directly; all other data pages query through `/api` routes.
  5. Verified post-build output: `.next/server/app/login/libquery_engine-rhel-openssl-3.0.x.so.node` exists and `page.js.nft.json` contains query engine traces.

## Preserved Invariants
- Redirect logic and shouldRedirect structure preserved.
- Hourly floor ($15/hr) and fixed floor ($100) strictly preserved.
- Safe model and no-auto-submit policy untouched.
- OAuth and MCP flows, scoring pipeline, and Clocked code intact.
