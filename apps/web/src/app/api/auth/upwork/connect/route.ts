import { NextResponse } from 'next/server';
import { generateOAuthState, ALLOWED_OAUTH_SCOPES } from '@upwork-bidder/core';

export async function POST() {
  try {
    const mcpUrl = process.env.UPWORK_MCP_URL || 'https://mcp.upwork.com/mcp';
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const redirectUri = `${appUrl}/api/auth/upwork/callback`;

    const state = generateOAuthState();
    const scopesParam = encodeURIComponent(ALLOWED_OAUTH_SCOPES.join(' '));

    // Upwork MCP OAuth 2.1 authorization endpoint
    const authorizationUrl = `${mcpUrl}/oauth/authorize?response_type=code&scope=${scopesParam}&state=${state}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}`;

    return NextResponse.json({
      authorizationUrl,
      state,
      allowedScopes: ALLOWED_OAUTH_SCOPES,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate authorization URL' },
      { status: 500 },
    );
  }
}
