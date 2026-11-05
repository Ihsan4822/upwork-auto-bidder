/**
 * crypto.test.ts — Unit tests for token encryption and decryption at rest.
 *
 * Verifies:
 * - Round-trip encryption and decryption
 * - Unique IV per encryption (two encryptions of same text produce different ciphertexts)
 * - Tamper detection (modified ciphertext or tag throws error)
 * - Key validation (invalid key length throws error)
 */

import { describe, it, expect } from 'vitest';
import { randomBytes } from 'crypto';
import { encryptToken, decryptToken } from '../src/crypto';

// 32-byte test key (64 hex characters)
const VALID_TEST_KEY = randomBytes(32).toString('hex');
const WRONG_TEST_KEY = randomBytes(32).toString('hex');

describe('Token Encryption at Rest (Section 2, Rule 7)', () => {
  it('encrypts and successfully decrypts a token string', () => {
    const rawToken = 'oauth2_access_token_secret_value_12345';
    const encrypted = encryptToken(rawToken, VALID_TEST_KEY);

    expect(encrypted).not.toBe(rawToken);
    expect(encrypted).toContain(':');

    const decrypted = decryptToken(encrypted, VALID_TEST_KEY);
    expect(decrypted).toBe(rawToken);
  });

  it('produces different ciphertexts for the same plaintext due to random IV', () => {
    const rawToken = 'same_token_text';
    const enc1 = encryptToken(rawToken, VALID_TEST_KEY);
    const enc2 = encryptToken(rawToken, VALID_TEST_KEY);

    expect(enc1).not.toBe(enc2);
    expect(decryptToken(enc1, VALID_TEST_KEY)).toBe(rawToken);
    expect(decryptToken(enc2, VALID_TEST_KEY)).toBe(rawToken);
  });

  it('fails decryption with wrong key', () => {
    const rawToken = 'secret_access_token';
    const encrypted = encryptToken(rawToken, VALID_TEST_KEY);

    expect(() => decryptToken(encrypted, WRONG_TEST_KEY)).toThrow();
  });

  it('fails decryption if ciphertext is tampered with', () => {
    const rawToken = 'secret_access_token';
    const encrypted = encryptToken(rawToken, VALID_TEST_KEY);
    const [iv, tag, ciphertext] = encrypted.split(':');

    // Tamper with ciphertext by flipping last hex char
    const tamperedCipher = ciphertext.slice(0, -1) + (ciphertext.slice(-1) === 'a' ? 'b' : 'a');
    const tamperedPayload = `${iv}:${tag}:${tamperedCipher}`;

    expect(() => decryptToken(tamperedPayload, VALID_TEST_KEY)).toThrow();
  });

  it('rejects keys that are not 64 hex characters (32 bytes)', () => {
    expect(() => encryptToken('secret', 'too_short_key')).toThrow('64-character hex string');
    expect(() => decryptToken('iv:tag:cipher', 'too_short_key')).toThrow('64-character hex string');
  });
});
