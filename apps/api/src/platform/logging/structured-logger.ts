import type { LoggerService } from '@nestjs/common';
import { redactRecord, redactText } from './redact';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

const LEVEL_ORDER: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

export interface StructuredLoggerOptions {
  level: LogLevel;
  secrets: string[];
}

export class StructuredLogger implements LoggerService {
  constructor(private readonly options: StructuredLoggerOptions) {}

  log(message: unknown, context?: string): void {
    this.write('info', message, context);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  error(message: unknown, stack?: string, context?: string): void {
    this.write('error', message, context, stack);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('trace', message, context);
  }

  fatal(message: unknown, context?: string): void {
    this.write('fatal', message, context);
  }

  private write(level: LogLevel, message: unknown, context?: string, stack?: string): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.options.level]) {
      return;
    }

    const payload: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
    };

    if (context) {
      payload.context = context;
    }

    payload.message =
      message !== null && typeof message === 'object'
        ? redactRecord(message as Record<string, unknown>, this.options.secrets)
        : redactText(String(message), this.options.secrets);

    if (stack) {
      payload.stack = redactText(stack, this.options.secrets);
    }

    process.stdout.write(`${JSON.stringify(payload)}\n`);
  }
}
