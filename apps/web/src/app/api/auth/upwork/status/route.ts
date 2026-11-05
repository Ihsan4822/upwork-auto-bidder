import { NextResponse } from 'next/server';
import { prisma } from '@upwork-bidder/db';

export async function GET() {
  const fallback = {
    status: 'DISCONNECTED',
    displayName: 'Farid Malik',
    registeredAppName: 'Upwork Proposal Assistant (Farid Malik)',
    scopesGranted: [],
  };

  try {
    // 1.5s fail-fast timeout so the UI never hangs if PostgreSQL is offline
    const queryPromise = prisma.profile.findFirst({
      include: {
        oauthTokens: {
          where: { revokedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('DB_TIMEOUT')), 1500),
    );

    const profile = await Promise.race([queryPromise, timeoutPromise]);

    if (!profile) {
      return NextResponse.json(fallback);
    }

    const activeToken = profile.oauthTokens[0];

    return NextResponse.json({
      profileId: profile.id,
      displayName: profile.displayName,
      status: activeToken ? profile.connectionStatus : 'DISCONNECTED',
      lastConnectedAt: profile.lastConnectedAt,
      scopesGranted: activeToken?.scopesGranted ?? [],
      registeredAppName: 'Upwork Proposal Assistant (Farid Malik)',
    });
  } catch {
    // Return safe disconnected state immediately on any error or timeout
    return NextResponse.json(fallback);
  }
}
