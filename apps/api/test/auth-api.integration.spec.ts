import 'reflect-metadata';
import { AddressInfo } from 'node:net';
import { VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, HttpAdapterHost, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AdminAuthController, CustomerAuthController } from '../src/auth/auth.controller';
import { AuthenticationGuard } from '../src/auth/authentication.guard';
import { AuthService } from '../src/auth/auth.service';
import { AuthSessionService } from '../src/auth/auth-session.service';
import { PrismaService } from '../src/platform/database/prisma.service';
import { ProblemDetailsFilter } from '../src/platform/problem-details.filter';
import { StructuredLogger } from '../src/platform/logging/structured-logger';

describe('authentication HTTP API', () => {
  const sessions = {
    validateAccessToken: vi.fn(async () => ({
      sub: 'customer-id',
      sid: 'session-id',
      typ: 'customer' as const,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900,
    })),
    revoke: vi.fn(async () => undefined),
  };
  const prisma = {
    customer: {
      findUnique: vi.fn(async () => ({
        id: 'customer-id',
        email: 'customer@example.com',
        phone: null,
        firstName: 'Customer',
        lastName: null,
        status: 'active',
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
      })),
    },
    adminUser: { findUnique: vi.fn() },
  };
  const auth = {
    registerCustomer: vi.fn(async () => ({
      id: 'customer-id',
      email: 'customer@example.com',
      phone: null,
      status: 'active',
    })),
    customerPasswordLogin: vi.fn(async () => ({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 900,
    })),
    requestCustomerOtp: vi.fn(),
    verifyCustomerOtp: vi.fn(),
    refreshCustomer: vi.fn(),
    refreshAdmin: vi.fn(),
    adminPasswordLogin: vi.fn(),
    customerIdentity: vi.fn(() => ({
      id: 'customer-id',
      email: 'customer@example.com',
      phone: null,
      status: 'active',
    })),
    adminIdentity: vi.fn(),
  };
  const logger = { error: vi.fn() };
  let baseUrl: string;
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CustomerAuthController, AdminAuthController],
      providers: [
        { provide: Reflector, useValue: new Reflector() },
        AuthenticationGuard,
        { provide: APP_GUARD, useExisting: AuthenticationGuard },
        { provide: APP_FILTER, useExisting: ProblemDetailsFilter },
        {
          provide: ProblemDetailsFilter,
          useFactory: (adapterHost: HttpAdapterHost, logger: StructuredLogger) =>
            new ProblemDetailsFilter(adapterHost, logger),
          inject: [HttpAdapterHost, StructuredLogger],
        },
        { provide: AuthService, useValue: auth },
        { provide: AuthSessionService, useValue: sessions },
        { provide: PrismaService, useValue: prisma },
        { provide: StructuredLogger, useValue: logger },
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

  it('serves public login and returns a standardized validation problem on malformed input', async () => {
    const login = await fetch(`${baseUrl}/storefront/customers/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: '' }),
    });
    const loginBody = await login.json();

    expect(login.status, JSON.stringify({ body: loginBody, logs: logger.error.mock.calls })).toBe(
      400,
    );
    expect(login.headers.get('content-type')).toContain('application/problem+json');
    expect(loginBody).toMatchObject({
      status: 400,
      code: 'bad_request',
      errors: expect.arrayContaining([
        expect.objectContaining({ field: 'email' }),
        expect.objectContaining({ field: 'password' }),
      ]),
    });

    const validLogin = await fetch(`${baseUrl}/storefront/customers/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'CUSTOMER@example.com', password: 'secret' }),
    });
    expect(validLogin.status).toBe(200);
    await expect(validLogin.json()).resolves.toMatchObject({ accessToken: 'access' });
  });

  it('requires a valid customer session for identity and logout operations', async () => {
    const unauthenticated = await fetch(`${baseUrl}/storefront/customers/me`);
    const unauthenticatedBody = await unauthenticated.json();
    expect(unauthenticated.status, JSON.stringify(unauthenticatedBody)).toBe(401);
    expect(unauthenticatedBody).toMatchObject({
      status: 401,
      code: 'unauthorized',
    });

    const identity = await fetch(`${baseUrl}/storefront/customers/me`, {
      headers: { authorization: 'Bearer test-access' },
    });
    expect(identity.status).toBe(200);
    await expect(identity.json()).resolves.toMatchObject({
      id: 'customer-id',
      email: 'customer@example.com',
    });

    const logout = await fetch(`${baseUrl}/storefront/customers/auth/logout`, {
      method: 'POST',
      headers: { authorization: 'Bearer test-access' },
    });
    expect(logout.status).toBe(204);
    expect(sessions.revoke).toHaveBeenCalledWith('session-id');
  });
});
