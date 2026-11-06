import { NextRequest, NextResponse } from 'next/server';
import { revokeSessionByToken, clearSessionCookie, SESSION_COOKIE_NAME } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sessionToken) {
    try {
      await revokeSessionByToken(sessionToken);
    } catch {
      // Continue quietly even if DB row was already gone
    }
  }

  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  clearSessionCookie(response);
  return response;
}
