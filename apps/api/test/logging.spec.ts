import { afterEach, describe, expect, it, vi } from 'vitest';
import { StructuredLogger } from '../src/platform/logging/structured-logger';

describe('structured logging', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redacts secret keys and secret values from output', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const secret = 'postgresql://app_runtime:super-secret@localhost:5432/app';
    const logger = new StructuredLogger({ level: 'trace', secrets: [secret] });

    logger.log({
      event: 'configuration.effective',
      DATABASE_URL: secret,
      note: `connected with ${secret}`,
      nested: { password: 'super-secret' },
    });

    const output = String(write.mock.calls[0]?.[0] ?? '');

    expect(output).not.toContain('super-secret');
    expect(output).toContain('[REDACTED]');
    expect(output).toContain('configuration.effective');
  });

  it('honours the configured log level', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const logger = new StructuredLogger({ level: 'warn', secrets: [] });

    logger.debug('hidden');
    logger.warn('shown');

    const output = write.mock.calls.map((call) => String(call[0])).join('');
    expect(output).not.toContain('hidden');
    expect(output).toContain('shown');
  });
});
