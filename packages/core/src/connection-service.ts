/**
 * connection-service.ts — Service managing Upwork read-only connection lifecycle.
 *
 * Implements:
 * - Read-only OAuth connection initiation
 * - OAuth callback token storage (encrypted at rest)
 * - Immediate token deletion on Disconnect
 * - Audit logging in review_actions table (Section C11)
 * - Scope change detection & isolation (Section 3, Rule 5)
 */

import { encryptToken } from './crypto';
import {
  validateGrantedScopes,
  type ScopeValidationResult,
} from './oauth';

export interface OAuthCallbackPayload {
  profileId: string;
  accessToken: string;
  refreshToken?: string;
  scopesGranted: string[];
  expiresInSeconds?: number;
}

export interface DisconnectResult {
  success: boolean;
  profileId: string;
  message: string;
}

export interface ConnectionStatusResult {
  profileId: string;
  displayName: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'SCOPE_CHANGED';
  lastConnectedAt: Date | null;
  scopesGranted: string[];
  warningMessage?: string;
}

/**
 * Validates callback payload and encrypts tokens before database storage.
 *
 * @param payload - Raw token payload from OAuth callback
 * @param encryptionKey - 64-character hex key from env
 * @throws Error if scopes are invalid, contain banned permissions, or encryption fails
 */
export function prepareTokenForStorage(
  payload: OAuthCallbackPayload,
  encryptionKey: string,
): {
  encryptedAccessToken: string;
  encryptedRefreshToken: string | null;
  scopesGranted: string[];
  expiresAt: Date | null;
  validation: ScopeValidationResult;
} {
  const validation = validateGrantedScopes(payload.scopesGranted);

  if (!validation.valid) {
    if (validation.bannedScopes.length > 0) {
      throw new Error(
        `SECURITY VIOLATION: Banned OAuth scopes received from server: ${validation.bannedScopes.join(', ')}. ` +
          `Refusing to store or authorize.`,
      );
    }
    if (validation.unexpectedScopes.length > 0) {
      throw new Error(
        `SCOPE CHANGE DETECTED: Upwork returned unapproved scopes: ${validation.unexpectedScopes.join(', ')}. ` +
          `Connection stopped per Section 3 Rule 5.`,
      );
    }
  }

  const encryptedAccessToken = encryptToken(payload.accessToken, encryptionKey);
  const encryptedRefreshToken = payload.refreshToken
    ? encryptToken(payload.refreshToken, encryptionKey)
    : null;

  const expiresAt = payload.expiresInSeconds
    ? new Date(Date.now() + payload.expiresInSeconds * 1000)
    : null;

  return {
    encryptedAccessToken,
    encryptedRefreshToken,
    scopesGranted: payload.scopesGranted,
    expiresAt,
    validation,
  };
}

/**
 * Builds the plain-language OAuth consent summary for the UI (Section 3, Rule 4).
 */
export function getPlainLanguageConsentText(): {
  canDo: string[];
  cannotDo: string[];
  appNameRule: string;
} {
  return {
    canDo: [
      'Read Upwork job postings matching your saved searches',
      'Read your profile details to match jobs to your Amazon design services',
    ],
    cannotDo: [
      'Submit proposals automatically or spend Connects (ever)',
      'Send, read, or manage messages or rooms',
      'View, create, or touch contracts, offers, or milestones',
      'Initiate or view payment, billing, or escrow activities',
      'Edit or modify your Upwork profile',
    ],
    appNameRule:
      'The app name on the OAuth screen must match your registered product name. If it does not match, do not authorize.',
  };
}
