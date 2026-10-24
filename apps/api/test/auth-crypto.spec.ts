import { describe, expect, it } from 'vitest';
import type { AuthRuntimeConfig } from '../src/auth/auth-crypto.service';
import { AuthCryptoService } from '../src/auth/auth-crypto.service';
import { PasswordHashService } from '../src/auth/password-hash.service';

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

describe('authentication cryptography', () => {
  it('signs and verifies short-lived audience-specific access tokens', () => {
    const crypto = new AuthCryptoService(config);
    const now = new Date('2026-10-24T00:00:00.000Z');
    const sessionExpiry = new Date('2026-10-25T00:00:00.000Z');
    const issued = crypto.createAccessToken(
      'customer',
      'customer-id',
      'session-id',
      sessionExpiry,
      now,
    );

    expect(crypto.verifyAccessToken(issued.token, 'customer', now)).toMatchObject({
      sub: 'customer-id',
      sid: 'session-id',
      typ: 'customer',
    });
    expect(() => crypto.verifyAccessToken(issued.token, 'admin', now)).toThrow();
  });

  it('rejects tampered and expired access tokens', () => {
    const crypto = new AuthCryptoService(config);
    const now = new Date('2026-10-24T00:00:00.000Z');
    const issued = crypto.createAccessToken(
      'admin',
      'admin-id',
      'session-id',
      new Date(now.getTime() + 60_000),
      now,
    );

    expect(() => crypto.verifyAccessToken(`${issued.token}x`, 'admin', now)).toThrow();
    expect(() =>
      crypto.verifyAccessToken(issued.token, 'admin', new Date(now.getTime() + 60_000)),
    ).toThrow();
  });

  it('generates unpredictable opaque tokens and purpose-separated hashes', () => {
    const crypto = new AuthCryptoService(config);
    const first = crypto.createOpaqueToken();
    const second = crypto.createOpaqueToken();

    expect(first).not.toBe(second);
    expect(first).toHaveLength(64);
    expect(crypto.hashToken('refresh', first)).not.toBe(crypto.hashToken('otp', first));
    expect(crypto.hashToken('refresh', first)).toHaveLength(64);
  });

  it('hashes passwords with Argon2id and verifies only the matching password', async () => {
    const passwords = new PasswordHashService();
    const hash = await passwords.hash('correct horse battery staple');

    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(passwords.verify(hash, 'correct horse battery staple')).resolves.toBe(true);
    await expect(passwords.verify(hash, 'not the password')).resolves.toBe(false);
  }, 15_000);
});
