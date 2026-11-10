import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { AuthAccessRequirement } from '../src/auth/auth-access.decorator';
import { AuthenticationGuard } from '../src/auth/authentication.guard';
import type { AuthSessionService } from '../src/auth/auth-session.service';
import type { PrismaService } from '../src/platform/database/prisma.service';

function createContext(requirement: AuthAccessRequirement | undefined, authorization?: string) {
  const reflector = {
    getAllAndOverride: vi.fn(() => requirement),
  } as unknown as Reflector;
  const sessions = {
    validateAccessToken: vi.fn(async () => ({
      sub: 'user-id',
      sid: 'session-id',
      typ: requirement?.access === 'admin' ? 'admin' : 'customer',
      iat: 1,
      exp: 2,
    })),
  } as unknown as AuthSessionService;
  const request: { headers: { authorization?: string }; auth?: unknown } = {
    headers: { authorization },
  };
  const context = {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  };

  return { reflector, sessions, request, context };
}

describe('authentication guard', () => {
  it('leaves explicitly public routes available without token lookups', async () => {
    const { reflector, sessions, context } = createContext({ access: 'public' });
    const prisma = {} as PrismaService;
    const guard = new AuthenticationGuard(reflector, sessions, prisma);

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(sessions.validateAccessToken).not.toHaveBeenCalled();
  });

  it('fails closed when a route has no access policy', async () => {
    const { reflector, sessions, context } = createContext(undefined);
    const prisma = {} as PrismaService;
    const guard = new AuthenticationGuard(reflector, sessions, prisma);

    await expect(guard.canActivate(context as never)).rejects.toThrow(ForbiddenException);
    expect(sessions.validateAccessToken).not.toHaveBeenCalled();
  });

  it('requires a bearer token for protected customer routes', async () => {
    const { reflector, sessions, context } = createContext({ access: 'customer' });
    const prisma = {} as PrismaService;
    const guard = new AuthenticationGuard(reflector, sessions, prisma);

    await expect(guard.canActivate(context as never)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects inactive customers and attaches active authenticated identities', async () => {
    const requirement = { access: 'customer' } as const;
    const { reflector, sessions, request, context } = createContext(
      requirement,
      'Bearer access-token',
    );
    const user = {
      id: 'user-id',
      email: 'customer@example.com',
      phone: null,
      firstName: null,
      lastName: null,
      status: 'blocked',
      emailVerifiedAt: null,
      phoneVerifiedAt: null,
    };
    const prisma = {
      customer: { findUnique: vi.fn(async () => user) },
    } as unknown as PrismaService;
    const guard = new AuthenticationGuard(reflector, sessions, prisma);

    await expect(guard.canActivate(context as never)).rejects.toThrow(UnauthorizedException);
    expect(sessions.validateAccessToken).toHaveBeenCalledWith('access-token', 'customer');

    user.status = 'active';
    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(request.auth).toMatchObject({
      identityType: 'customer',
      subjectId: 'user-id',
      sessionId: 'session-id',
    });
  });

  it('enforces current admin permissions and role scope on each request', async () => {
    const requirement: AuthAccessRequirement = {
      access: 'admin',
      permission: 'catalog.products.read',
      scope: 'store',
    };
    const { reflector, sessions, request, context } = createContext(
      requirement,
      'Bearer access-token',
    );
    const user = {
      id: 'user-id',
      email: 'admin@example.com',
      displayName: 'Admin',
      status: 'active',
      role: {
        id: 'role-id',
        key: 'store-manager',
        name: 'Store manager',
        scope: 'store',
        isSystem: true,
        permissions: [{ permission: { key: 'catalog.products.read' } }],
      },
    };
    const findUnique = vi.fn(async () => user);
    const prisma = { adminUser: { findUnique } } as unknown as PrismaService;
    const guard = new AuthenticationGuard(reflector, sessions, prisma);

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(request.auth).toMatchObject({
      identityType: 'admin',
      subjectId: 'user-id',
      sessionId: 'session-id',
    });

    user.role.permissions = [{ permission: { key: 'orders.read' } }];
    await expect(guard.canActivate(context as never)).rejects.toThrow(ForbiddenException);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('denies a platform role on a store-scoped operation even with a matching permission', async () => {
    const requirement: AuthAccessRequirement = {
      access: 'admin',
      permission: 'catalog.products.read',
      scope: 'store',
    };
    const { reflector, sessions, context } = createContext(requirement, 'Bearer access-token');
    const prisma = {
      adminUser: {
        findUnique: vi.fn(async () => ({
          id: 'admin-id',
          status: 'active',
          role: {
            scope: 'platform',
            permissions: [{ permission: { key: 'catalog.products.read' } }],
          },
        })),
      },
    } as unknown as PrismaService;
    const guard = new AuthenticationGuard(reflector, sessions, prisma);

    await expect(guard.canActivate(context as never)).rejects.toThrow(ForbiddenException);
  });
});
