import { NextResponse } from 'next/server';
import { ALLOWED_OAUTH_SCOPES } from '@upwork-bidder/core';

/**
 * GET /api/auth/upwork/client-metadata.json
 *
 * Serves the OAuth 2.0 Client ID Metadata Document per draft-ietf-oauth-client-id-metadata-document.
 * The absolute URL of this document is passed as client_id in OAuth 2.1 authorize and token requests.
 */
export async function GET() {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const clientId = `${appUrl}/api/auth/upwork/client-metadata.json`;
  const redirectUri = `${appUrl}/api/auth/upwork/callback`;

  const metadata = {
    client_id: clientId,
    client_name: 'Upwork Proposal Assistant (Farid Malik)',
    client_uri: appUrl,
    redirect_uris: [redirectUri],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    scope: ALLOWED_OAUTH_SCOPES.join(' '),
  };

  return NextResponse.json(metadata, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
