import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';
import { generateOAuthState, ALLOWED_OAUTH_SCOPES } from '@upwork-bidder/core';
import { requireSession } from '@/lib/auth';

/**
 * Generates a PKCE code_verifier (32 random bytes, base64url encoded) and
 * its S256 code_challenge (SHA-256 of the verifier, base64url encoded).
 */
function generatePkce(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}

/**
 * POST /api/auth/upwork/connect
 *
 * Initiates an OAuth 2.1 PKCE authorization code flow against the official
 * Upwork MCP server. No UPWORK_CLIENT_ID or UPWORK_CLIENT_SECRET required -
 * the MCP server supports public clients with PKCE.
 *
 * Discovery source: GET https://mcp.upwork.com/.well-known/oauth-authorization-server
 *   authorization_endpoint: https://www.upwork.com/ab/account-security/oauth2/authorize
 *   code_challenge_methods_supported: ["S256"]
 *   token_endpoint_auth_methods_supported: ["none", ...]
 */
export async function POST(request: NextRequest) {
  const sessionResult = await requireSession(request);
  if (sessionResult.errorResponse) {
    return sessionResult.errorResponse;
  }

  try {
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const redirectUri = `${appUrl}/api/auth/upwork/callback`;

    // Official authorization endpoint from MCP discovery metadata.
    const authEndpoint =
      process.env.UPWORK_AUTH_URL || 'https://www.upwork.com/ab/account-security/oauth2/authorize';

    const state = generateOAuthState();
    const { codeVerifier, codeChallenge } = generatePkce();
    const scopesParam = encodeURIComponent(ALLOWED_OAUTH_SCOPES.join(' '));

    const authorizationUrl =
      `${authEndpoint}?response_type=code` +
      `&scope=${scopesParam}` +
      `&state=${state}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&code_challenge=${codeChallenge}` +
      `&code_challenge_method=S256`;

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

    // Store PKCE verifier in httpOnly cookie for use in callback
    response.cookies.set('oauth_pkce_verifier', codeVerifier, {
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
