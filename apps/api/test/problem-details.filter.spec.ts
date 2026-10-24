import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { ProblemDetailsFilter } from '../src/platform/problem-details.filter';
import type { StructuredLogger } from '../src/platform/logging/structured-logger';

function createFilter() {
  const adapter = {
    setHeader: vi.fn(),
    reply: vi.fn(),
  };
  const adapterHost = { httpAdapter: adapter } as unknown as HttpAdapterHost;
  const logger = { error: vi.fn() } as unknown as StructuredLogger;
  const filter = new ProblemDetailsFilter(adapterHost, logger);
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ url: '/v1/storefront/customers' }),
      getResponse: () => ({ response: true }),
    }),
  };

  return { filter, adapter, logger, host };
}

describe('RFC 9457 problem details filter', () => {
  it('serializes validation errors using the shared problem schema', () => {
    const { filter, adapter, host } = createFilter();
    filter.catch(
      new BadRequestException({
        message: 'Invalid request body',
        errors: [{ path: 'email', message: 'Invalid email' }],
      }),
      host as never,
    );

    expect(adapter.setHeader).toHaveBeenCalledWith(
      expect.anything(),
      'content-type',
      'application/problem+json',
    );
    expect(adapter.reply).toHaveBeenCalledWith(
      expect.anything(),
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        detail: 'Invalid request body',
        instance: '/v1/storefront/customers',
        code: 'bad_request',
        errors: [{ field: 'email', code: 'invalid', message: 'Invalid email' }],
      },
      400,
    );
  });

  it('does not expose internal server exception details and logs the failure', () => {
    const { filter, adapter, logger, host } = createFilter();
    filter.catch(new InternalServerErrorException('database password leaked?'), host as never);

    const body = vi.mocked(adapter.reply).mock.calls[0]?.[1];
    expect(body).toMatchObject({
      type: 'about:blank',
      status: 500,
      detail: 'An unexpected error occurred',
      code: 'internal_error',
    });
    expect(JSON.stringify(body)).not.toContain('database password');
    expect(logger.error).toHaveBeenCalled();
  });
});
