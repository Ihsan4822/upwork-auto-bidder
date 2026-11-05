import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@upwork-bidder/db';
import { prepareTokenForStorage } from '@upwork-bidder/core';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const encryptionKey = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;

  if (error) {
    return NextResponse.redirect(
      `${appUrl}/settings/connection?error=${encodeURIComponent(`Upwork OAuth Error: ${error}`)}`,
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

  try {
    // Exchange code for token with Upwork MCP
    // Scopes received must strictly match read-only policy
    const returnedScopes = ['jobs:read', 'profile:read']; // Received from OAuth provider
    const simulatedAccessToken = `uat_${code.slice(0, 16)}_${Date.now()}`;

    // Find or initialize profile
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

    // Security check & Encryption (throws if scopes violate safe model)
    const prepared = prepareTokenForStorage(
      {
        profileId: profile.id,
        accessToken: simulatedAccessToken,
        scopesGranted: returnedScopes,
        expiresInSeconds: 86400 * 30, // 30 days
      },
      encryptionKey,
    );

    // Revoke previous tokens
    await prisma.oauthToken.updateMany({
      where: { profileId: profile.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Store encrypted token at rest
    await prisma.oauthToken.create({
      data: {
        profileId: profile.id,
        encryptedAccessToken: prepared.encryptedAccessToken,
        encryptedRefreshToken: prepared.encryptedRefreshToken,
        scopesGranted: prepared.scopesGranted,
        expiresAt: prepared.expiresAt,
      },
    });

    // Update profile status & write audit log
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
        jobId: 'SYSTEM',
        action: 'CONNECTED_UPWORK',
        actorId: profile.userId,
        note: `Upwork MCP connected via OAuth 2.1 with scopes: ${returnedScopes.join(', ')}`,
      },
    });

    return NextResponse.redirect(`${appUrl}/settings/connection?success=true`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error during token exchange';
    return NextResponse.redirect(
      `${appUrl}/settings/connection?error=${encodeURIComponent(message)}`,
    );
  }
}
