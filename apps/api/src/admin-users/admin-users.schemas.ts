import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export const adminUserIdParamSchema = z.string().uuid({ message: 'Invalid admin user id' });

export const adminUserCreateSchema = z
  .object({
    email: z.string().email({ message: 'Invalid email address' }).trim().toLowerCase(),
    password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
    displayName: z.string().trim().min(1, { message: 'Display name is required' }).max(200),
    roleId: z.string().uuid({ message: 'Invalid role id' }),
  })
  .strict();

export const adminUserUpdateSchema = z
  .object({
    displayName: z.string().trim().min(1, { message: 'Display name is required' }).max(200).optional(),
    status: z.enum(['active', 'disabled']).optional(),
    roleId: z.string().uuid({ message: 'Invalid role id' }).optional(),
  })
  .strict()
  .refine(
    (input) => Object.keys(input).length > 0,
    { message: 'At least one field must be provided', path: [] },
  );

export const adminUsersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export function parseAdminUserInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Invalid admin user request',
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
        message: issue.message,
      })),
    });
  }
  return parsed.data;
}

export type AdminUserCreateInput = z.infer<typeof adminUserCreateSchema>;
export type AdminUserUpdateInput = z.infer<typeof adminUserUpdateSchema>;
