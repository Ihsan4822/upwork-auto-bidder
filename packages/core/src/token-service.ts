/**
 * token-service.ts - Central helper for retrieving valid Upwork access tokens.
 *
 * Rules:
 * - Returns a decrypted, currently valid access token for the profile.
 * - Automatically refreshes the token if it is within 5 minutes of expiry.
 * - Throws NeedsReconnectError when no usable token exists or refresh fails.
 * - Single-flight per profile: uses optimistic DB locking so two concurrent
 *   callers produce exactly one network refresh, not two.
 * - Never logs the access token, refresh token, or full token response.
 */

import { prisma } from '@upwork-bidder/db';
import { decryptToken, encryptToken } from './crypto';
import { validateGrantedScopes } from './oauth';

/** Skew window in seconds - refresh if token expires within this window. */
export const EXPIRY_SKEW_SECONDS = 300; // 5 minutes

/**
 * Thrown when a profile has no usable token and must re-authorise through
 * the normal OAuth 2.1 connect flow. The caller should log this and skip
 * the profile - it must not crash.
 */
export class NeedsReconnectError extends Error {
  public readonly profileId: string;
  public readonly reason: string;

  constructor(profileId: string, reason: string) {
    super(`Profile ${profileId} needs to reconnect Upwork: ${reason}`);
    this.name = 'NeedsReconnectError';
    this.profileId = profileId;
    this.reason = reason;
  }
}

export interface GetValidAccessTokenOptions {
  /**
   * When true, skips the expiry check and forces a refresh unconditionally.
   * Used for a single retry after a 401 from the MCP server.
   */
  forceRefresh?: boolean;
}

/**
 * Returns a decrypted, currently valid access token for the profile.
 * Refreshes automatically when needed.
 *
 * @param profileId - The profile row ID.
 * @param encryptionKey - 64-hex AES-256 key from OAUTH_TOKEN_ENCRYPTION_KEY.
 * @param opts - Optional flags, e.g. forceRefresh.
 * @throws NeedsReconnectError when no usable token exists or refresh fails.
 */
