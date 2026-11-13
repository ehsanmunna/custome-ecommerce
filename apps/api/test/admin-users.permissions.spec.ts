import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { AUTH_ACCESS_METADATA } from '../src/auth/auth-access.decorator';
import { AdminUsersController } from '../src/admin-users/admin-users.controller';

const routeRequirements = [
  {
    method: 'get',
    path: '/admin/users',
    permission: 'admin.users.read',
    handler: AdminUsersController.prototype.list,
  },
  {
    method: 'get',
    path: '/admin/users/{userId}',
    permission: 'admin.users.read',
    handler: AdminUsersController.prototype.get,
  },
  {
    method: 'post',
    path: '/admin/users',
    permission: 'admin.users.create',
    handler: AdminUsersController.prototype.create,
  },
  {
    method: 'patch',
    path: '/admin/users/{userId}',
    permission: 'admin.users.update',
    handler: AdminUsersController.prototype.update,
  },
  {
    method: 'post',
    path: '/admin/users/{userId}/disable',
    permission: 'admin.users.disable',
    handler: AdminUsersController.prototype.disable,
  },
] as const;

describe('admin users permission contract', () => {
  it('enforces admin access, the exact permission, and store scope on every route', () => {
    for (const route of routeRequirements) {
      const requirement = Reflect.getMetadata(AUTH_ACCESS_METADATA, route.handler);
      expect(requirement).toEqual({
        access: 'admin',
        permission: route.permission,
        scope: 'store',
      });
    }
  });
});
