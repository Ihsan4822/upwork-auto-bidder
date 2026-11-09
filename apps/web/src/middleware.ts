import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Public routes that do not require an active app_session cookie:
 * - /login (Login page)
 * - /api/auth/login/request (Request magic link)
 * - /api/auth/login/verify (Verify magic link)
 * - /api/auth/upwork/client-metadata.json (Upwork client metadata)
 */
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login/request',
  '/api/auth/login/verify',
  '/api/auth/demo',
  '/api/auth/upwork/client-metadata.json',
];

const STATIC_EXT_REGEX = /\.(ico|png|jpg|jpeg|svg|css|js|woff|woff2|ttf|eot|webp|json|txt|xml|map)$/i;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files, Next.js internal bundles, and known static extensions
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname === '/favicon.ico' ||
    STATIC_EXT_REGEX.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Allow public authentication endpoints
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  // Check presence and length of session cookie (32+ chars)
  const sessionCookie = request.cookies.get('app_session');
  const rawToken = sessionCookie?.value;

  if (!rawToken || rawToken.length < 32) {
    return unauthorizedResponse(request, pathname);
  }

  // TEST-ONLY BYPASS:
  // Clearly marked test bypass, strictly active only when NODE_ENV === 'test'.
  // Allows Playwright E2E tests to run against a real database-backed dev server
  // without failing on the mock session token.
  if (
    process.env.NODE_ENV === 'test' &&
    rawToken === 'mock_session_token_for_playwright_e2e_testing_32chars'
  ) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

function unauthorizedResponse(request: NextRequest, pathname: string): NextResponse {
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Session required' }, { status: 401 });
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
