import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuthCryptoService } from '../src/auth/auth-crypto.service';
import type { AuthRuntimeConfig } from '../src/auth/auth-crypto.service';
import { AuthSessionService } from '../src/auth/auth-session.service';
import type { PrismaService } from '../src/platform/database/prisma.service';

const config: AuthRuntimeConfig = {
  authTokenSigningSecret: 'signing-secret-for-auth-tests-32-characters',
  authTokenHashSecret: 'hashing-secret-for-auth-tests-32-characters',
  authAccessTokenTtlSeconds: 900,
  authRefreshTokenTtlSeconds: 86_400,
  authOtpTtlSeconds: 300,
  authOtpMaxAttempts: 5,
  authOtpRateLimitCount: 5,
  authOtpRateLimitWindowSeconds: 3600,
};

function createHarness(
  storedToken?: {
    id: string;
    sessionId: string;
    tokenHash: string;
    expiresAt: Date;
    consumedAt: Date | null;
    session: {
      id: string;
      identityType: 'customer' | 'admin';
      subjectId: string;
      expiresAt: Date;
      revokedAt: Date | null;
    };
  },
  consumeCount = 1,
) {
  const transaction = {
    authRefreshToken: {
      findUnique: vi.fn(async () => storedToken ?? null),
      updateMany: vi.fn(async () => ({ count: consumeCount })),
      create: vi.fn(async () => ({ id: 'next-token-id' })),
    },
    authSession: {
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  };
  const prisma = {
    $transaction: vi.fn(async <T>(callback: (tx: typeof transaction) => Promise<T>) =>
      callback(transaction),
    ),
    authSession: {
      create: vi.fn(async ({ data }: { data: { expiresAt: Date } }) => ({
        id: 'session-id',
        expiresAt: data.expiresAt,
      })),
      findFirst: vi.fn(async () => ({ id: 'session-id' })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  } as unknown as PrismaService;
  const crypto = new AuthCryptoService(config);
  const service = new AuthSessionService(prisma, crypto, config);

  return { service, prisma, crypto, transaction };
}

describe('authentication session service', () => {
  it('persists an opaque refresh-token hash and signs an audience-bound access token', async () => {
    const { service, prisma, crypto } = createHarness();
    const result = await service.create('customer', 'customer-id');
    const call = vi.mocked(prisma.authSession.create).mock.calls[0]?.[0];
    const nested = call?.data.refreshTokens;

    expect(result.refreshToken).not.toContain('customer-id');
    expect(nested).toMatchObject({
      create: {
        tokenHash: crypto.hashToken('refresh', result.refreshToken),
        expiresAt: expect.any(Date),
      },
    });
    expect(JSON.stringify(nested)).not.toContain(result.refreshToken);
    expect(crypto.verifyAccessToken(result.accessToken, 'customer')).toMatchObject({
      sub: 'customer-id',
      sid: 'session-id',
      typ: 'customer',
    });
  });

  it('rotates a valid refresh token and preserves the session audience', async () => {
    const crypto = new AuthCryptoService(config);
    const oldToken = 'previous-refresh-token';
    const sessionExpiry = new Date(Date.now() + 60_000_000);
    const storedToken = {
      id: 'refresh-id',
      sessionId: 'session-id',
      tokenHash: crypto.hashToken('refresh', oldToken),
      expiresAt: sessionExpiry,
      consumedAt: null,
      session: {
        id: 'session-id',
        identityType: 'admin' as const,
        subjectId: 'admin-id',
        expiresAt: sessionExpiry,
        revokedAt: null,
      },
    };
    const { service, transaction } = createHarness(storedToken);
    const result = await service.rotate(oldToken, 'admin');

    expect(transaction.authRefreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'refresh-id', consumedAt: null, expiresAt: { gt: expect.any(Date) } },
        data: { consumedAt: expect.any(Date) },
      }),
    );
    expect(transaction.authRefreshToken.create).toHaveBeenCalledWith({
      data: {
        sessionId: 'session-id',
        tokenHash: crypto.hashToken('refresh', result.refreshToken),
        expiresAt: sessionExpiry,
      },
    });
    expect(result.refreshToken).not.toBe(oldToken);
    expect(crypto.verifyAccessToken(result.accessToken, 'admin')).toMatchObject({
      sub: 'admin-id',
      sid: 'session-id',
      typ: 'admin',
    });
  });

  it('revokes the session when a consumed refresh token is replayed', async () => {
    const oldToken = 'replayed-refresh-token';
    const sessionExpiry = new Date(Date.now() + 60_000_000);
    const crypto = new AuthCryptoService(config);
    const { service, transaction } = createHarness({
      id: 'refresh-id',
      sessionId: 'session-id',
      tokenHash: crypto.hashToken('refresh', oldToken),
      expiresAt: sessionExpiry,
      consumedAt: new Date(),
      session: {
        id: 'session-id',
        identityType: 'customer',
        subjectId: 'customer-id',
        expiresAt: sessionExpiry,
        revokedAt: null,
      },
    });

    await expect(service.rotate(oldToken, 'customer')).rejects.toThrow(UnauthorizedException);
    expect(transaction.authSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-id', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      }),
    );
    expect(transaction.authRefreshToken.create).not.toHaveBeenCalled();
  });

  it('rejects access tokens after their persisted session is revoked', async () => {
    const { service, prisma } = createHarness();
    const tokens = await service.create('customer', 'customer-id');
    await expect(
      service.validateAccessToken(tokens.accessToken, 'customer'),
    ).resolves.toMatchObject({
      sub: 'customer-id',
      sid: 'session-id',
    });

    await service.revoke('session-id');
    vi.mocked(prisma.authSession.findFirst).mockResolvedValue(null);
    await expect(service.validateAccessToken(tokens.accessToken, 'customer')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('revokes the session if an atomic refresh rotation loses a race', async () => {
    const oldToken = 'raced-refresh-token';
    const sessionExpiry = new Date(Date.now() + 60_000_000);
    const crypto = new AuthCryptoService(config);
    const { service, transaction } = createHarness(
      {
        id: 'refresh-id',
        sessionId: 'session-id',
        tokenHash: crypto.hashToken('refresh', oldToken),
        expiresAt: sessionExpiry,
        consumedAt: null,
        session: {
          id: 'session-id',
          identityType: 'customer',
          subjectId: 'customer-id',
          expiresAt: sessionExpiry,
          revokedAt: null,
        },
      },
      0,
    );

    await expect(service.rotate(oldToken, 'customer')).rejects.toThrow(UnauthorizedException);
    expect(transaction.authSession.updateMany).toHaveBeenCalled();
  });
});
