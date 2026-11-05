/**
 * crypto.ts — Token encryption and decryption at rest.
 *
 * WHY THIS IS CRITICAL:
 * Section 2, Rule 7: "OAuth tokens are secrets. Store them encrypted, only on
 * the server side, never in the browser, never in git, never in logs."
 *
 * ALGORITHM: AES-256-GCM with a fresh random 12-byte IV for every encryption.
 * The authentication tag is appended to the ciphertext to ensure integrity.
 *
 * KEY MANAGEMENT:
 * The 32-byte key is read from OAUTH_TOKEN_ENCRYPTION_KEY in .env.
 * If the key is rotated, tokens must be re-encrypted or re-authenticated.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM

/**
 * Encrypt a plaintext secret string using AES-256-GCM.
 *
 * @param plaintext - The secret string to encrypt (e.g. access token or refresh token)
 * @param hexKey - 32-byte hex key (64 hex characters)
 * @returns Serialized encrypted string: `ivHex:tagHex:ciphertextHex`
 * @throws If key is invalid or encryption fails
 */
export function encryptToken(plaintext: string, hexKey: string): string {
  if (!hexKey || hexKey.length !== 64) {
    throw new Error('Encryption key must be a 64-character hex string (32 bytes)');
  }

  const key = Buffer.from(hexKey, 'hex');
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt an AES-256-GCM encrypted secret string.
 *
 * @param encryptedPayload - Serialized string in format `ivHex:tagHex:ciphertextHex`
 * @param hexKey - 32-byte hex key (64 hex characters)
 * @returns The original decrypted plaintext
 * @throws If authentication tag fails, key is wrong, or payload is corrupted
 */
export function decryptToken(encryptedPayload: string, hexKey: string): string {
  if (!hexKey || hexKey.length !== 64) {
    throw new Error('Encryption key must be a 64-character hex string (32 bytes)');
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format. Expected iv:tag:ciphertext');
  }

  const [ivHex, tagHex, ciphertextHex] = parts;
  const key = Buffer.from(hexKey, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}
