import { getPlainLanguageConsentText, ALLOWED_OAUTH_SCOPES } from '@upwork-bidder/core';
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
export default function UpworkConnectionPage() {
  const consent = getPlainLanguageConsentText();
  const allowedScopes = [...ALLOWED_OAUTH_SCOPES];
  return <ConnectionForm consent={consent} allowedScopes={allowedScopes} />;
}
