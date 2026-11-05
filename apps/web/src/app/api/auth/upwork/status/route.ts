import { NextResponse } from 'next/server';
import { prisma } from '@upwork-bidder/db';

export async function GET() {
  try {
    // Single profile for MVP
    const profile = await prisma.profile.findFirst({
      include: {
        oauthTokens: {
          where: { revokedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!profile) {
      return NextResponse.json({
        status: 'DISCONNECTED',
        displayName: 'Farid Malik',
        registeredAppName: 'Upwork Proposal Assistant (Farid Malik)',
        scopesGranted: [],
      });
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
  } catch (err: unknown) {
    // If DB is offline or not yet connected in dev, return a safe fallback state
    return NextResponse.json({
      status: 'DISCONNECTED',
      displayName: 'Farid Malik',
      registeredAppName: 'Upwork Proposal Assistant (Farid Malik)',
      scopesGranted: [],
      error: err instanceof Error ? err.message : 'Database error',
    });
  }
}
