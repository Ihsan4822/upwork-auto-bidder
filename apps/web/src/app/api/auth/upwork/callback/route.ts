import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@upwork-bidder/db';
import { prepareTokenForStorage, validateGrantedScopes } from '@upwork-bidder/core';
import { getCurrentUser } from '@/lib/auth';

/**
 * GET /api/auth/upwork/callback
 *
 * Handles the OAuth 2.1 authorization code callback from Upwork.
 * Uses PKCE code_verifier (stored in cookie) for the token exchange -
 * no client_secret is required (public client, auth method = none).
 *
 * Token endpoint: https://www.upwork.com/api/v3/oauth2/token
 * (from GET https://mcp.upwork.com/.well-known/oauth-authorization-server)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const encryptionKey = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
  const tokenUrl = process.env.UPWORK_TOKEN_URL || 'https://www.upwork.com/api/v3/oauth2/token';
  const redirectUri = `${appUrl}/api/auth/upwork/callback`;

  // Enforce active session on callback
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.redirect(`${appUrl}/login?error=session_expired`);
  }

  if (error) {
    return NextResponse.redirect(
      `${appUrl}/settings/connection?error=${encodeURIComponent(`Upwork OAuth Error: ${error}`)}`,
    );
  }

  // 1. Verify CSRF State
  const cookieState = request.cookies.get('oauth_state')?.value;
  if (!state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(
      `${appUrl}/settings/connection?error=${encodeURIComponent(
        'OAuth Security Check Failed: CSRF state parameter mismatch or expired. Please try connecting again.',
      )}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${appUrl}/settings/connection?error=${encodeURIComponent('No authorization code provided in callback')}`,
    );
  }

  if (!encryptionKey || encryptionKey.length !== 64) {
    return NextResponse.redirect(
      `${appUrl}/settings/connection?error=${encodeURIComponent(
        'Server misconfiguration: OAUTH_TOKEN_ENCRYPTION_KEY must be a 64-hex key',
      )}`,
    );
  }

  // 2. Retrieve PKCE code_verifier from cookie
  const codeVerifier = request.cookies.get('oauth_pkce_verifier')?.value;
  if (!codeVerifier) {
    return NextResponse.redirect(
      `${appUrl}/settings/connection?error=${encodeURIComponent(
        'OAuth Security Error: PKCE verifier missing or expired. Please try connecting again.',
      )}`,
    );
  }

  try {
    // 3. Token Exchange using PKCE (no client_secret - public client with auth method = none)
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      throw new Error(`Upwork token exchange failed (HTTP ${tokenResponse.status}): ${errBody}`);
    }

    const tokenData = (await tokenResponse.json()) as Record<string, unknown>;
    const accessToken = typeof tokenData.access_token === 'string' ? tokenData.access_token : null;
    const refreshToken =
      typeof tokenData.refresh_token === 'string' ? tokenData.refresh_token : undefined;
    const expiresIn = typeof tokenData.expires_in === 'number' ? tokenData.expires_in : 86400 * 30;

    if (!accessToken) {
      throw new Error('Upwork token endpoint did not return an access_token');
    }

    // 4. Extract and strictly validate returned scopes
    const rawScope = tokenData.scope || '';
    const returnedScopes =
      typeof rawScope === 'string'
        ? rawScope.split(/[\s,]+/).filter(Boolean)
        : Array.isArray(rawScope)
          ? rawScope
          : [];

    const scopeValidation = validateGrantedScopes(returnedScopes as string[]);
    if (!scopeValidation.valid) {
      throw new Error(`Scope violation (Section 3, Rule 2): ${scopeValidation.reason}`);
    }

    // 5. Find or initialize profile from the signed-in session user
    let profile = await prisma.profile.findFirst({
      where: { userId: user.id },
    });

    if (!profile) {
      profile = await prisma.profile.create({
        data: {
          userId: user.id,
          upworkProfileId: `profile_${user.id}`,
          displayName: user.email.split('@')[0],
          niches: [
            'Amazon Listing Images',
            'A+ Content / EBC',
            'Storefront Design',
            'Brand Story Design',
            'Packaging & Box Design',
          ],
          connectionStatus: 'DISCONNECTED',
        },
      });
    }

    // 6. Security check and AES-256-GCM Encryption
    const prepared = prepareTokenForStorage(
      {
        profileId: profile.id,
        accessToken,
        refreshToken,
        scopesGranted: returnedScopes as string[],
        expiresInSeconds: expiresIn,
      },
      encryptionKey,
    );

    // 7. Revoke previous tokens
    await prisma.oauthToken.updateMany({
      where: { profileId: profile.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // 8. Store encrypted token at rest
    await prisma.oauthToken.create({
      data: {
        profileId: profile.id,
        encryptedAccessToken: prepared.encryptedAccessToken,
        encryptedRefreshToken: prepared.encryptedRefreshToken,
        scopesGranted: prepared.scopesGranted,
        expiresAt: prepared.expiresAt,
      },
    });

    // 9. Update profile status and write audit log (jobId is null for system event)
    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        connectionStatus: 'CONNECTED',
        lastConnectedAt: new Date(),
      },
    });

    await prisma.reviewAction.create({
      data: {
        profileId: profile.id,
        jobId: null,
        action: 'CONNECTED_UPWORK',
        actorId: profile.userId,
        note: `Upwork MCP connected via OAuth 2.1 PKCE with verified scopes: ${(returnedScopes as string[]).join(', ')}`,
      },
    });

    const response = NextResponse.redirect(`${appUrl}/settings/connection?success=true`);
    // Clear OAuth cookies
    response.cookies.delete('oauth_state');
    response.cookies.delete('oauth_pkce_verifier');
    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error during token exchange';
    return NextResponse.redirect(
      `${appUrl}/settings/connection?error=${encodeURIComponent(message)}`,
    );
  }
}
