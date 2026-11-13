import { describe, expect, it } from 'vitest';
import { adminUserCreateSchema } from '../src/admin-users/admin-users.schemas';

const roleId = '00000000-0000-4000-8000-000000000001';

function createInput(password: string) {
  return {
    email: 'operator@example.com',
    password,
    displayName: 'Operator',
    roleId,
  };
}

describe('admin user create schema password minimum', () => {
  it('rejects a 7-character password', () => {
    const result = adminUserCreateSchema.safeParse(createInput('1234567'));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['password'],
          message: 'Password must be at least 8 characters',
        }),
      );
    }
  });

  it('accepts an 8-character password', () => {
    const result = adminUserCreateSchema.safeParse(createInput('12345678'));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.password).toBe('12345678');
    }
  });
});
