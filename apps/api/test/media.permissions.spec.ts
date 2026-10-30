import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { parse } from 'yaml';
import { describe, expect, it, vi } from 'vitest';
import { AUTH_ACCESS_METADATA } from '../src/auth/auth-access.decorator';
import { AuthenticationGuard } from '../src/auth/authentication.guard';
import { MediaController } from '../src/media/media.controller';
import type { AuthSessionService } from '../src/auth/auth-session.service';
import type { PrismaService } from '../src/platform/database/prisma.service';

const document = parse(readFileSync(resolve(process.cwd(), 'openapi/openapi.yaml'), 'utf8')) as {
  paths: Record<string, Record<string, { 'x-required-permission'?: string }>>;
  'x-implemented-operations': string[];
};

const routeRequirements = [
  {
    method: 'get',
    path: '/admin/media',
    permission: 'media.read',
    handler: MediaController.prototype.list,
  },
  {
    method: 'post',
    path: '/admin/media',
    permission: 'media.create',
    handler: MediaController.prototype.create,
  },
  {
    method: 'post',
    path: '/admin/media/{mediaId}/complete',
    permission: 'media.create',
    handler: MediaController.prototype.complete,
  },
  {
    method: 'delete',
    path: '/admin/media/{mediaId}',
    permission: 'media.delete',
    handler: MediaController.prototype.remove,
  },
] as const;

describe('media permission contract', () => {
  it('uses the exact contract permission key for every implemented route', () => {
    for (const route of routeRequirements) {
      const operation = document.paths[route.path]?.[route.method];
      expect(operation?.['x-required-permission']).toBe(route.permission);

      const requirement = Reflect.getMetadata(AUTH_ACCESS_METADATA, route.handler);
      expect(requirement).toEqual({
        access: 'admin',
        permission: route.permission,
        scope: 'store',
      });
    }
  });

  it('keeps media operations in the implemented-operations list', () => {
    for (const route of routeRequirements) {
      expect(document['x-implemented-operations']).toContain(
        `${route.method.toUpperCase()} ${route.path}`,
      );
    }
  });

  it('enforces the canonical media permission and store scope in the guard', async () => {
    let permissionKeys = ['media.read'];
    let scope = 'store';
    const sessions = {
      validateAccessToken: vi.fn(async () => ({
        sub: 'admin-id',
        sid: 'session-id',
        typ: 'admin' as const,
      })),
    };
    const prisma = {
      adminUser: {
        findUnique: vi.fn(async () => ({
          id: 'admin-id',
          status: 'active',
          role: {
            scope,
            permissions: permissionKeys.map((key) => ({ permission: { key } })),
          },
        })),
      },
    };
    const guard = new AuthenticationGuard(
      new Reflector() as never,
      sessions as unknown as AuthSessionService,
      prisma as unknown as PrismaService,
    );
    const listContext = contextFor(MediaController.prototype.list);
    const createContext = contextFor(MediaController.prototype.create);
    const deleteContext = contextFor(MediaController.prototype.remove);

    await expect(guard.canActivate(listContext)).resolves.toBe(true);
    await expect(guard.canActivate(createContext)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard.canActivate(deleteContext)).rejects.toBeInstanceOf(ForbiddenException);

    permissionKeys = ['media.create', 'media.delete'];
    await expect(guard.canActivate(createContext)).resolves.toBe(true);
    await expect(guard.canActivate(deleteContext)).resolves.toBe(true);

    permissionKeys = ['media_read', 'media_manage'];
    await expect(guard.canActivate(listContext)).rejects.toBeInstanceOf(ForbiddenException);

    permissionKeys = ['media.delete'];
    scope = 'platform';
    await expect(guard.canActivate(deleteContext)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

function contextFor(handler: (...args: never[]) => unknown) {
  const request = {
    headers: { authorization: 'Bearer token' },
  };
  return {
    getHandler: () => handler,
    getClass: () => MediaController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}
