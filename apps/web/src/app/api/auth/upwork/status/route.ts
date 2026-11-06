import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@upwork-bidder/db';
import { requireSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const sessionResult = await requireSession(request);
  if (sessionResult.errorResponse) {
    return sessionResult.errorResponse;
  }

  const { user } = sessionResult;

  const fallback = {
    status: 'DISCONNECTED',
    displayName: user.email.split('@')[0],
    scopesGranted: [],
    mcpServerUrl: process.env.UPWORK_MCP_URL || 'https://mcp.upwork.com/mcp',
  };

  try {
    // 1.5s fail-fast timeout so the UI never hangs if PostgreSQL is offline
    const queryPromise = prisma.profile.findFirst({
      where: { userId: user.id },
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
    const needsReconnect = profile.connectionStatus === 'DISCONNECTED' && activeToken;

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const clientId = `${appUrl}/api/auth/upwork/client-metadata.json`;

    return NextResponse.json({
      profileId: profile.id,
      displayName: profile.displayName,
      status: activeToken ? profile.connectionStatus : 'DISCONNECTED',
      lastConnectedAt: profile.lastConnectedAt,
      scopesGranted: activeToken?.scopesGranted ?? [],
      mcpServerUrl: process.env.UPWORK_MCP_URL || 'https://mcp.upwork.com/mcp',
      clientId,
      needsReconnect: Boolean(needsReconnect),
      reconnectReason: needsReconnect
        ? 'Token refresh failed. Click Reconnect Upwork to re-authorise.'
        : undefined,
    });
  } catch {
    // Return safe disconnected state immediately on any error or timeout
    return NextResponse.json(fallback);
  }
}
