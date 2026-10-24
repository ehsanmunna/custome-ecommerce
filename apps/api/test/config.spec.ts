import { describe, expect, it } from 'vitest';
import { validateEnv } from '../src/platform/config/env.schema';

const validEnv = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgresql://app_runtime:secret@localhost:5432/app?schema=public',
  DATABASE_PROBE_TIMEOUT_MS: '2000',
  LOG_LEVEL: 'info',
};

describe('configuration validation', () => {
  it('accepts complete configuration and coerces numeric values', () => {
    const config = validateEnv(validEnv);

    expect(config.PORT).toBe(3000);
    expect(config.DATABASE_PROBE_TIMEOUT_MS).toBe(2000);
  });

  it('fails and names a missing required key without falling back to a default', () => {
    const { DATABASE_URL: _missing, ...incomplete } = validEnv;

    expect(() => validateEnv(incomplete)).toThrowError(/DATABASE_URL/);
  });

  it('fails and names a key with an invalid value', () => {
    expect(() => validateEnv({ ...validEnv, PORT: 'not-a-port' })).toThrowError(/PORT/);
    expect(() => validateEnv({ ...validEnv, DATABASE_URL: 'mysql://localhost/app' })).toThrowError(
      /DATABASE_URL/,
    );
    expect(() => validateEnv({ ...validEnv, AUTH_OTP_MAX_ATTEMPTS: '0' })).toThrowError(
      /AUTH_OTP_MAX_ATTEMPTS/,
    );
  });

  it('requires independent auth secrets of sufficient length in production', () => {
    expect(() => validateEnv({ ...validEnv, NODE_ENV: 'production' })).toThrowError(
      /AUTH_TOKEN_SIGNING_SECRET/,
    );

    expect(() =>
      validateEnv({
        ...validEnv,
        NODE_ENV: 'production',
        AUTH_TOKEN_SIGNING_SECRET: 'a'.repeat(32),
        AUTH_TOKEN_HASH_SECRET: 'b'.repeat(32),
      }),
    ).not.toThrow();

    expect(() =>
      validateEnv({
        ...validEnv,
        NODE_ENV: 'production',
        AUTH_TOKEN_SIGNING_SECRET: 'same-secret-used-for-both-32-characters',
        AUTH_TOKEN_HASH_SECRET: 'same-secret-used-for-both-32-characters',
      }),
    ).toThrowError(/must differ/);
  });

  it('rejects short configured auth secrets', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        AUTH_TOKEN_SIGNING_SECRET: 'too-short',
      }),
    ).toThrowError(/AUTH_TOKEN_SIGNING_SECRET/);
  });

  it('reports every offending key in one error', () => {
    let message = '';

    try {
      validateEnv({
        NODE_ENV: 'invalid',
        DATABASE_PROBE_TIMEOUT_MS: '-5',
        LOG_LEVEL: 'loud',
      });
    } catch (error) {
      message = (error as Error).message;
    }

    for (const key of [
      'NODE_ENV',
      'PORT',
      'DATABASE_URL',
      'DATABASE_PROBE_TIMEOUT_MS',
      'LOG_LEVEL',
    ]) {
      expect(message).toContain(key);
    }
  });
});
