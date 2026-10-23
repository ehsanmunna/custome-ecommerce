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
