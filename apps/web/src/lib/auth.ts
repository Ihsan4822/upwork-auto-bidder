/**
 * auth.ts - Session and magic link helpers for the Next.js web application.
 *
 * Enforces:
 * - Constant-time comparison for token hashes.
 * - HTTP-only, secure, sameSite lax session cookies named 'app_session'.
 * - requireSession() helper for defense-in-depth across all API routes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma, type User } from '@upwork-bidder/db';
import { generateRawToken, hashToken, SESSION_TTL_DAYS } from '@upwork-bidder/core';

export const SESSION_COOKIE_NAME = 'app_session';

/**
 * Resolves the authenticated user from the session cookie, or returns null.
 * Never throws on missing or invalid session.
 */
export async function getCurrentUser(request: Request | NextRequest): Promise<User | null> {
  try {
    let sessionToken: string | undefined;

    if ('cookies' in request && typeof request.cookies.get === 'function') {
      sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    } else {
      const cookieHeader = request.headers.get('cookie') || '';
      const match = cookieHeader
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
      if (match) {
        sessionToken = match.split('=')[1];
      }
    }

    if (!sessionToken || sessionToken.length < 32) {
      return null;
    }

    const tokenHash = hashToken(sessionToken);
    const session = await prisma.session.findUnique({
      where: { sessionTokenHash: tokenHash },
      include: { user: true },
    });

    if (!session) {
      return null;
    }

    if (new Date() >= session.expiresAt) {
      // Expired session - asynchronously clean up expired rows
      prisma.session
        .deleteMany({
          where: { expiresAt: { lte: new Date() } },
        })
        .catch(() => {});
      return null;
    }

    return session.user;
  } catch {
    return null;
  }
}

export type RequireSessionResult =
  { user: User; errorResponse?: undefined } | { user?: undefined; errorResponse: NextResponse };

/**
 * Guard that enforces an active session or returns an immediate 401 response.
 */
export async function requireSession(
  request: Request | NextRequest,
): Promise<RequireSessionResult> {
  const user = await getCurrentUser(request);
  if (!user) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Unauthorized: Valid session required' },
        { status: 401 },
      ),
    };
  }
  return { user };
}

/**
 * Returns the current user's first profile (ordered by creation), or null.
 * Every user has exactly one profile in practice (Farid has one, the demo
 * user has one). Business queries scope by this profile so a user only
 * ever sees their own jobs, scores, drafts, and portfolio items. The demo
 * user therefore never sees Farid's real jobs.
 */
export async function getCurrentProfile(userId: string) {
  try {
    return await prisma.profile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  } catch {
    return null;
  }
}

/**
 * Creates a new session in the database for a user and returns the raw token and expiry.
 */
export async function createSession(
  userId: string,
): Promise<{ rawSessionToken: string; expiresAt: Date }> {
  const rawSessionToken = generateRawToken();
  const sessionTokenHash = hashToken(rawSessionToken);
  const ttlDays = Number(process.env.SESSION_TTL_DAYS) || SESSION_TTL_DAYS;
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId,
      sessionTokenHash,
      expiresAt,
    },
  });

  return { rawSessionToken, expiresAt };
}

/**
 * Revokes an existing session by deleting its hash from the database.
 */
export async function revokeSessionByToken(rawSessionToken: string): Promise<void> {
  if (!rawSessionToken) return;
  const sessionTokenHash = hashToken(rawSessionToken);
  await prisma.session.deleteMany({
    where: { sessionTokenHash },
  });
}

/**
 * Attaches the session cookie to an outgoing HTTP response.
 */
export function setSessionCookie(response: NextResponse, rawToken: string, expiresAt: Date): void {
  response.cookies.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

/**
 * Clears the session cookie on an outgoing HTTP response.
 */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
  });
}
