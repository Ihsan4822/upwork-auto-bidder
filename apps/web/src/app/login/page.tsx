import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@upwork-bidder/db';
import { hashToken } from '@upwork-bidder/core';
import LoginForm from './LoginForm';

export default async function LoginPage() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get('app_session')?.value;

  let shouldRedirect = false;

  if (rawToken && rawToken.length >= 32) {
    try {
      const tokenHash = hashToken(rawToken);
      const session = await prisma.session.findUnique({
        where: { sessionTokenHash: tokenHash },
        select: { expiresAt: true },
      });

      if (session && new Date() < session.expiresAt) {
        shouldRedirect = true;
      }
    } catch {
      // Database unavailable or query error, allow login form to render
    }
  }

  if (shouldRedirect) {
    redirect('/queue');
  }

  return <LoginForm />;
}
