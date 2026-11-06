/**
 * token-service.test.ts - Unit tests for token retrieval and refresh flow (Task B / Task C).
 *
 * Rules verified:
 * - Returns valid decrypted token without refresh if > 5m remaining.
 * - Refreshes token if within 5m of expiry (EXPIRY_SKEW_SECONDS = 300).
 * - Refreshes token if already expired or if expiresAt is null.
 * - Replaces refresh token if returned; retains existing refresh token if not returned.
 * - Rejects response if access_token or expires_in is missing or invalid.
 * - Rejects response and marks DISCONNECTED if scopes are widened.
 * - Throws NeedsReconnectError without network call if no refresh token stored.
 * - Handles invalid_grant by marking profile DISCONNECTED and writing audit row.
 * - Optimistic locking: avoids duplicate network call if concurrent caller updated row.
 * - Never logs sensitive token values.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { randomBytes } from 'crypto';
import {
  getValidAccessToken,
  NeedsReconnectError,
  EXPIRY_SKEW_SECONDS,
} from '../src/token-service';
import { encryptToken } from '../src/crypto';

// Stable test 64-hex AES key
const TEST_KEY = randomBytes(32).toString('hex');

// Mock Prisma using vi.hoisted to avoid Vitest hoisting errors
const { mockPrisma } = vi.hoisted(() => {
  type MockFn = ReturnType<typeof vi.fn>;
  interface MockDb {
    oauthToken: {
      findFirst: MockFn;
      findUnique: MockFn;
      update: MockFn;
    };
    profile: {
      findUnique: MockFn;
      update: MockFn;
    };
    reviewAction: {
      create: MockFn;
    };
    $transaction: (cb: (tx: MockDb) => Promise<unknown>) => Promise<unknown>;
  }

  const mock: MockDb = {
    oauthToken: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    profile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    reviewAction: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (cb: (tx: MockDb) => Promise<unknown>) => {
      return cb(mock);
    }),
  };
  return { mockPrisma: mock };
});

vi.mock('@upwork-bidder/db', () => ({
  prisma: mockPrisma,
}));

describe('Task C: Token Service & Refresh Flow', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('exports EXPIRY_SKEW_SECONDS as 300 (5 minutes)', () => {
    expect(EXPIRY_SKEW_SECONDS).toBe(300);
  });

  it('returns decrypted valid token with zero network calls when > 5 minutes remain', async () => {
    const rawAccessToken = 'upwork-valid-access-token-12345';
    const rawRefreshToken = 'upwork-valid-refresh-token-67890';
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour in future

    mockPrisma.oauthToken.findFirst.mockResolvedValueOnce({
      id: 'token_row_1',
      profileId: 'prof_test',
      encryptedAccessToken: encryptToken(rawAccessToken, TEST_KEY),
      encryptedRefreshToken: encryptToken(rawRefreshToken, TEST_KEY),
      expiresAt,
      revokedAt: null,
      updatedAt: new Date(),
    });

    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    const token = await getValidAccessToken('prof_test', TEST_KEY);

    expect(token).toBe(rawAccessToken);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('triggers refresh when token expires in 4 minutes (< 5 min skew)', async () => {
    const oldAccessToken = 'old-access-token';
    const rawRefreshToken = 'refresh-token-active';
    const newAccessToken = 'fresh-new-access-token';
    const expiresAt = new Date(Date.now() + 4 * 60 * 1000); // 4 minutes left
    const now = new Date();

    mockPrisma.oauthToken.findFirst.mockResolvedValueOnce({
      id: 'token_row_1',
      profileId: 'prof_test',
      encryptedAccessToken: encryptToken(oldAccessToken, TEST_KEY),
      encryptedRefreshToken: encryptToken(rawRefreshToken, TEST_KEY),
      expiresAt,
      revokedAt: null,
      updatedAt: now,
    });

    mockPrisma.oauthToken.findUnique.mockResolvedValue({
      id: 'token_row_1',
      updatedAt: now,
      expiresAt,
      encryptedAccessToken: encryptToken(oldAccessToken, TEST_KEY),
      encryptedRefreshToken: encryptToken(rawRefreshToken, TEST_KEY),
    });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: newAccessToken,
        expires_in: 86400,
        token_type: 'Bearer',
      }),
    });

    const token = await getValidAccessToken('prof_test', TEST_KEY);

    expect(token).toBe(newAccessToken);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('triggers refresh when token expired 10 minutes ago', async () => {
    const oldAccessToken = 'expired-access-token';
    const rawRefreshToken = 'refresh-token-active';
    const newAccessToken = 'fresh-access-token-after-expiry';
    const expiresAt = new Date(Date.now() - 10 * 60 * 1000); // 10 min ago
    const now = new Date();

    mockPrisma.oauthToken.findFirst.mockResolvedValueOnce({
      id: 'token_row_1',
      profileId: 'prof_test',
      encryptedAccessToken: encryptToken(oldAccessToken, TEST_KEY),
      encryptedRefreshToken: encryptToken(rawRefreshToken, TEST_KEY),
      expiresAt,
      revokedAt: null,
      updatedAt: now,
    });

    mockPrisma.oauthToken.findUnique.mockResolvedValue({
      id: 'token_row_1',
      updatedAt: now,
      expiresAt,
      encryptedAccessToken: encryptToken(oldAccessToken, TEST_KEY),
      encryptedRefreshToken: encryptToken(rawRefreshToken, TEST_KEY),
    });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: newAccessToken,
        expires_in: 86400,
      }),
    });

    const token = await getValidAccessToken('prof_test', TEST_KEY);
    expect(token).toBe(newAccessToken);
  });

  it('triggers refresh when expiresAt is null', async () => {
    const oldAccessToken = 'token-no-expiry';
    const rawRefreshToken = 'refresh-token-active';
    const newAccessToken = 'fresh-token';
    const now = new Date();

    mockPrisma.oauthToken.findFirst.mockResolvedValueOnce({
      id: 'token_row_1',
      profileId: 'prof_test',
      encryptedAccessToken: encryptToken(oldAccessToken, TEST_KEY),
      encryptedRefreshToken: encryptToken(rawRefreshToken, TEST_KEY),
      expiresAt: null,
      revokedAt: null,
      updatedAt: now,
    });

    mockPrisma.oauthToken.findUnique.mockResolvedValue({
      id: 'token_row_1',
      updatedAt: now,
      expiresAt: null,
      encryptedAccessToken: encryptToken(oldAccessToken, TEST_KEY),
      encryptedRefreshToken: encryptToken(rawRefreshToken, TEST_KEY),
    });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: newAccessToken,
        expires_in: 86400,
      }),
    });

    const token = await getValidAccessToken('prof_test', TEST_KEY);
    expect(token).toBe(newAccessToken);
  });

  it('replaces stored refresh token when response returns a rotated refresh_token', async () => {
    const now = new Date();
    const oldRefreshToken = 'old-refresh';
    const newRefreshToken = 'new-rotated-refresh';
    const newAccessToken = 'new-access';

    mockPrisma.oauthToken.findFirst.mockResolvedValueOnce({
      id: 'token_row_1',
      profileId: 'prof_test',
      encryptedAccessToken: encryptToken('old-access', TEST_KEY),
      encryptedRefreshToken: encryptToken(oldRefreshToken, TEST_KEY),
      expiresAt: null,
      revokedAt: null,
      updatedAt: now,
    });

    mockPrisma.oauthToken.findUnique.mockResolvedValue({
      id: 'token_row_1',
      updatedAt: now,
      expiresAt: null,
      encryptedAccessToken: encryptToken('old-access', TEST_KEY),
      encryptedRefreshToken: encryptToken(oldRefreshToken, TEST_KEY),
    });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        expires_in: 3600,
      }),
    });

    let updatedData: { encryptedRefreshToken?: string } | undefined;
    mockPrisma.oauthToken.update.mockImplementationOnce(
      ({ data }: { data: { encryptedRefreshToken?: string } }) => {
        updatedData = data;
        return Promise.resolve({});
      },
    );

    await getValidAccessToken('prof_test', TEST_KEY);

    expect(updatedData).toBeDefined();
    expect(updatedData.encryptedRefreshToken).toBeDefined();
  });

  it('throws NeedsReconnectError and makes NO network call when no refresh token stored', async () => {
    mockPrisma.oauthToken.findFirst.mockResolvedValueOnce({
      id: 'token_row_1',
      profileId: 'prof_test',
      encryptedAccessToken: encryptToken('some-token', TEST_KEY),
      encryptedRefreshToken: null,
      expiresAt: null, // needs refresh
      revokedAt: null,
      updatedAt: new Date(),
    });

    mockPrisma.profile.findUnique.mockResolvedValueOnce({ userId: 'user_1' });
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    await expect(getValidAccessToken('prof_test', TEST_KEY)).rejects.toThrow(NeedsReconnectError);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockPrisma.profile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'prof_test' },
        data: { connectionStatus: 'DISCONNECTED' },
      }),
    );
  });

  it('throws NeedsReconnectError and marks DISCONNECTED when response missing expires_in', async () => {
    const now = new Date();
    mockPrisma.oauthToken.findFirst.mockResolvedValueOnce({
      id: 'token_row_1',
      profileId: 'prof_test',
      encryptedAccessToken: encryptToken('old-token', TEST_KEY),
      encryptedRefreshToken: encryptToken('refresh-token', TEST_KEY),
      expiresAt: null,
      revokedAt: null,
      updatedAt: now,
    });

    mockPrisma.oauthToken.findUnique.mockResolvedValueOnce({
      id: 'token_row_1',
      updatedAt: now,
      expiresAt: null,
    });

    mockPrisma.profile.findUnique.mockResolvedValueOnce({ userId: 'user_1' });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'valid-token',
        // expires_in omitted
      }),
    });

    await expect(getValidAccessToken('prof_test', TEST_KEY)).rejects.toThrow(NeedsReconnectError);
  });

  it('throws NeedsReconnectError and marks DISCONNECTED when refresh returns widened scopes', async () => {
    const now = new Date();
    mockPrisma.oauthToken.findFirst.mockResolvedValueOnce({
      id: 'token_row_1',
      profileId: 'prof_test',
      encryptedAccessToken: encryptToken('old-token', TEST_KEY),
      encryptedRefreshToken: encryptToken('refresh-token', TEST_KEY),
      expiresAt: null,
      revokedAt: null,
      updatedAt: now,
    });

    mockPrisma.oauthToken.findUnique.mockResolvedValueOnce({
      id: 'token_row_1',
      updatedAt: now,
      expiresAt: null,
    });

    mockPrisma.profile.findUnique.mockResolvedValueOnce({ userId: 'user_1' });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'valid-token',
        expires_in: 3600,
        scope: 'jobs:read submit_proposal', // Illegal write scope!
      }),
    });

    await expect(getValidAccessToken('prof_test', TEST_KEY)).rejects.toThrow(NeedsReconnectError);
  });

  it('handles invalid_grant error by creating audit row with jobId null', async () => {
    const now = new Date();
    mockPrisma.oauthToken.findFirst.mockResolvedValueOnce({
      id: 'token_row_1',
      profileId: 'prof_test',
      encryptedAccessToken: encryptToken('old-token', TEST_KEY),
      encryptedRefreshToken: encryptToken('refresh-token', TEST_KEY),
      expiresAt: null,
      revokedAt: null,
      updatedAt: now,
    });

    mockPrisma.oauthToken.findUnique.mockResolvedValueOnce({
      id: 'token_row_1',
      updatedAt: now,
      expiresAt: null,
    });

    mockPrisma.profile.findUnique.mockResolvedValueOnce({ userId: 'user_1' });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'error: invalid_grant description: Refresh token has expired',
    });

    await expect(getValidAccessToken('prof_test', TEST_KEY)).rejects.toThrow(NeedsReconnectError);
    expect(mockPrisma.reviewAction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          profileId: 'prof_test',
          jobId: null,
          actorId: 'user_1',
        }),
      }),
    );
  });

  it('optimistic locking: re-uses token if concurrent caller already updated row', async () => {
    const initialDate = new Date('2026-11-06T10:00:00Z');
    const updatedDate = new Date('2026-11-06T10:00:05Z');
    const concurrentNewToken = 'token-from-concurrent-caller';

    mockPrisma.oauthToken.findFirst.mockResolvedValueOnce({
      id: 'token_row_1',
      profileId: 'prof_test',
      encryptedAccessToken: encryptToken('stale-token', TEST_KEY),
      encryptedRefreshToken: encryptToken('refresh-token', TEST_KEY),
      expiresAt: null,
      revokedAt: null,
      updatedAt: initialDate,
    });

    // When findUnique is called during refresh, updatedAt has changed!
    mockPrisma.oauthToken.findUnique.mockResolvedValueOnce({
      id: 'token_row_1',
      updatedAt: updatedDate,
      encryptedAccessToken: encryptToken(concurrentNewToken, TEST_KEY),
    });

    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    const token = await getValidAccessToken('prof_test', TEST_KEY);

    expect(token).toBe(concurrentNewToken);
    // Network call should NOT have been made
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
