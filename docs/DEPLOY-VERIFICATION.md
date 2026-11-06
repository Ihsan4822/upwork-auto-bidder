# Deploy Verification Report

Verification executed on branch `fix/deploy-prep` at base commit `c781f58`.

## Preliminary Services Check

- `pnpm db:migrate`: FAIL - PrismaClientInitializationError: Can't reach database server at localhost:5432. Local PostgreSQL service is not installed or running on this Windows host.
- `pnpm db:seed`: SKIPPED - Depends on database server availability; could not run due to unreachable PostgreSQL.

## Ordered Local Verification Commands

1. `pnpm install`: PASS - Scope: all 8 workspace projects, lockfile up to date, completed in 2.1s with 0 errors.
2. `pnpm typecheck`: PASS - Turbo run typecheck in 7 packages: 7 successful, 0 errors.
3. `pnpm lint`: PASS - Turbo run lint in 7 packages: 5 successful, 0 errors.
4. `pnpm test`: PASS - Vitest run 13 test files: 114 passed out of 114 tests (4.19s).
5. `pnpm guard:scopes`: PASS - Vitest run scope-guard.test.ts: 19 passed out of 19 tests (586ms).
6. `pnpm build`: PASS - Turbo run build (web + worker): 2 successful, 27/27 Next.js static and dynamic routes compiled.
7. `pnpm test:e2e`: PASS - Playwright run: 10 passed out of 10 tests across no-auto-submit and review-queue-flow (35.6s).
