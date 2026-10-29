import 'reflect-metadata';
import { AddressInfo } from 'node:net';
import { VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, HttpAdapterHost, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AUTH_ACCESS_METADATA } from '../src/auth/auth-access.decorator';
import { AuthenticationGuard } from '../src/auth/authentication.guard';
import { AuthSessionService } from '../src/auth/auth-session.service';
import { CatalogService } from '../src/catalog/catalog.service';
import {
  AdminCatalogController,
  StorefrontCatalogController,
} from '../src/catalog/catalog.controller';
import { PrismaService } from '../src/platform/database/prisma.service';
import { ProblemDetailsFilter } from '../src/platform/problem-details.filter';
import { StructuredLogger } from '../src/platform/logging/structured-logger';

describe('catalog HTTP API', () => {
  const logger = { error: vi.fn() };
  const sessions = {
    validateAccessToken: vi.fn(async () => ({
      sub: 'admin-id',
      sid: 'session-id',
      typ: 'admin' as const,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900,
    })),
  };
  const prisma = {
    customer: { findUnique: vi.fn() },
    adminUser: {
      findUnique: vi.fn(async () => ({
        id: 'admin-id',
        status: 'active',
        role: {
          scope: 'store',
          permissions: [{ permission: { key: 'catalog.brands.read' } }],
        },
      })),
    },
  };
  const catalog = {
    storefrontCategories: vi.fn(async ({ page, pageSize }: { page: number; pageSize: number }) => ({
      items: [],
      total: 0,
      page,
      pageSize,
    })),
    adminBrands: vi.fn(async (input: { page: number; pageSize: number }) => ({
      items: [],
      total: 0,
      ...input,
    })),
    adminCategories: vi.fn(async (input: { page: number; pageSize: number }) => ({
      items: [],
      total: 0,
      ...input,
    })),
  };
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [StorefrontCatalogController, AdminCatalogController],
      providers: [
        { provide: Reflector, useValue: new Reflector() },
        AuthenticationGuard,
        { provide: APP_GUARD, useExisting: AuthenticationGuard },
        { provide: APP_FILTER, useExisting: ProblemDetailsFilter },
        {
          provide: ProblemDetailsFilter,
          useFactory: (adapterHost: HttpAdapterHost) =>
            new ProblemDetailsFilter(adapterHost, logger as unknown as StructuredLogger),
          inject: [HttpAdapterHost],
        },
        { provide: AuthSessionService, useValue: sessions },
        { provide: PrismaService, useValue: prisma },
        { provide: CatalogService, useValue: catalog },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/v1`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('uses storefront locale and pagination defaults while rejecting invalid pagination', async () => {
    const categories = await fetch(`${baseUrl}/storefront/categories?page=2&pageSize=5&locale=en`);

    expect(categories.status).toBe(200);
    await expect(categories.json()).resolves.toEqual({
      items: [],
      total: 0,
      page: 2,
      pageSize: 5,
    });
    expect(catalog.storefrontCategories).toHaveBeenCalledWith({
      page: 2,
      pageSize: 5,
      locale: 'en',
    });

    const defaults = await fetch(`${baseUrl}/storefront/categories`);
    expect(defaults.status).toBe(200);
    expect(catalog.storefrontCategories).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 20,
      locale: 'bn',
    });

    const invalid = await fetch(`${baseUrl}/storefront/categories?pageSize=101`);
    expect(invalid.status).toBe(400);
    expect(invalid.headers.get('content-type')).toContain('application/problem+json');
    await expect(invalid.json()).resolves.toMatchObject({ code: 'bad_request', status: 400 });
  });

  it('enforces admin authentication, current permissions, and store scope', async () => {
    const anonymous = await fetch(`${baseUrl}/admin/brands`);
    expect(anonymous.status).toBe(401);

    const authorized = await fetch(`${baseUrl}/admin/brands`, {
      headers: { authorization: 'Bearer valid-token' },
    });
    expect(authorized.status).toBe(200);
    expect(catalog.adminBrands).toHaveBeenCalledWith({ page: 1, pageSize: 20 });

    const forbidden = await fetch(`${baseUrl}/admin/categories`, {
      headers: { authorization: 'Bearer valid-token' },
    });
    expect(forbidden.status).toBe(403);
  });

  it('declares storefront routes public and admin routes permission protected', () => {
    const publicRequirement = Reflect.getMetadata(
      AUTH_ACCESS_METADATA,
      StorefrontCatalogController.prototype.categories,
    );
    const adminRequirement = Reflect.getMetadata(
      AUTH_ACCESS_METADATA,
      AdminCatalogController.prototype.brands,
    );

    expect(publicRequirement).toEqual({ access: 'public' });
    expect(adminRequirement).toEqual({
      access: 'admin',
      permission: 'catalog.brands.read',
      scope: 'store',
    });
  });
});
