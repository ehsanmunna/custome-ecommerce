import { describe, expect, it } from 'vitest';
import {
  pageItems,
  pagePageSize,
  pageTotal,
  type PageResponse,
  type Permission,
  type Role,
} from './roles.models';

const roles: Role[] = [
  {
    id: 'role-1',
    key: 'manager',
    name: 'Manager',
    scope: 'store',
    system: true,
    permissions: ['admin.roles.read'],
  },
];

const permissions: Permission[] = [
  { key: 'admin.roles.read', description: 'View roles', group: 'admin-roles', sortOrder: 10 },
];

describe('roles.models', () => {
  it('reads items from a response with runtime meta pagination', () => {
    const response: PageResponse<Role> = {
      items: roles,
      meta: { page: 1, pageSize: 100, total: 55, totalPages: 1 },
    };

    expect(pageItems(response)).toEqual(roles);
    expect(pageTotal(response)).toBe(55);
    expect(pagePageSize(response, 10)).toBe(100);
  });

  it('reads items and total from a response with top-level pagination', () => {
    const response: PageResponse<Permission> = {
      items: permissions,
      total: 12,
      page: 1,
      pageSize: 20,
    };

    expect(pageItems(response)).toEqual(permissions);
    expect(pageTotal(response)).toBe(12);
    expect(pagePageSize(response, 10)).toBe(20);
  });

  it('falls back to the item count when no total is reported', () => {
    expect(pageTotal({ items: roles })).toBe(1);
  });

  it('handles missing responses', () => {
    expect(pageItems(undefined)).toEqual([]);
    expect(pageTotal(null)).toBe(0);
    expect(pagePageSize(undefined, 25)).toBe(25);
  });
});
