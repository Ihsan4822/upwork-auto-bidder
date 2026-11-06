/**
 * auth.test.ts - Unit tests for Task A authentication and session rules.
 *
 * Covers:
 * - A1: Allowed emails parsing and case-insensitive check
 * - A2: Token hashing (SHA-256) and generation
 * - A2: Rate limiting (max 5 requests per rolling hour)
 * - A3: Token verification with constant-time comparison and expiry check
 * - A4: Session token generation and hashing
 * - A7: Assertion ensuring no hardcoded identity strings exist in source
 */

import { describe, it, expect } from 'vitest';
import {
  hashToken,
  compareTokens,
  isEmailAllowed,
  generateRawToken,
  isRateLimited,
  isMagicLinkExpired,
  MAGIC_LINK_TTL_MINUTES,
  SESSION_TTL_DAYS,
  MAX_LOGIN_ATTEMPTS_PER_HOUR,
} from '../src/auth';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

describe('Task A: Authentication and Session Security', () => {
  describe('A1: Allowed Users', () => {
    const allowedList = ['farid@example.com', 'admin@example.com'];

    it('allows an email in the allowed list', () => {
      expect(isEmailAllowed('farid@example.com', allowedList)).toBe(true);
    });

    it('allows an email case-insensitively with leading/trailing spaces', () => {
      expect(isEmailAllowed('  FARID@Example.COM  ', allowedList)).toBe(true);
    });

    it('rejects an email not in the allowed list', () => {
      expect(isEmailAllowed('stranger@example.com', allowedList)).toBe(false);
    });

    it('rejects an empty email or empty allowlist', () => {
      expect(isEmailAllowed('', allowedList)).toBe(false);
      expect(isEmailAllowed('farid@example.com', [])).toBe(false);
    });
  });

  describe('A2: Token Generation and Hashing', () => {
    it('generates a cryptographically random raw token of at least 32 bytes (64 hex chars)', () => {
      const raw = generateRawToken();
      expect(raw).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(raw)).toBe(true);
    });

    it('hashes token with SHA-256 such that hash never equals raw token', () => {
      const raw = generateRawToken();
      const hash = hashToken(raw);
      expect(hash).toHaveLength(64);
      expect(hash).not.toBe(raw);
    });

    it('produces identical hash for identical token input', () => {
      const raw = 'test-token-value-12345';
      expect(hashToken(raw)).toBe(hashToken(raw));
    });
  });

  describe('A2: Rate Limiting (5 requests per rolling hour)', () => {
    it('allows up to 5 requests within an hour', () => {
      const now = new Date('2026-11-06T12:00:00Z');
      const recent = new Date('2026-11-06T11:45:00Z'); // 15 mins ago
      expect(isRateLimited(0, null, now)).toBe(false);
      expect(isRateLimited(4, recent, now)).toBe(false);
    });

    it('rate limits on the 5th attempt within one hour (max 5)', () => {
      const now = new Date('2026-11-06T12:00:00Z');
      const recent = new Date('2026-11-06T11:50:00Z');
      expect(isRateLimited(MAX_LOGIN_ATTEMPTS_PER_HOUR, recent, now)).toBe(true);
      expect(isRateLimited(6, recent, now)).toBe(true);
    });

    it('resets rate limit if previous attempt was older than one hour', () => {
      const now = new Date('2026-11-06T12:00:00Z');
      const old = new Date('2026-11-06T10:30:00Z'); // 1.5 hours ago
      expect(isRateLimited(5, old, now)).toBe(false);
      expect(isRateLimited(10, old, now)).toBe(false);
    });
  });

  describe('A3: Token Verification and Expiry', () => {
    it('verifies a valid token against its stored hash using constant-time comparison', () => {
      const raw = generateRawToken();
      const hash = hashToken(raw);
      expect(compareTokens(raw, hash)).toBe(true);
    });

    it('rejects a tampered token (one character off)', () => {
      const raw = generateRawToken();
      const hash = hashToken(raw);
      const tampered = raw.slice(0, -1) + (raw.endsWith('a') ? 'b' : 'a');
      expect(compareTokens(tampered, hash)).toBe(false);
    });

    it('rejects an empty or invalid token against a hash', () => {
      const hash = hashToken('something');
      expect(compareTokens('', hash)).toBe(false);
      expect(compareTokens('wrong', hash)).toBe(false);
    });

    it('accepts a magic link at 14 minutes (before 15 minute TTL)', () => {
      const created = new Date('2026-11-06T12:00:00Z');
      const expiresAt = new Date(created.getTime() + MAGIC_LINK_TTL_MINUTES * 60 * 1000);
      const nowAt14Min = new Date('2026-11-06T12:14:00Z');
      expect(isMagicLinkExpired(expiresAt, nowAt14Min)).toBe(false);
    });

    it('rejects a magic link at 15 minutes or later (at or past TTL)', () => {
      const created = new Date('2026-11-06T12:00:00Z');
      const expiresAt = new Date(created.getTime() + MAGIC_LINK_TTL_MINUTES * 60 * 1000);
      const nowAt15Min = new Date('2026-11-06T12:15:00Z');
      const nowAt20Min = new Date('2026-11-06T12:20:00Z');
      expect(isMagicLinkExpired(expiresAt, nowAt15Min)).toBe(true);
      expect(isMagicLinkExpired(expiresAt, nowAt20Min)).toBe(true);
    });

    it('rejects when expiresAt is null', () => {
      expect(isMagicLinkExpired(null)).toBe(true);
    });
  });

  describe('A4: Session Configuration Constants', () => {
    it('sets session TTL to 30 days default', () => {
      expect(SESSION_TTL_DAYS).toBe(30);
    });
  });

  describe('A7: Source Code Scan - No Hardcoded Identity Literals', () => {
    const BANNED_LITERALS = ['ihsan4822@gmail.com', 'farid_malik_profile'];

    function scanDir(dir: string): string[] {
      const violations: string[] = [];
      const entries = readdirSync(dir);
      for (const entry of entries) {
        if (entry === 'node_modules' || entry === '.next' || entry === 'dist' || entry === '.git') {
          continue;
        }
        const fullPath = join(dir, entry);
        const st = statSync(fullPath);
        if (st.isDirectory()) {
          violations.push(...scanDir(fullPath));
        } else if (/\.(ts|tsx|js|mjs|json)$/.test(entry) && !entry.endsWith('auth.test.ts')) {
          const content = readFileSync(fullPath, 'utf8');
          for (const banned of BANNED_LITERALS) {
            if (content.includes(banned)) {
              violations.push(`${fullPath} contains banned literal: "${banned}"`);
            }
          }
        }
      }
      return violations;
    }

    it('ensures neither ihsan4822@gmail.com nor farid_malik_profile appears in apps/ or packages/ source', () => {
      const rootDir = resolve(__dirname, '../../../');
      const appsDir = join(rootDir, 'apps');
      const packagesDir = join(rootDir, 'packages');

      const violations = [...scanDir(appsDir), ...scanDir(packagesDir)];
      expect(violations).toEqual([]);
    });
  });
});
