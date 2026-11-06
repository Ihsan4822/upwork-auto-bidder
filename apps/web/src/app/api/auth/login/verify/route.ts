import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@upwork-bidder/db';
import {
  hashToken,
  compareTokens,
  isMagicLinkExpired,
} from '@upwork-bidder/core';
import { createSession, setSessionCookie } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  if (!token || token.length < 32) {
    return NextResponse.redirect(`${appUrl}/login?error=link_invalid_or_expired`);
  }

  try {
    const tokenHash = hashToken(token);

    // Find user with this active magic link token hash
    const user = await prisma.user.findFirst({
      where: {
        magicLinkToken: tokenHash,
      },
    });

    if (!user || !user.magicLinkToken) {
      return NextResponse.redirect(`${appUrl}/login?error=link_invalid_or_expired`);
    }

    // A3: Constant-time comparison check
    if (!compareTokens(token, user.magicLinkToken)) {
      return NextResponse.redirect(`${appUrl}/login?error=link_invalid_or_expired`);
    }

    // A3: Expiration check (15 minutes TTL)
    if (isMagicLinkExpired(user.magicLinkExpiresAt, new Date())) {
      // Invalidate expired token
      await prisma.user.update({
        where: { id: user.id },
        data: { magicLinkToken: null, magicLinkExpiresAt: null },
      });
      return NextResponse.redirect(`${appUrl}/login?error=link_invalid_or_expired`);
    }

    // A3: Single use enforcement - clear token and reset loginAttempts
    await prisma.user.update({
      where: { id: user.id },
      data: {
        magicLinkToken: null,
        magicLinkExpiresAt: null,
        loginAttempts: 0,
        lastLoginAt: new Date(),
      },
    });

    // A4: Create session
    const { rawSessionToken, expiresAt } = await createSession(user.id);

    const response = NextResponse.redirect(`${appUrl}/queue`);
    setSessionCookie(response, rawSessionToken, expiresAt);
    return response;
  } catch {
    return NextResponse.redirect(`${appUrl}/login?error=link_invalid_or_expired`);
  }
}
