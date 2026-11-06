import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@upwork-bidder/db';
import {
  generateRawToken,
  hashToken,
  isEmailAllowed,
  isRateLimited,
  MAGIC_LINK_TTL_MINUTES,
} from '@upwork-bidder/core';
import { z } from 'zod';

const RequestSchema = z.object({
  email: z.string().trim().email(),
});

const GENERIC_SUCCESS_RESPONSE = {
  message: 'If this email can sign in, a sign in link is on its way.',
};

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  const parseResult = RequestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
  }

  const email = parseResult.data.email.toLowerCase();

  // Read allowed emails list from config/env
  const allowedEmailsRaw = process.env.LOGIN_ALLOWED_EMAILS || '';
  const allowedEmails = allowedEmailsRaw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  // A1: Unlisted email returns exact same generic 200 response
  if (!isEmailAllowed(email, allowedEmails)) {
    return NextResponse.json(GENERIC_SUCCESS_RESPONSE, { status: 200 });
  }

  try {
    // Find or create user record
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({ data: { email } });
    }

    const now = new Date();

    // A2: Rate limit check (max 5 requests per rolling hour)
    if (isRateLimited(user.loginAttempts, user.lastLoginAt, now)) {
      return NextResponse.json(GENERIC_SUCCESS_RESPONSE, { status: 200 });
    }

    // A2: Token generation and hashing
    const rawToken = generateRawToken();
    const tokenHash = hashToken(rawToken);

    const ttlMinutes = Number(process.env.MAGIC_LINK_TTL_MINUTES) || MAGIC_LINK_TTL_MINUTES;
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

    // Calculate rolling login attempts
    const isWithinHour =
      user.lastLoginAt && now.getTime() - user.lastLoginAt.getTime() <= 60 * 60 * 1000;
    const nextAttempts = isWithinHour ? user.loginAttempts + 1 : 1;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        magicLinkToken: tokenHash,
        magicLinkExpiresAt: expiresAt,
        loginAttempts: nextAttempts,
        lastLoginAt: now,
      },
    });

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const magicLink = `${appUrl}/api/auth/login/verify?token=${rawToken}`;

    // A2: Email delivery via Resend or local dev log
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: fromEmail,
            to: email,
            subject: 'Sign in to Upwork Proposal Assistant',
            html: `<p>Click the link below to sign in:</p><p><a href="${magicLink}">Sign in to Upwork Proposal Assistant</a></p><p>This link expires in ${ttlMinutes} minutes and can only be used once.</p>`,
          }),
        });
      } catch {
        console.error('[Auth] Failed to send magic link email via Resend API.');
      }
    } else {
      if (process.env.NODE_ENV === 'development' && process.env.MAGIC_LINK_DEV_LOG === 'true') {
        console.log(`[Auth Dev] Magic link generated for ${email}: ${magicLink}`);
      } else {
        console.error('[Auth] Email provider (RESEND_API_KEY) not configured. Cannot send email.');
      }
    }

    return NextResponse.json(GENERIC_SUCCESS_RESPONSE, { status: 200 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Database error' },
      { status: 500 },
    );
  }
}
