/**
 * connection-service.test.ts — Unit tests for token preparation, security checks, and consent text.
 */

import { describe, it, expect } from 'vitest';
import { randomBytes } from 'crypto';
import {
  prepareTokenForStorage,
  getPlainLanguageConsentText,
  type OAuthCallbackPayload,
} from '../src/connection-service';
import { decryptToken } from '../src/crypto';

const TEST_KEY = randomBytes(32).toString('hex');

describe('Connection Service — Token Preparation & Safety', () => {
  it('encrypts access and refresh tokens when scopes are valid read-only', () => {
    const payload: OAuthCallbackPayload = {
      profileId: 'prof_123',
      accessToken: 'access_secret_abc',
      refreshToken: 'refresh_secret_xyz',
      scopesGranted: ['jobs:read', 'profile:read'],
      expiresInSeconds: 3600,
    };

    const prepared = prepareTokenForStorage(payload, TEST_KEY);

    expect(prepared.encryptedAccessToken).not.toBe(payload.accessToken);
    expect(prepared.encryptedRefreshToken).not.toBe(payload.refreshToken);
    expect(decryptToken(prepared.encryptedAccessToken, TEST_KEY)).toBe(payload.accessToken);
    expect(decryptToken(prepared.encryptedRefreshToken!, TEST_KEY)).toBe(payload.refreshToken);
    expect(prepared.scopesGranted).toEqual(['jobs:read', 'profile:read']);
    expect(prepared.expiresAt).toBeInstanceOf(Date);
  });

  it('throws security error if banned scopes appear in callback', () => {
    const payload: OAuthCallbackPayload = {
      profileId: 'prof_123',
      accessToken: 'token',
      scopesGranted: ['jobs:read', 'submit_proposal'],
    };

    expect(() => prepareTokenForStorage(payload, TEST_KEY)).toThrow(/SECURITY VIOLATION/);
  });

  it('throws scope change error if unapproved extra scopes appear', () => {
    const payload: OAuthCallbackPayload = {
      profileId: 'prof_123',
      accessToken: 'token',
      scopesGranted: ['jobs:read', 'profile:read', 'unknown_new_scope'],
    };

    expect(() => prepareTokenForStorage(payload, TEST_KEY)).toThrow(/SCOPE CHANGE DETECTED/);
  });

  it('provides plain-language consent text meeting Section 3 Rule 4', () => {
    const consent = getPlainLanguageConsentText();

    expect(consent.canDo.length).toBeGreaterThan(0);
    expect(consent.cannotDo.length).toBeGreaterThan(0);
    expect(consent.appNameRule).toContain('must match your registered product name');

    // Confirm auto submit and payments are explicitly called out as cannot do
    const cannotText = consent.cannotDo.join(' ').toLowerCase();
    expect(cannotText).toContain('submit');
    expect(cannotText).toContain('payment');
    expect(cannotText).toContain('message');
  });
});
