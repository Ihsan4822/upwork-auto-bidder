import { NextResponse } from 'next/server';
import { prisma } from '@upwork-bidder/db';
import { createSession, setSessionCookie } from '@/lib/auth';
import { DEMO_USER_EMAIL } from '@/lib/demo';

/**
 * POST /api/auth/demo - Start a demo session, no email needed.
 *
 * WHY: Judges for the Clocked challenge (and anyone trying the app) need
 * to walk through it without an authorized email or a real Upwork account.
 * This route signs them in as the demo user with one click. No magic link,
 * no email delivery, no allowlist check.
 *
 * SAFETY:
 * - The demo user is a fixed row (DEMO_USER_EMAIL). It is created on
 *   first use if the seed has not run yet, but it has no profile and no
 *   jobs until the demo seed is applied, so the demo shows an empty
 *   queue rather than Farid's data.
 * - Existing demo sessions are deleted first, so repeated demo logins do
 *   not accumulate session rows.
 * - The demo user sees only the demo profile's data because every
 *   business query is scoped to the current user's profile. The demo
 *   profile has no Upwork OAuth tokens, so the worker never fetches real
 *   jobs for it, and the demo user cannot change Farid's criteria (the
 *   criteria POST rejects demo users) or connect a real Upwork account.
 * - This route is public (listed in the middleware PUBLIC_PATHS) because
 *   it is the entry point for the demo. It only ever creates a session
 *   for the fixed demo user, never for an arbitrary email.
 */
export async function POST() {
  try {
    const demoUser = await prisma.user.upsert({
      where: { email: DEMO_USER_EMAIL },
      update: {},
      create: { email: DEMO_USER_EMAIL },
    });

    // One active demo session at a time; drop any older ones first.
    await prisma.session.deleteMany({ where: { userId: demoUser.id } });

    const { rawSessionToken, expiresAt } = await createSession(demoUser.id);

    const response = NextResponse.json({ ok: true });
    setSessionCookie(response, rawSessionToken, expiresAt);
    return response;
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to start the demo session' },
      { status: 500 },
    );
  }
}
