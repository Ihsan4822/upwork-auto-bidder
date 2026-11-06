import { NextRequest, NextResponse } from 'next/server';
import { generateOAuthState, ALLOWED_OAUTH_SCOPES } from '@upwork-bidder/core';
import { requireSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const sessionResult = await requireSession(request);
  if (sessionResult.errorResponse) {
    return sessionResult.errorResponse;
  }

  try {
    const clientId = process.env.UPWORK_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        {
          error:
            'Upwork OAuth is not configured. Please set UPWORK_CLIENT_ID and UPWORK_CLIENT_SECRET in .env to connect a real Upwork account.',
        },
        { status: 400 },
      );
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const redirectUri = `${appUrl}/api/auth/upwork/callback`;
    const authEndpoint = process.env.UPWORK_AUTH_URL || 'https://www.upwork.com/ab/account-security/oauth2/authorize';

    const state = generateOAuthState();
    const scopesParam = encodeURIComponent(ALLOWED_OAUTH_SCOPES.join(' '));

    const authorizationUrl = `${authEndpoint}?response_type=code&client_id=${clientId}&scope=${scopesParam}&state=${state}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}`;

    const response = NextResponse.json({
      authorizationUrl,
      state,
      allowedScopes: ALLOWED_OAUTH_SCOPES,
    });

    // CSRF protection: store state in httpOnly cookie
    response.cookies.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 600, // 10 minutes
      sameSite: 'lax',
      path: '/',
    });

    return response;
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate authorization URL' },
      { status: 500 },
    );
  }
}
