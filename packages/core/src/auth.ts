/**
 * auth.ts - Core authentication, magic link and session security logic.
 *
 * Rules:
 * - Passwords are never used or stored anywhere in the schema.
 * - Raw magic link tokens and session tokens exist only in memory / links / cookies.
 * - Only SHA-256 hashes are persisted in the database.
 * - Verification uses constant-time comparison to prevent timing attacks.
 */

import { randomBytes, createHash, timingSafeEqual } from 'crypto';

export const MAGIC_LINK_TTL_MINUTES = 15;
export const SESSION_TTL_DAYS = 30;
export const MAX_LOGIN_ATTEMPTS_PER_HOUR = 5;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour in ms

/**
 * Generates a cryptographically secure raw token of 32 random bytes (64 hex characters).
 */
export function generateRawToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Returns the SHA-256 hex digest of a raw token.
 */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Constant-time comparison of a provided raw token against a stored SHA-256 hex hash.
 */
export function compareTokens(providedRawToken: string, storedHashHex: string): boolean {
  if (!providedRawToken || !storedHashHex) {
    return false;
  }
  const computedHash = hashToken(providedRawToken);
  if (computedHash.length !== storedHashHex.length) {
    return false;
  }
  const bufA = Buffer.from(computedHash, 'utf8');
  const bufB = Buffer.from(storedHashHex, 'utf8');
  return timingSafeEqual(bufA, bufB);
}

/**
 * Checks whether an email address is authorized in the allowlist.
 * Comparison is case-insensitive and trims whitespace.
 */
export function isEmailAllowed(email: string, allowedEmails: string[]): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  const set = new Set(allowedEmails.map((e) => e.trim().toLowerCase()).filter(Boolean));
  return set.has(normalized);
}

/**
 * Checks if link requests for an email exceed the rolling rate limit (max 5 per hour).
 */
export function isRateLimited(
  currentAttempts: number,
  lastAttemptAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (!lastAttemptAt) return false;
  const elapsedMs = now.getTime() - lastAttemptAt.getTime();
  if (elapsedMs > RATE_LIMIT_WINDOW_MS) {
    // Window expired, count resets
    return false;
  }
  return currentAttempts >= MAX_LOGIN_ATTEMPTS_PER_HOUR;
}

/**
 * Checks whether a magic link expiration timestamp is reached or exceeded.
 */
export function isMagicLinkExpired(expiresAt: Date | null, now: Date = new Date()): boolean {
  if (!expiresAt) return true;
  return now.getTime() >= expiresAt.getTime();
}
