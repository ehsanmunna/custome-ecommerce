import { z } from 'zod';

const postgresUrl = z
  .string()
  .refine(
    (value) => value.startsWith('postgres://') || value.startsWith('postgresql://'),
    'must be a postgres:// or postgresql:// connection URL',
  );

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce
    .number()
    .int('must be an integer')
    .min(1, 'must be at least 1')
    .max(65535, 'must be at most 65535'),
  DATABASE_URL: postgresUrl,
  DATABASE_PROBE_TIMEOUT_MS: z.coerce
    .number()
    .int('must be an integer')
    .min(1, 'must be at least 1')
    .max(60_000, 'must be at most 60000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']),
});

export type AppConfig = z.infer<typeof envSchema>;

export function validateEnv(raw: NodeJS.ProcessEnv): AppConfig {
  const parsed = envSchema.safeParse(raw);

  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => {
      const key = issue.path.join('.') || 'environment';
      return `${key}: ${issue.message}`;
    });

    throw new Error(`Configuration validation failed:\n- ${problems.join('\n- ')}`);
  }

  return parsed.data;
}
