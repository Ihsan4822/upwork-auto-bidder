import { cookies } from 'next/headers';
import { prisma } from '@upwork-bidder/db';
import { DEFAULT_JOB_CRITERIA, parseStoredCriteria, hashToken } from '@upwork-bidder/core';
import { isDemoEmail } from '@/lib/demo';
import CriteriaForm from './CriteriaForm';

/**
 * Always render this page on the server at request time, never prerender
 * it statically at build time. The page reads the criteria from the
 * settings table, and at build time the database is not reachable: the
 * build environment has no production DATABASE_URL, so Prisma falls back
 * to the local-dev default (localhost:5432) and the read fails. The page
 * then bakes the "Could not load the current criteria" banner and the
 * defaults into the static HTML, and that stale page is served on every
 * visit even though the database works fine at runtime (the API route,
 * which is dynamic, returns the real stored criteria). A settings page
 * must also show fresh values after a save, not a build-time snapshot.
 */
export const dynamic = 'force-dynamic';

/**
 * Criteria Settings page.
 *
 * Server Component: it reads the current criteria from the settings table
 * on the server and passes them to the client form as props. This split
 * exists because the form is a client component, and importing the
 * @upwork-bidder/core barrel from a client component pulls the whole barrel
 * into the browser bundle, including token-service and the Prisma client,
 * which uses Node's `fs` module. That broke the Vercel production build
 * (PR #15, PR #16, and PR #17 all failed to compile with "Can't resolve 'fs'").
 * The form itself imports nothing from core at runtime, only the JobCriteria
 * type, which is erased at compile time.
 *
 * The page is behind the auth middleware, so only a signed-in session
 * reaches it. The API route re-checks the session on every save.
 */
const CRITERIA_KEYS = [
  'hourlyRateFloorUsd',
  'fixedPriceFloorUsd',
  'clientMinTotalSpendUsd',
  'paymentVerifiedRequired',
  'nicheKeywords',
];

export default async function CriteriaSettingsPage() {
  // The demo user sees the criteria read-only: the form disables Save and
  // the API rejects demo writes, because criteria are global settings that
  // drive Farid's live worker filtering.
  let isDemo = false;
  try {
    const cookieStore = await cookies();
    const rawToken = cookieStore.get('app_session')?.value;
    if (rawToken && rawToken.length >= 32) {
      const session = await prisma.session.findUnique({
        where: { sessionTokenHash: hashToken(rawToken) },
        include: { user: true },
      });
      isDemo = isDemoEmail(session?.user.email);
    }
  } catch {
    isDemo = false;
  }
  let criteria;
  let loadFailed = false;
  try {
    const rows = await prisma.setting.findMany({
      where: { key: { in: CRITERIA_KEYS } },
    });
    const stored: Record<string, string | undefined> = {};
    for (const row of rows) {
      stored[row.key] = row.value;
    }
    criteria = parseStoredCriteria(stored);
  } catch {
    // Database read failed: show defaults. The form still works and the
    // save path reports the real error.
    criteria = { ...DEFAULT_JOB_CRITERIA };
    loadFailed = true;
  }

  return (
    <CriteriaForm
      initialCriteria={criteria}
      defaultCriteria={DEFAULT_JOB_CRITERIA}
      loadFailed={loadFailed}
      isDemo={isDemo}
    />
  );
}
