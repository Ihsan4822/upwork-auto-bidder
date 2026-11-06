import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@upwork-bidder/db';
import { prepareTokenForStorage, validateGrantedScopes } from '@upwork-bidder/core';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const encryptionKey = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
  const clientId = process.env.UPWORK_CLIENT_ID;
  const clientSecret = process.env.UPWORK_CLIENT_SECRET;
  const tokenUrl = process.env.UPWORK_TOKEN_URL || 'https://www.upwork.com/api/v3/oauth2/token';
  const redirectUri = `${appUrl}/api/auth/upwork/callback`;

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

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${appUrl}/settings/connection?error=${encodeURIComponent(
        'Server misconfiguration: UPWORK_CLIENT_ID and UPWORK_CLIENT_SECRET must be configured in .env',
      )}`,
    );
  }

  try {
    // 2. Real Token Exchange with Upwork OAuth 2.1 Token Endpoint
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      throw new Error(`Upwork token exchange failed (HTTP ${tokenResponse.status}): ${errBody}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = Number(tokenData.expires_in) || 86400 * 30;

    if (!accessToken) {
      throw new Error('Upwork token endpoint did not return an access_token');
    }

    // 3. Extract and strictly validate returned scopes
    const rawScope = tokenData.scope || '';
    const returnedScopes = typeof rawScope === 'string'
      ? rawScope.split(/[\s,]+/).filter(Boolean)
      : Array.isArray(rawScope)
      ? rawScope
      : [];

    const scopeValidation = validateGrantedScopes(returnedScopes);
    if (!scopeValidation.valid) {
      throw new Error(`Scope violation (Section 3, Rule 2): ${scopeValidation.reason}`);
    }

    // 4. Find or initialize profile
    let profile = await prisma.profile.findFirst();
    if (!profile) {
      const user = await prisma.user.upsert({
        where: { email: 'ihsan4822@gmail.com' },
        update: {},
        create: { email: 'ihsan4822@gmail.com' },
      });
      profile = await prisma.profile.create({
        data: {
          userId: user.id,
          upworkProfileId: 'farid_malik_profile',
          displayName: 'Farid Malik',
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

    // 5. Security check & AES-256-GCM Encryption
    const prepared = prepareTokenForStorage(
      {
        profileId: profile.id,
        accessToken,
        refreshToken,
        scopesGranted: returnedScopes,
        expiresInSeconds: expiresIn,
      },
      encryptionKey,
    );

    // 6. Revoke previous tokens
    await prisma.oauthToken.updateMany({
      where: { profileId: profile.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // 7. Store encrypted token at rest
    await prisma.oauthToken.create({
      data: {
        profileId: profile.id,
        encryptedAccessToken: prepared.encryptedAccessToken,
        encryptedRefreshToken: prepared.encryptedRefreshToken,
        scopesGranted: prepared.scopesGranted,
        expiresAt: prepared.expiresAt,
      },
    });

    // 8. Update profile status & write audit log (jobId is null for system event)
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
        jobId: null, // Nullable system event
        action: 'CONNECTED_UPWORK',
        actorId: profile.userId,
        note: `Upwork MCP connected via OAuth 2.1 with verified scopes: ${returnedScopes.join(', ')}`,
      },
    });

    const response = NextResponse.redirect(`${appUrl}/settings/connection?success=true`);
    // Clear oauth_state cookie
    response.cookies.delete('oauth_state');
    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error during token exchange';
    return NextResponse.redirect(
      `${appUrl}/settings/connection?error=${encodeURIComponent(message)}`,
    );
  }
}
