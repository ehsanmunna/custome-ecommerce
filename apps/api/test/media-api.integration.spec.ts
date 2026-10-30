import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { AddressInfo } from 'node:net';
import { VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, HttpAdapterHost, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSessionService } from '../src/auth/auth-session.service';
import { AuthenticationGuard } from '../src/auth/authentication.guard';
import { MediaController } from '../src/media/media.controller';
import { MEDIA_STORAGE } from '../src/media/media-storage';
import { MediaService } from '../src/media/media.service';
import { AppConfigService } from '../src/platform/config/app-config.service';
import { PrismaService } from '../src/platform/database/prisma.service';
import { StructuredLogger } from '../src/platform/logging/structured-logger';
import { ProblemDetailsFilter } from '../src/platform/problem-details.filter';

interface Row {
  id: string;
  provider: 'r2';
  storageKey: string;
  mimeType: string;
  sizeBytes: bigint;
  width: number | null;
  height: number | null;
  createdAt: Date;
  updatedAt: Date;
  altTexts: Array<{ locale: 'bn' | 'en'; altText: string }>;
}

describe('media HTTP API', () => {
  const rows: Row[] = [];
  const objects = new Map<string, { sizeBytes: number; mimeType: string }>();
  let configured = true;
  let permissionKeys = new Set(['media.read', 'media.create', 'media.delete']);
  let scope = 'store';
  const logger = { log: vi.fn(), error: vi.fn() };
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
    adminUser: {
      findUnique: vi.fn(async () => ({
        id: 'admin-id',
        status: 'active',
        role: {
          scope,
          permissions: [...permissionKeys].map((key) => ({ permission: { key } })),
        },
      })),
    },
    mediaAsset: {
      findMany: vi.fn(async (args: { skip: number; take: number }) =>
        rows
          .slice()
          .sort(
            (left, right) =>
              right.createdAt.getTime() - left.createdAt.getTime() ||
              right.id.localeCompare(left.id),
          )
          .slice(args.skip, args.skip + args.take),
      ),
      count: vi.fn(async () => rows.length),
      create: vi.fn(async (args: { data: Record<string, any> }) => {
        const { data } = args;
        const row: Row = {
          id: randomUUID(),
          provider: data.provider,
          storageKey: data.storageKey,
          mimeType: data.mimeType,
          sizeBytes: BigInt(data.sizeBytes),
          width: null,
          height: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          altTexts: data.altTexts?.create ?? [],
        };
        rows.push(row);
        return row;
      }),
      findUnique: vi.fn(async (args: { where: { id: string }; select?: unknown }) => {
        const row = rows.find((candidate) => candidate.id === args.where.id);
        if (!row) return null;
        return args.select ? { id: row.id, storageKey: row.storageKey } : row;
      }),
      update: vi.fn(async (args: { where: { id: string }; data: Record<string, any> }) => {
        const row = rows.find((candidate) => candidate.id === args.where.id);
        if (!row) throw new Error('missing row');
        Object.assign(row, args.data, { updatedAt: new Date() });
        return row;
      }),
      delete: vi.fn(async (args: { where: { id: string } }) => {
        const index = rows.findIndex((candidate) => candidate.id === args.where.id);
        if (index < 0) throw new Error('missing row');
        rows.splice(index, 1);
      }),
    },
  };
  const storage = {
    isConfigured: () => configured,
    isImageResizingEnabled: () => true,
    createUpload: vi.fn(async (key: string, mimeType: string) => ({
      url: `https://r2.test/upload/${encodeURIComponent(key)}?signature=test`,
      method: 'PUT' as const,
      headers: { 'Content-Type': mimeType },
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    })),
    headObject: vi.fn(async (key: string) => objects.get(key) ?? null),
    deleteObject: vi.fn(async (key: string) => {
      objects.delete(key);
    }),
    publicUrl: (key: string) => `https://cdn.test/${key}`,
    variantUrl: (key: string, width: number) =>
      `https://cdn.test/cdn-cgi/image/width=${width},format=auto/${key}`,
  };
  const config = { r2MaxUploadBytes: 4096, r2UploadTtlSeconds: 600 };
  let app: INestApplication;
  let baseUrl: string;
  const authHeaders = {
    authorization: 'Bearer valid-token',
    'content-type': 'application/json',
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MediaController],
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
        { provide: MEDIA_STORAGE, useValue: storage },
        { provide: AppConfigService, useValue: config },
        { provide: StructuredLogger, useValue: logger },
        MediaService,
      ],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/v1`;
  });

  beforeEach(() => {
    rows.length = 0;
    objects.clear();
    configured = true;
    permissionKeys = new Set(['media.read', 'media.create', 'media.delete']);
    scope = 'store';
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires bearer admin authentication', async () => {
    const response = await fetch(`${baseUrl}/admin/media`);

    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
  });

  it('enforces persisted permissions and store scope on each route', async () => {
    permissionKeys = new Set(['media.read']);
    const list = await fetch(`${baseUrl}/admin/media`, { headers: authHeaders });
    expect(list.status).toBe(200);

    const create = await fetch(`${baseUrl}/admin/media`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ fileName: 'a.png', mimeType: 'image/png', sizeBytes: 10 }),
    });
    expect(create.status).toBe(403);

    permissionKeys = new Set(['media.read', 'media.create', 'media.delete']);
    scope = 'platform';
    const wrongScope = await fetch(`${baseUrl}/admin/media`, { headers: authHeaders });
    expect(wrongScope.status).toBe(403);
  });

  it('creates, completes, lists, and deletes a media asset', async () => {
    const create = await fetch(`${baseUrl}/admin/media`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        fileName: 'product.png',
        mimeType: 'image/png',
        sizeBytes: 512,
        alt: { en: 'Product image', bn: 'পণ্যের ছবি' },
      }),
    });

    expect(create.status).toBe(201);
    const created = (await create.json()) as {
      id: string;
      key: string;
      upload: { url: string; method: string; headers: Record<string, string> };
      variants: { thumbnail: { url: string; width: number } };
    };
    expect(created.key).toMatch(/^media\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/);
    expect(created.upload).toMatchObject({
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
    });
    expect(created.variants.thumbnail.width).toBe(160);
    expect(rows).toHaveLength(1);
    expect(objects.has(created.key)).toBe(false);

    objects.set(created.key, { sizeBytes: 2048, mimeType: 'image/webp' });

    const complete = await fetch(`${baseUrl}/admin/media/${created.id}/complete`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ width: 800, height: 600 }),
    });
    expect(complete.status).toBe(200);
    const completed = (await complete.json()) as Record<string, unknown>;
    expect(completed).toMatchObject({
      id: created.id,
      mimeType: 'image/webp',
      sizeBytes: 2048,
      width: 800,
      height: 600,
    });

    const repeat = await fetch(`${baseUrl}/admin/media/${created.id}/complete`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ width: 800, height: 600 }),
    });
    expect(repeat.status).toBe(200);
    expect(await repeat.json()).toMatchObject({ sizeBytes: 2048, width: 800, height: 600 });

    const list = await fetch(`${baseUrl}/admin/media?page=1&pageSize=5`, {
      headers: authHeaders,
    });
    expect(list.status).toBe(200);
    await expect(list.json()).resolves.toMatchObject({
      total: 1,
      page: 1,
      pageSize: 5,
      items: [{ id: created.id, sizeBytes: 2048, alt: { en: 'Product image', bn: 'পণ্যের ছবি' } }],
    });

    const remove = await fetch(`${baseUrl}/admin/media/${created.id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    expect(remove.status).toBe(204);
    expect(rows).toHaveLength(0);
    expect(objects.has(created.key)).toBe(false);

    const missing = await fetch(`${baseUrl}/admin/media/${created.id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    expect(missing.status).toBe(404);
  });

  it('conflicts when completion runs before the object exists', async () => {
    const create = await fetch(`${baseUrl}/admin/media`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ fileName: 'a.png', mimeType: 'image/png', sizeBytes: 10 }),
    });
    const created = (await create.json()) as { id: string };

    const complete = await fetch(`${baseUrl}/admin/media/${created.id}/complete`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    });

    expect(complete.status).toBe(409);
    expect(complete.headers.get('content-type')).toContain('application/problem+json');
  });

  it('rejects invalid pagination, media types, sizes, dimensions, and identifiers', async () => {
    const pagination = await fetch(`${baseUrl}/admin/media?pageSize=101`, {
      headers: authHeaders,
    });
    expect(pagination.status).toBe(400);

    const unsupported = await fetch(`${baseUrl}/admin/media`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ fileName: 'vector.svg', mimeType: 'image/svg+xml', sizeBytes: 10 }),
    });
    expect(unsupported.status).toBe(400);

    const oversized = await fetch(`${baseUrl}/admin/media`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ fileName: 'large.png', mimeType: 'image/png', sizeBytes: 4097 }),
    });
    expect(oversized.status).toBe(400);

    const incompleteDimensions = await fetch(
      `${baseUrl}/admin/media/00000000-0000-4000-8000-000000000000/complete`,
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ width: 10 }),
      },
    );
    expect(incompleteDimensions.status).toBe(400);

    const malformedId = await fetch(`${baseUrl}/admin/media/not-a-uuid`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    expect(malformedId.status).toBe(400);
  });

  it('returns service unavailable when storage is not configured', async () => {
    configured = false;

    const list = await fetch(`${baseUrl}/admin/media`, { headers: authHeaders });
    expect(list.status).toBe(503);

    const create = await fetch(`${baseUrl}/admin/media`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ fileName: 'a.png', mimeType: 'image/png', sizeBytes: 10 }),
    });
    expect(create.status).toBe(503);
    expect(rows).toHaveLength(0);
  });
});
