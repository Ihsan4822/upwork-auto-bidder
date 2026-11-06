import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@upwork-bidder/db';
import { hashToken } from '@upwork-bidder/core';

/**
 * Public routes that do not require an active app_session cookie:
 * - /login (Login page)
 * - /api/auth/login/request (Request magic link)
 * - /api/auth/login/verify (Verify magic link)
 */
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login/request',
  '/api/auth/login/verify',
  '/api/auth/upwork/client-metadata.json',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files, Next.js internal bundles, and favicon
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname === '/favicon.ico' ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Allow public authentication endpoints
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  // Check presence of session cookie
  const sessionCookie = request.cookies.get('app_session');
  const rawToken = sessionCookie?.value;

  if (!rawToken || rawToken.length < 32) {
    return unauthorizedResponse(request, pathname);
  }

  // TEST-ONLY BYPASS:
  // Clearly marked test bypass, strictly active only when NODE_ENV === 'test'.
  // Allows Playwright E2E tests to run against a real database-backed dev server
  // without failing on the mock session token.
  // In production and development (NODE_ENV !== 'test'), every request MUST verify against prisma.session.
  if (
    process.env.NODE_ENV === 'test' &&
    rawToken === 'mock_session_token_for_playwright_e2e_testing_32chars'
  ) {
    return NextResponse.next();
  }

  // Harden: verify session exists in the database and is not expired.
  // A forged 32+ char cookie with no matching DB row is rejected here.
  try {
    const tokenHash = hashToken(rawToken);
    const session = await prisma.session.findUnique({
      where: { sessionTokenHash: tokenHash },
      select: { expiresAt: true },
    });

    if (!session || new Date() >= session.expiresAt) {
      return unauthorizedResponse(request, pathname);
    }
  } catch {
    // DB unavailable - fail open for page routes (let the route handler reject),
    // but fail closed for API routes.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized: Session verification unavailable' },
        { status: 401 },
      );
    }
    // For pages, allow through so the route-level requireSession() handles it.
    return NextResponse.next();
  }

  return NextResponse.next();
}

function unauthorizedResponse(request: NextRequest, pathname: string): NextResponse {
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized: Session required' }, { status: 401 });
  }
  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}

/**
 * Explicit matcher covering all application routes:
 * Matches all request paths except for static files (_next/static, _next/image, favicon.ico)
 */
export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
