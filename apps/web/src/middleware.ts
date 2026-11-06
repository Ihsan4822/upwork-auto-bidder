import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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
];

export function middleware(request: NextRequest) {
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
  const hasSessionCookie = Boolean(sessionCookie && sessionCookie.value.length >= 32);

  if (!hasSessionCookie) {
    // API routes return 401 JSON
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized: Session required' },
        { status: 401 },
      );
    }

    // Page routes redirect to /login
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
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
