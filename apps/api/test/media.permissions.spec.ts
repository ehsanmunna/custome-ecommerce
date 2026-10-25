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
import { MEDIA_PERMISSION_MAP } from '../src/media/media.permissions';
import type { AuthSessionService } from '../src/auth/auth-session.service';
import type { PrismaService } from '../src/platform/database/prisma.service';

const document = parse(readFileSync(resolve(process.cwd(), 'openapi/openapi.yaml'), 'utf8')) as {
  paths: Record<string, Record<string, { 'x-required-permission'?: string }>>;
  'x-implemented-operations': string[];
};

const routeRequirements = [
  { method: 'get', path: '/admin/media', handler: MediaController.prototype.list },
  { method: 'post', path: '/admin/media', handler: MediaController.prototype.create },
  {
    method: 'post',
    path: '/admin/media/{mediaId}/complete',
    handler: MediaController.prototype.complete,
  },
  { method: 'delete', path: '/admin/media/{mediaId}', handler: MediaController.prototype.remove },
] as const;

describe('media permission mapping', () => {
  it('maps every contract media permission to a persisted permission and applies it to routes', () => {
    for (const route of routeRequirements) {
      const operation = document.paths[route.path]?.[route.method];
      const contractPermission = operation?.['x-required-permission'];
      expect(contractPermission).toBeDefined();
      expect(MEDIA_PERMISSION_MAP).toHaveProperty(contractPermission!);

      const requirement = Reflect.getMetadata(AUTH_ACCESS_METADATA, route.handler);
      expect(requirement).toEqual({
        access: 'admin',
        permission: MEDIA_PERMISSION_MAP[contractPermission as keyof typeof MEDIA_PERMISSION_MAP],
        scope: 'store',
      });
    }

    expect(MEDIA_PERMISSION_MAP).toEqual({
      'media.read': 'media_read',
      'media.create': 'media_manage',
      'media.delete': 'media_manage',
    });
  });

  it('keeps media operations in the implemented-operations list', () => {
    for (const route of routeRequirements) {
      expect(document['x-implemented-operations']).toContain(
        `${route.method.toUpperCase()} ${route.path}`,
      );
    }
  });

  it('enforces the persisted media permission and store scope in the guard', async () => {
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
          role: { scope: 'store', permissions: [{ permission: { key: 'media_read' } }] },
        })),
      },
    };
    const guard = new AuthenticationGuard(
      new Reflector() as never,
      sessions as unknown as AuthSessionService,
      prisma as unknown as PrismaService,
    );
    const listContext = contextFor(MediaController.prototype.list);
    const deleteContext = contextFor(MediaController.prototype.remove);

    await expect(guard.canActivate(listContext)).resolves.toBe(true);
    await expect(guard.canActivate(deleteContext)).rejects.toBeInstanceOf(ForbiddenException);

    prisma.adminUser.findUnique.mockResolvedValueOnce({
      id: 'admin-id',
      status: 'active',
      role: { scope: 'platform', permissions: [{ permission: { key: 'media_manage' } }] },
    } as never);
    await expect(guard.canActivate(deleteContext)).rejects.toBeInstanceOf(ForbiddenException);

    prisma.adminUser.findUnique.mockResolvedValueOnce({
      id: 'admin-id',
      status: 'active',
      role: { scope: 'store', permissions: [{ permission: { key: 'media_manage' } }] },
    } as never);
    await expect(guard.canActivate(deleteContext)).resolves.toBe(true);
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
