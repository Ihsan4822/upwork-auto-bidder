import { NextResponse } from 'next/server';
import { generateOAuthState, ALLOWED_OAUTH_SCOPES } from '@upwork-bidder/core';

export async function POST() {
  try {
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const redirectUri = `${appUrl}/api/auth/upwork/callback`;

    const state = generateOAuthState();
    const scopesParam = encodeURIComponent(ALLOWED_OAUTH_SCOPES.join(' '));

    const clientId = process.env.UPWORK_CLIENT_ID;
    const authEndpoint = process.env.UPWORK_AUTH_URL || 'https://www.upwork.com/ab/account-security/oauth2/authorize';

    // If client ID is configured, redirect to live Upwork OAuth 2.1 authorization endpoint
    // If not configured, use local dev simulation code so MVP testing works without 404
    let authorizationUrl: string;
    if (clientId) {
      authorizationUrl = `${authEndpoint}?response_type=code&client_id=${clientId}&scope=${scopesParam}&state=${state}&redirect_uri=${encodeURIComponent(
        redirectUri,
      )}`;
    } else {
      // Dev/simulation fallback for local MVP testing
      authorizationUrl = `${redirectUri}?code=dev_mcp_auth_${state.slice(0, 12)}&state=${state}`;
    }

    return NextResponse.json({
      authorizationUrl,
      state,
      allowedScopes: ALLOWED_OAUTH_SCOPES,
      isDevFallback: !clientId,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate authorization URL' },
      { status: 500 },
    );
  }
}
