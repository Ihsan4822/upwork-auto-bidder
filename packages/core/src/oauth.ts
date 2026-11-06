/**
 * oauth.ts — Read-Only OAuth 2.1 Configuration and Scope Verification.
 *
 * RULES (from Section 2 & Section 3 of Brief):
 * 1. Exactly 2 read-only scopes allowed: `jobs:read` and `profile:read`
 * 2. Any write, submit, message, contract, offer, or payment scope is strictly banned
 * 3. Scope change guard: if returned scopes differ from allowed scopes, trigger warning and stop
 * 4. State tokens (CSRF protection) for every OAuth authorization request
 */

import { randomBytes } from 'crypto';

/** Exact read-only scopes permitted for this application */
export const ALLOWED_OAUTH_SCOPES = ['jobs:read', 'profile:read'] as const;
export type AllowedOAuthScope = (typeof ALLOWED_OAUTH_SCOPES)[number];

/** Patterns that indicate banned permissions in OAuth scopes */
export const BANNED_SCOPE_PATTERNS = [
  'submit',
  'write',
  'message',
  'contract',
  'offer',
  'payment',
  'hire',
  'invite',
  'billing',
  'timesheet',
  'proposal',
  'admin',
] as const;

export interface ScopeValidationResult {
  valid: boolean;
  unexpectedScopes: string[];
  bannedScopes: string[];
  reason?: string;
}

/**
 * Validates a list of scopes returned by Upwork during OAuth exchange.
 *
 * @param grantedScopes - Scopes returned by the OAuth server
 * @returns ScopeValidationResult indicating whether scopes match our strict read-only policy
 */
export function validateGrantedScopes(grantedScopes: string[]): ScopeValidationResult {
  const allowedSet = new Set<string>(ALLOWED_OAUTH_SCOPES);
  const unexpectedScopes: string[] = [];
  const bannedScopes: string[] = [];

  for (const scope of grantedScopes) {
    const scopeLower = scope.toLowerCase();

    // Check for banned keywords
    for (const banned of BANNED_SCOPE_PATTERNS) {
      if (scopeLower.includes(banned)) {
        bannedScopes.push(scope);
        break;
      }
    }

    // Check if it is within our explicit allowlist
    if (!allowedSet.has(scope)) {
      unexpectedScopes.push(scope);
    }
  }

  // Empty scope list is invalid — grants zero required access
  const valid =
    grantedScopes.length > 0 && bannedScopes.length === 0 && unexpectedScopes.length === 0;
  const reason =
    grantedScopes.length === 0
      ? 'No scopes granted by provider'
      : bannedScopes.length > 0
        ? `Banned scopes requested: ${bannedScopes.join(', ')}`
        : unexpectedScopes.length > 0
          ? `Unexpected scopes requested: ${unexpectedScopes.join(', ')}`
          : undefined;

  return {
    valid,
    unexpectedScopes,
    bannedScopes,
    reason,
  };
}

/**
 * Generate a cryptographically secure random state string for OAuth CSRF protection.
 */
export function generateOAuthState(): string {
  return randomBytes(24).toString('hex');
}

/**
 * Configuration structure for the OAuth client.
 */
export interface OAuthConfig {
  mcpServerUrl: string;
  appUrl: string;
  allowedScopes: readonly string[];
}

export function getOAuthConfig(mcpUrl: string, appUrl: string): OAuthConfig {
  return {
    mcpServerUrl: mcpUrl,
    appUrl,
    allowedScopes: ALLOWED_OAUTH_SCOPES,
  };
}
