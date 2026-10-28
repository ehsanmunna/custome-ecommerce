import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export const roleKeySchema = z.string().trim().min(1).max(200).regex(/^[a-z][a-z0-9_.-]*$/);

export const roleInputSchema = z
  .object({
    key: roleKeySchema,
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2_000).optional(),
    scope: z.enum(['store', 'platform']),
    permissionKeys: z.array(z.string()).min(1),
  })
  .strict()
  .refine((input) => new Set(input.permissionKeys).size === input.permissionKeys.length, {
    message: 'Permission keys must be unique',
    path: ['permissionKeys'],
  });

export const roleUpdateInputSchema = z
  .object({
    key: roleKeySchema.optional(),
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2_000).optional(),
    scope: z.enum(['store', 'platform']).optional(),
    permissionKeys: z.array(z.string()).min(1).optional(),
  })
  .strict()
  .refine((input) => {
    if (input.permissionKeys !== undefined) {
      return new Set(input.permissionKeys).size === input.permissionKeys.length;
    }
    return true;
  }, {
    message: 'Permission keys must be unique',
    path: ['permissionKeys'],
  });

export const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export function parseRolesInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Invalid roles request',
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
        message: issue.message,
      })),
    });
  }

  return parsed.data;
}

export type RoleInput = z.infer<typeof roleInputSchema>;
export type RoleUpdateInput = z.infer<typeof roleUpdateInputSchema>;
