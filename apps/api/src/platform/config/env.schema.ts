import { z } from 'zod';

const postgresUrl = z
  .string()
  .refine(
    (value) => value.startsWith('postgres://') || value.startsWith('postgresql://'),
    'must be a postgres:// or postgresql:// connection URL',
  );

const booleanFromString = z.preprocess((value) => {
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return value;
}, z.boolean());

export const envSchema = z
  .object({
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
    AUTH_TOKEN_SIGNING_SECRET: z.string().min(32).optional(),
    AUTH_TOKEN_HASH_SECRET: z.string().min(32).optional(),
    AUTH_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(1).max(3600).default(900),
    AUTH_REFRESH_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(2_592_000)
      .default(2_592_000),
    AUTH_OTP_TTL_SECONDS: z.coerce.number().int().min(30).max(600).default(300),
    AUTH_OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),
    AUTH_OTP_RATE_LIMIT_COUNT: z.coerce.number().int().min(1).max(20).default(5),
    AUTH_OTP_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(60).max(86_400).default(3600),
    R2_ACCOUNT_ID: z.string().trim().min(1).optional(),
    R2_BUCKET: z.string().trim().min(1).optional(),
    R2_ACCESS_KEY_ID: z.string().trim().min(1).optional(),
    R2_SECRET_ACCESS_KEY: z.string().trim().min(1).optional(),
    R2_PUBLIC_BASE_URL: z.string().trim().min(1).optional(),
    R2_UPLOAD_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(600),
    R2_MAX_UPLOAD_BYTES: z.coerce.number().int().min(1).max(104_857_600).default(10_485_760),
    R2_IMAGE_RESIZING_ENABLED: booleanFromString.default(true),
  })
  .superRefine((config, context) => {
    if (config.NODE_ENV === 'production') {
      for (const key of ['AUTH_TOKEN_SIGNING_SECRET', 'AUTH_TOKEN_HASH_SECRET'] as const) {
        if (!config[key]) {
          context.addIssue({
            code: 'custom',
            path: [key],
            message: 'is required in production',
          });
        }
      }

      if (
        config.AUTH_TOKEN_SIGNING_SECRET &&
        config.AUTH_TOKEN_SIGNING_SECRET === config.AUTH_TOKEN_HASH_SECRET
      ) {
        context.addIssue({
          code: 'custom',
          path: ['AUTH_TOKEN_HASH_SECRET'],
          message: 'must differ from AUTH_TOKEN_SIGNING_SECRET in production',
        });
      }
    }
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
