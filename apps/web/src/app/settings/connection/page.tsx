import { cookies } from 'next/headers';
import { prisma } from '@upwork-bidder/db';
import { getPlainLanguageConsentText, ALLOWED_OAUTH_SCOPES, hashToken } from '@upwork-bidder/core';
import { isDemoEmail } from '@/lib/demo';
import ConnectionForm from './ConnectionForm';

/**
 * Upwork Connection page.
 *
 * Server Component: it builds the static consent text and the approved
 * scope list on the server and passes them to the client form as props.
 * This split exists because the form is a client component, and importing
 * the @upwork-bidder/core barrel from a client component pulls the whole
 * barrel into the browser bundle, including token-service and the Prisma
 * client, which uses Node's `fs` module. That broke the Vercel production
 * build (PR #15, PR #16 and PR #17 all failed to compile with
 * "Can't resolve 'fs'"). The form itself imports nothing from core at
 * runtime, so the barrel never enters the browser bundle.
 *
 * The page is behind the auth middleware, so only a signed-in session
 * reaches it. The connection status itself is still fetched client-side
 * from /api/auth/upwork/status, because that endpoint has a 10 second
 * timeout for slow server cold starts and a Retry button.
 */
export default async function UpworkConnectionPage() {
  // The demo user has no Upwork account to connect, so the form hides the
  // Connect button and shows a note instead. The consent panel and scopes
  // below still show what the app requests.
  let isDemo = false;
  try {
    const cookieStore = await cookies();
    const rawToken = cookieStore.get('app_session')?.value;
    if (rawToken && rawToken.length >= 32) {
      const session = await prisma.session.findUnique({
        where: { sessionTokenHash: hashToken(rawToken) },
        include: { user: true },
      });
      isDemo = isDemoEmail(session?.user.email);
    }
  } catch {
    isDemo = false;
  }

  const consent = getPlainLanguageConsentText();
  const allowedScopes = [...ALLOWED_OAUTH_SCOPES];
  return <ConnectionForm consent={consent} allowedScopes={allowedScopes} isDemo={isDemo} />;
}