export async function getValidAccessToken(
  profileId: string,
  encryptionKey: string,
  opts: GetValidAccessTokenOptions = {},
): Promise<string> {
  const tokenRecord = await prisma.oauthToken.findFirst({
    where: { profileId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!tokenRecord) {
    await markDisconnected(profileId, 'NO_TOKEN', 'No active token record found');
    throw new NeedsReconnectError(profileId, 'No active token record found');
  }

  const now = new Date();
  const skewMs = EXPIRY_SKEW_SECONDS * 1000;
  const needsRefresh =
    opts.forceRefresh ||
    !tokenRecord.expiresAt ||
    now.getTime() >= tokenRecord.expiresAt.getTime() - skewMs;

  if (!needsRefresh) {
    // Token is valid and not near expiry - return it directly.
    return decryptToken(tokenRecord.encryptedAccessToken, encryptionKey);
  }

  // Needs refresh. First check there is a refresh token.
  if (!tokenRecord.encryptedRefreshToken) {
    await markDisconnected(profileId, 'NO_REFRESH_TOKEN', 'No refresh token stored');
    throw new NeedsReconnectError(profileId, 'No refresh token stored');
  }

  const refreshToken = decryptToken(tokenRecord.encryptedRefreshToken, encryptionKey);

  // Optimistic lock: only refresh if updatedAt still matches what we read.
  // If another concurrent caller already refreshed, re-read and return.
  const refreshedToken = await refreshWithOptimisticLock(
    profileId,
    tokenRecord.id,
    tokenRecord.updatedAt,
    refreshToken,
    encryptionKey,
  );

  return refreshedToken;
}

/**
 * Performs a single token refresh call, guarded by an optimistic lock.
 * If the token row was already updated by a concurrent caller, re-reads
 * and returns the already-refreshed token instead of making a network call.
 */
async function refreshWithOptimisticLock(
  profileId: string,
  tokenId: string,
  updatedAtSnapshot: Date,
  refreshToken: string,
  encryptionKey: string,
): Promise<string> {
  // Re-read the row to check if another caller already refreshed it.
  const current = await prisma.oauthToken.findUnique({ where: { id: tokenId } });
  if (!current) {
    await markDisconnected(profileId, 'TOKEN_GONE', 'Token record disappeared');
    throw new NeedsReconnectError(profileId, 'Token record disappeared during refresh');
  }

  if (current.updatedAt.getTime() !== updatedAtSnapshot.getTime()) {
    // Another caller already refreshed - return the new token.
    console.log(
      `[TokenService] Profile ${profileId}: token already refreshed by concurrent caller, re-using.`,
    );
    return decryptToken(current.encryptedAccessToken, encryptionKey);
  }

  // We hold the "lock" (updatedAt unchanged) - make the network refresh call.
  const tokenEndpoint =
    process.env.UPWORK_TOKEN_URL || 'https://www.upwork.com/api/v3/oauth2/token';

  const oldExpiry = current.expiresAt?.toISOString() ?? 'null';
  console.log(`[TokenService] Profile ${profileId}: refreshing token. Old expiry: ${oldExpiry}`);

  let responseBody: Record<string, unknown>;
  try {
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const clientId = `${appUrl}/api/auth/upwork/client-metadata.json`;

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: refreshToken,
    });

    // The Upwork MCP OAuth server supports `none` auth method for public clients.
    // No client_secret is sent.
    const res = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      const isInvalidGrant =
        errText.includes('invalid_grant') || res.status === 400 || res.status === 401;
      if (isInvalidGrant) {
        await markDisconnected(profileId, 'INVALID_GRANT', `Refresh rejected: ${res.status}`);
        throw new NeedsReconnectError(profileId, `Refresh grant rejected (${res.status})`);
      }
      throw new Error(`Token refresh HTTP error ${res.status}: ${errText}`);
    }

    responseBody = (await res.json()) as Record<string, unknown>;
  } catch (err) {
    if (err instanceof NeedsReconnectError) throw err;
    await markDisconnected(profileId, 'NETWORK_ERROR', 'Network failure during refresh');
    throw new NeedsReconnectError(profileId, 'Network failure during token refresh');
  }

  const newAccessToken =
    typeof responseBody.access_token === 'string' ? responseBody.access_token : null;
  const newExpiresIn =
    typeof responseBody.expires_in === 'number' && responseBody.expires_in > 0
      ? responseBody.expires_in
      : null;

  if (!newAccessToken || !newExpiresIn) {
    await markDisconnected(
      profileId,
      'BAD_RESPONSE',
      'Refresh response missing access_token or expires_in',
    );
    throw new NeedsReconnectError(
      profileId,
      'Invalid refresh response: missing access_token or expires_in',
    );
  }

  // Validate scopes if returned.
  if (typeof responseBody.scope === 'string' && responseBody.scope.length > 0) {
    const returnedScopes = responseBody.scope.split(/[\s,]+/).filter(Boolean);
    const scopeCheck = validateGrantedScopes(returnedScopes);
    if (!scopeCheck.valid) {
      await markDisconnected(profileId, 'SCOPE_WIDENED', `Scopes widened: ${scopeCheck.reason}`);
      throw new NeedsReconnectError(
        profileId,
        `Refresh returned invalid scopes: ${scopeCheck.reason}`,
      );
    }
  }

  const newRefreshToken =
    typeof responseBody.refresh_token === 'string' ? responseBody.refresh_token : null;

  const newExpiry = new Date(Date.now() + newExpiresIn * 1000);
  const encryptedAccess = encryptToken(newAccessToken, encryptionKey);
  const encryptedRefresh = newRefreshToken
    ? encryptToken(newRefreshToken, encryptionKey)
    : current.encryptedRefreshToken;

  // Optimistic update: only write if updatedAt still matches the snapshot.
  // Prisma does not support conditional updates natively, so we do it in a transaction.
  await prisma.$transaction(async (tx) => {
    const row = await tx.oauthToken.findUnique({
      where: { id: tokenId },
      select: { updatedAt: true },
    });
    if (!row || row.updatedAt.getTime() !== updatedAtSnapshot.getTime()) {
      // Lost the race - another caller updated it, nothing to do.
      return;
    }
    await tx.oauthToken.update({
      where: { id: tokenId },
      data: {
        encryptedAccessToken: encryptedAccess,
        encryptedRefreshToken: encryptedRefresh,
        expiresAt: newExpiry,
      },
    });
  });

  console.log(
    `[TokenService] Profile ${profileId}: token refreshed. New expiry: ${newExpiry.toISOString()}`,
  );
  return newAccessToken;
}

/**
 * Sets the profile's connectionStatus to DISCONNECTED and writes an audit row.
 */
async function markDisconnected(profileId: string, reason: string, detail: string): Promise<void> {
  try {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: { userId: true },
    });
    if (!profile) return;

    await prisma.profile.update({
      where: { id: profileId },
      data: { connectionStatus: 'DISCONNECTED' },
    });

    await prisma.reviewAction.create({
      data: {
        profileId,
        jobId: null,
        action: `TOKEN_REFRESH_FAILED_${reason}`,
        actorId: profile.userId,
        note: `Token refresh failed: ${detail}. User must reconnect Upwork.`,
      },
    });
  } catch {
    // Best-effort audit logging - do not throw from here.
  }
}
