import { STATUS_CODES } from 'node:http';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { StructuredLogger } from './logging/structured-logger';

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance: string;
  code: string;
  errors?: Array<{ field: string; code: string; message?: string }>;
}

@Catch()
@Injectable()
export class ProblemDetailsFilter implements ExceptionFilter {
  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly logger: StructuredLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const httpException = exception instanceof HttpException ? exception : undefined;
    const status = httpException?.getStatus() ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const request = host.switchToHttp().getRequest<{ url?: string }>();
    const response = host.switchToHttp().getResponse();
    const problem = this.createProblem(httpException, status, request.url ?? '/');

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        {
          event: 'http.exception',
          status,
          errorType: exception instanceof Error ? exception.name : 'UnknownException',
        },
        undefined,
        ProblemDetailsFilter.name,
      );
    }

    this.adapterHost.httpAdapter.setHeader(response, 'content-type', 'application/problem+json');
    this.adapterHost.httpAdapter.reply(response, problem, status);
  }

  private createProblem(
    httpException: HttpException | undefined,
    status: number,
    instance: string,
  ): ProblemDetails {
    const response = httpException?.getResponse();
    const body =
      response !== null && typeof response === 'object'
        ? (response as Record<string, unknown>)
        : undefined;
    const detail =
      status >= HttpStatus.INTERNAL_SERVER_ERROR
        ? 'An unexpected error occurred'
        : typeof body?.detail === 'string'
          ? body.detail
          : typeof body?.message === 'string'
            ? body.message
            : typeof response === 'string'
              ? response
              : undefined;
    const errors = this.validationErrors(body?.errors);
    const code = this.codeForStatus(status);

    return {
      type: 'about:blank',
      title: STATUS_CODES[status] ?? 'Error',
      status,
      ...(detail ? { detail } : {}),
      instance,
      code,
      ...(errors && errors.length > 0 ? { errors } : {}),
    };
  }

  private validationErrors(value: unknown): ProblemDetails['errors'] {
    if (!Array.isArray(value)) {
      return undefined;
    }

    return value.flatMap((entry) => {
      if (entry === null || typeof entry !== 'object') {
        return [];
      }

      const error = entry as Record<string, unknown>;
      if (typeof error.field !== 'string' && typeof error.path !== 'string') {
        return [];
      }

      return [
        {
          field: typeof error.field === 'string' ? error.field : (error.path as string),
          code: typeof error.code === 'string' ? error.code : 'invalid',
          ...(typeof error.message === 'string' ? { message: error.message } : {}),
        },
      ];
    });
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'bad_request';
      case HttpStatus.UNAUTHORIZED:
        return 'unauthorized';
      case HttpStatus.FORBIDDEN:
        return 'forbidden';
      case HttpStatus.NOT_FOUND:
        return 'not_found';
      case HttpStatus.CONFLICT:
        return 'conflict';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'rate_limited';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'service_unavailable';
      default:
        return status >= HttpStatus.INTERNAL_SERVER_ERROR ? 'internal_error' : 'request_error';
    }
  }
}
