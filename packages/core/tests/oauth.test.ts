/**
 * oauth.test.ts — Unit tests for OAuth scope validation and CSRF state generation.
 *
 * Section 3 & D4 acceptance test verification:
 * - Passes when exactly allowed read-only scopes are granted
 * - Fails if any write, submit, or payment scope is present
 * - Detects unknown/unexpected scopes for the scope change guard
 */

import { describe, it, expect } from 'vitest';
import {
  ALLOWED_OAUTH_SCOPES,
  BANNED_SCOPE_PATTERNS,
  validateGrantedScopes,
  generateOAuthState,
} from '../src/oauth';

describe('OAuth Scope Validation (Section 3)', () => {
  it('validates allowed read-only scopes successfully', () => {
    const granted = ['jobs:read', 'profile:read'];
    const result = validateGrantedScopes(granted);

    expect(result.valid).toBe(true);
    expect(result.bannedScopes).toHaveLength(0);
    expect(result.unexpectedScopes).toHaveLength(0);
  });

  it('fails if any banned scope appears — submit_proposal', () => {
    const granted = ['jobs:read', 'profile:read', 'submit_proposal'];
    const result = validateGrantedScopes(granted);

    expect(result.valid).toBe(false);
    expect(result.bannedScopes).toContain('submit_proposal');
  });

  it('fails if message scopes appear', () => {
    const granted = ['jobs:read', 'messages:write'];
    const result = validateGrantedScopes(granted);

    expect(result.valid).toBe(false);
    expect(result.bannedScopes).toContain('messages:write');
  });

  it('fails if contract or payment scopes appear', () => {
    const granted = ['jobs:read', 'contracts:read', 'payments:manage'];
    const result = validateGrantedScopes(granted);

    expect(result.valid).toBe(false);
    expect(result.bannedScopes.length).toBeGreaterThanOrEqual(1);
  });

  it('flags unexpected scopes even if not matching banned pattern (scope change guard)', () => {
    const granted = ['jobs:read', 'profile:read', 'some_new_read_scope'];
    const result = validateGrantedScopes(granted);

    expect(result.valid).toBe(false);
    expect(result.unexpectedScopes).toContain('some_new_read_scope');
  });

  it('generates secure unique state tokens for CSRF', () => {
    const state1 = generateOAuthState();
    const state2 = generateOAuthState();

    expect(state1).not.toBe(state2);
    expect(state1.length).toBe(48); // 24 bytes in hex
  });

  it('asserts allowed scopes contains no banned patterns', () => {
    for (const scope of ALLOWED_OAUTH_SCOPES) {
      for (const pattern of BANNED_SCOPE_PATTERNS) {
        expect(scope.toLowerCase()).not.toContain(pattern);
      }
    }
  });
});
