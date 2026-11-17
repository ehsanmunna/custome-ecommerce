import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { parseRolesInput, roleInputSchema, roleUpdateInputSchema } from '../src/roles/roles.schemas';

const validRole = {
  key: 'store_manager',
  name: 'Store manager',
  scope: 'store',
  permissionKeys: ['admin.roles.read'],
} as const;

function keyError(input: unknown): unknown {
  try {
    parseRolesInput(roleInputSchema, input);
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    return (error as BadRequestException).getResponse();
  }
  throw new Error('Expected the role input to be rejected');
}

describe('role key validation', () => {
  it('accepts keys that match the database constraint', () => {
    expect(parseRolesInput(roleInputSchema, validRole).key).toBe('store_manager');
    expect(parseRolesInput(roleInputSchema, { ...validRole, key: 'auditor2' }).key).toBe('auditor2');
  });

  it.each(['store-manager', 'store.manager', 'Store_manager', '1store', 'store manager'])(
    'rejects the invalid key %s with a validation error',
    (key) => {
      expect(keyError({ ...validRole, key })).toMatchObject({
        message: 'Invalid roles request',
        errors: [expect.objectContaining({ path: 'key' })],
      });
    },
  );

  it('applies the same rule when updating a role', () => {
    expect(() => parseRolesInput(roleUpdateInputSchema, { key: 'store-manager' })).toThrow(
      BadRequestException,
    );
    expect(parseRolesInput(roleUpdateInputSchema, { key: 'store_manager' })).toEqual({
      key: 'store_manager',
    });
  });
});
