import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuthCryptoService } from '../src/auth/auth-crypto.service';
import type { AuthRuntimeConfig } from '../src/auth/auth-crypto.service';
import {
  customerRegistrationSchema,
  otpRequestSchema,
  otpVerifySchema,
  passwordLoginSchema,
} from '../src/auth/auth.schemas';
import { AuthService } from '../src/auth/auth.service';
import type { AuthSessionService } from '../src/auth/auth-session.service';
import type { OtpDeliveryAdapter } from '../src/auth/otp-delivery';
import type { PasswordHashService } from '../src/auth/password-hash.service';
import type { PrismaService } from '../src/platform/database/prisma.service';

const config: AuthRuntimeConfig = {
  authTokenSigningSecret: 'signing-secret-for-auth-tests-32-characters',
  authTokenHashSecret: 'hashing-secret-for-auth-tests-32-characters',
  authAccessTokenTtlSeconds: 900,
  authRefreshTokenTtlSeconds: 86_400,
  authOtpTtlSeconds: 300,
  authOtpMaxAttempts: 5,
  authOtpRateLimitCount: 5,
  authOtpRateLimitWindowSeconds: 3600,
};

const tokenPair = {
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresIn: 900,
  sessionId: 'session-id',
  subjectId: 'customer-id',
};

function createHarness(
  options: {
    otpConfigured?: boolean;
    otpCodeCreate?: (data: Record<string, unknown>) => Promise<{ id: string }>;
    otpCount?: number;
    otpFindFirst?: Record<string, unknown> | null;
    otpSend?: (channel: 'sms' | 'email', destination: string, code: string) => Promise<void>;
    otpCodeUpdate?: () => Promise<unknown>;
    otpAttemptsUpdate?: () => Promise<{ count: number }>;
    otpConsume?: () => Promise<{ count: number }>;
    customerFindFirst?: Record<string, unknown> | null;
  } = {},
) {
  let savedOtp: Record<string, unknown> | undefined;
  const otpCreate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    savedOtp = {
      ...data,
      id: 'otp-id',
      createdAt: new Date(),
      attempts: 0,
      consumedAt: null,
      invalidatedAt: null,
    };
    return { id: 'otp-id', createdAt: savedOtp.createdAt as Date };
  });
  const otpFindFirst = vi.fn(async () => options?.otpFindFirst ?? savedOtp ?? null);
  let otpUpdateCount = 0;
  const otpUpdateMany = vi.fn(async () => {
    const handler = otpUpdateCount++ === 0 ? options.otpAttemptsUpdate : options.otpConsume;
    return handler ? handler() : { count: 1 };
  });
  const tx = {
    $queryRaw: vi.fn(async () => []),
    otpCode: {
      count: vi.fn(async () => options?.otpCount ?? 0),
      updateMany: otpUpdateMany,
      create: options?.otpCodeCreate
        ? vi.fn(async ({ data }: { data: Record<string, unknown> }) =>
            options.otpCodeCreate?.(data),
          )
        : otpCreate,
      findFirst: otpFindFirst,
    },
    customer: {
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  };
  const prisma = {
    $transaction: vi.fn(async <T>(callback: (transaction: typeof tx) => Promise<T>) =>
      callback(tx),
    ),
    customer: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(async () => options?.customerFindFirst ?? null),
      updateMany: vi.fn(async () => ({ count: 1 })),
      update: vi.fn(async () => ({
        id: 'customer-id',
        phone: '+8801712345678',
        email: 'user@example.com',
        firstName: 'Test User',
        lastName: null,
        status: 'active',
      })),
    },
    adminUser: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    otpCode: {
      update: options?.otpCodeUpdate ? vi.fn(options.otpCodeUpdate) : vi.fn(),
    },
  } as unknown as PrismaService;

  const passwords = {
    hash: vi.fn(async () => 'argon2id-hash'),
    verify: vi.fn(async () => true),
  } as unknown as PasswordHashService;
  const sessions = {
    create: vi.fn(async () => tokenPair),
    rotate: vi.fn(async () => tokenPair),
    revoke: vi.fn(async () => undefined),
  } as unknown as AuthSessionService;
  const delivery = {
    configured: options?.otpConfigured ?? false,
    send: options?.otpSend ?? vi.fn(async () => undefined),
  } as OtpDeliveryAdapter;
  const crypto = new AuthCryptoService(config);
  const service = new AuthService(prisma, passwords, crypto, sessions, config, delivery);

  return {
    service,
    prisma,
    passwords,
    sessions,
    delivery,
    tx,
    crypto,
    getSavedOtp: () => savedOtp,
  };
}

describe('customer authentication service', () => {
  it('registers customers with a password hash and returns no credential fields', async () => {
    const { service, prisma, passwords } = createHarness();
    vi.mocked(prisma.customer.create).mockResolvedValue({
      id: 'customer-id',
      phone: null,
      email: 'user@example.com',
      firstName: 'Test User',
      lastName: null,
      status: 'active',
    } as never);

    const input = customerRegistrationSchema.parse({
      email: 'User@Example.com',
      password: 'long-enough',
      displayName: 'Test User',
    });
    const customer = await service.registerCustomer(input);

    expect(passwords.hash).toHaveBeenCalledWith('long-enough');
    expect(prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'user@example.com',
          passwordHash: 'argon2id-hash',
        }),
      }),
    );
    expect(customer).toEqual({
      id: 'customer-id',
      phone: null,
      email: 'user@example.com',
      displayName: 'Test User',
      status: 'active',
    });
    expect(JSON.stringify(customer)).not.toContain('password');
  });

  it('establishes a customer session after valid password login', async () => {
    const { service, prisma, sessions } = createHarness();
    vi.mocked(prisma.customer.findUnique).mockResolvedValue({
      id: 'customer-id',
      phone: null,
      email: 'user@example.com',
      passwordHash: 'argon2id-hash',
      firstName: 'Test User',
      lastName: null,
      status: 'active',
    } as never);

    const result = await service.customerPasswordLogin(
      passwordLoginSchema.parse({ email: 'USER@example.com', password: 'secret' }),
    );

    expect(sessions.create).toHaveBeenCalledWith('customer', 'customer-id');
    expect(result).toMatchObject({
      accessToken: 'access',
      refreshToken: 'refresh',
      user: { id: 'customer-id', email: 'user@example.com' },
    });
  });

  it('rejects invalid customer credentials without distinguishing account state', async () => {
    const { service, prisma } = createHarness();
    vi.mocked(prisma.customer.findUnique).mockResolvedValue(null);

    await expect(
      service.customerPasswordLogin(
        passwordLoginSchema.parse({ email: 'missing@example.com', password: 'secret' }),
      ),
    ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
  });

  it('authenticates an active admin and returns current role permissions', async () => {
    const { service, prisma, sessions } = createHarness();
    vi.mocked(prisma.adminUser.findUnique).mockResolvedValue({
      id: 'admin-id',
      email: 'admin@example.com',
      passwordHash: 'argon2id-hash',
      displayName: 'Store Admin',
      status: 'active',
      role: {
        id: 'role-id',
        key: 'manager',
        name: 'Manager',
        scope: 'store',
        isSystem: true,
        permissions: [{ permission: { key: 'admin.auth.read' } }],
      },
    } as never);

    const result = await service.adminPasswordLogin(
      passwordLoginSchema.parse({ email: 'ADMIN@example.com', password: 'secret' }),
    );

    expect(sessions.create).toHaveBeenCalledWith('admin', 'admin-id');
    expect(result.user).toMatchObject({
      id: 'admin-id',
      role: { scope: 'store', permissions: ['admin.auth.read'] },
      permissions: ['admin.auth.read'],
    });
    expect(JSON.stringify(result)).not.toContain('passwordHash');
  });

  it('rejects disabled admins and revokes refreshes for accounts no longer active', async () => {
    const { service, prisma, sessions } = createHarness();
    vi.mocked(prisma.adminUser.findUnique).mockResolvedValue({
      id: 'admin-id',
      email: 'admin@example.com',
      passwordHash: 'argon2id-hash',
      displayName: 'Disabled Admin',
      status: 'disabled',
      role: {
        id: 'role-id',
        key: 'manager',
        name: 'Manager',
        scope: 'store',
        isSystem: true,
        permissions: [],
      },
    } as never);

    await expect(
      service.adminPasswordLogin(
        passwordLoginSchema.parse({ email: 'admin@example.com', password: 'secret' }),
      ),
    ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    expect(sessions.create).not.toHaveBeenCalled();

    vi.mocked(prisma.adminUser.findUnique).mockResolvedValue({
      id: 'admin-id',
      status: 'disabled',
    } as never);
    await expect(service.refreshAdmin('refresh')).rejects.toThrow(UnauthorizedException);
    expect(sessions.rotate).toHaveBeenCalledWith('refresh', 'admin');
    expect(sessions.revoke).toHaveBeenCalledWith('session-id');
  });

  it('refreshes a customer session only while the customer remains active', async () => {
    const { service, prisma, sessions } = createHarness();
    vi.mocked(prisma.customer.findUnique).mockResolvedValue({
      id: 'customer-id',
      status: 'active',
    } as never);

    await expect(service.refreshCustomer('refresh')).resolves.toMatchObject({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    expect(sessions.rotate).toHaveBeenCalledWith('refresh', 'customer');

    vi.mocked(prisma.customer.findUnique).mockResolvedValue({
      id: 'customer-id',
      status: 'blocked',
    } as never);
    await expect(service.refreshCustomer('refresh')).rejects.toThrow(UnauthorizedException);
    expect(sessions.revoke).toHaveBeenCalledWith('session-id');
  });

  it('fails closed when no OTP delivery provider is configured', async () => {
    const { service, prisma } = createHarness();

    await expect(
      service.requestCustomerOtp(
        otpRequestSchema.parse({
          channel: 'sms',
          destination: '+8801712345678',
          purpose: 'login',
        }),
      ),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(prisma.customer.findFirst).not.toHaveBeenCalled();
  });

  it('stores only an OTP hash and sends the code through the selected channel', async () => {
    let deliveredCode = '';
    const { service, delivery, tx, crypto, getSavedOtp } = createHarness({
      otpConfigured: true,
      customerFindFirst: {
        id: 'customer-id',
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
      },
      otpSend: vi.fn(async (_channel, _destination, code) => {
        deliveredCode = code;
      }),
    });

    await expect(
      service.requestCustomerOtp(
        otpRequestSchema.parse({
          channel: 'email',
          destination: 'USER@EXAMPLE.COM',
          purpose: 'login',
        }),
      ),
    ).resolves.toEqual({ status: 'accepted' });

    const persisted = getSavedOtp();
    expect(delivery.send).toHaveBeenCalledWith('email', 'user@example.com', deliveredCode);
    expect(deliveredCode).toMatch(/^\d{6}$/);
    expect(persisted?.destination).toBe('user@example.com');
    expect(persisted?.codeHash).toBe(crypto.hashToken('otp', deliveredCode));
    expect(persisted?.codeHash).not.toBe(deliveredCode);
    expect(tx.otpCode.create).toHaveBeenCalled();
  });

  it('does not issue another code after the destination limit is reached', async () => {
    const { service, delivery, tx } = createHarness({
      otpConfigured: true,
      otpCount: config.authOtpRateLimitCount,
      customerFindFirst: {
        id: 'customer-id',
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
      },
    });

    await expect(
      service.requestCustomerOtp(
        otpRequestSchema.parse({
          channel: 'sms',
          destination: '+8801712345678',
          purpose: 'login',
        }),
      ),
    ).resolves.toEqual({ status: 'accepted' });
    expect(delivery.send).not.toHaveBeenCalled();
    expect(tx.otpCode.create).not.toHaveBeenCalled();
  });

  it('invalidates a pending OTP and reports delivery failure', async () => {
    const otpCodeUpdate = vi.fn(async () => undefined);
    const { service } = createHarness({
      otpConfigured: true,
      customerFindFirst: {
        id: 'customer-id',
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
      },
      otpCodeUpdate,
      otpSend: vi.fn(async () => {
        throw new Error('provider failed');
      }),
    });

    await expect(
      service.requestCustomerOtp(
        otpRequestSchema.parse({
          channel: 'sms',
          destination: '+8801712345678',
          purpose: 'login',
        }),
      ),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(otpCodeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { invalidatedAt: expect.any(Date) } }),
    );
  });

  it('increments attempts on an incorrect OTP without creating a session', async () => {
    const now = new Date();
    const crypto = new AuthCryptoService(config);
    const candidate = '123456';
    const attemptUpdate = vi.fn(async () => ({ count: 1 }));
    const { service, sessions, tx } = createHarness({
      customerFindFirst: {
        id: 'customer-id',
        phone: '+8801712345678',
        email: null,
        firstName: null,
        lastName: null,
        status: 'active',
      },
      otpFindFirst: {
        id: 'otp-id',
        channel: 'sms',
        destination: '+8801712345678',
        purpose: 'customer_login',
        codeHash: crypto.hashToken('otp', '654321'),
        expiresAt: new Date(now.getTime() + 60_000),
        consumedAt: null,
        invalidatedAt: null,
        attempts: 1,
        maxAttempts: 5,
        createdAt: now,
      },
      otpAttemptsUpdate: attemptUpdate,
    });

    await expect(
      service.verifyCustomerOtp(
        otpVerifySchema.parse({
          channel: 'sms',
          destination: '+8801712345678',
          purpose: 'login',
          code: candidate,
        }),
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(attemptUpdate).toHaveBeenCalled();
    expect(tx.otpCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { attempts: { increment: 1 } } }),
    );
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('rejects expired and exhausted OTP records without consuming them', async () => {
    const now = new Date();
    const crypto = new AuthCryptoService(config);
    const customer = {
      id: 'customer-id',
      phone: '+8801712345678',
      email: null,
      firstName: null,
      lastName: null,
      status: 'active',
    };
    const { service, sessions, tx } = createHarness({
      customerFindFirst: customer,
      otpFindFirst: {
        id: 'otp-id',
        channel: 'sms',
        destination: customer.phone,
        purpose: 'customer_login',
        codeHash: crypto.hashToken('otp', '123456'),
        expiresAt: new Date(now.getTime() - 1000),
        consumedAt: null,
        invalidatedAt: null,
        attempts: 0,
        maxAttempts: 5,
        createdAt: new Date(now.getTime() - 10_000),
      },
    });
    const input = otpVerifySchema.parse({
      channel: 'sms',
      destination: customer.phone,
      purpose: 'login',
      code: '123456',
    });

    await expect(service.verifyCustomerOtp(input)).rejects.toThrow(UnauthorizedException);
    expect(tx.otpCode.updateMany).not.toHaveBeenCalled();

    vi.mocked(tx.otpCode.findFirst).mockResolvedValue({
      id: 'otp-id',
      channel: 'sms',
      destination: customer.phone,
      purpose: 'customer_login',
      codeHash: crypto.hashToken('otp', '123456'),
      expiresAt: new Date(now.getTime() + 60_000),
      consumedAt: null,
      invalidatedAt: null,
      attempts: 5,
      maxAttempts: 5,
      createdAt: new Date(now.getTime() - 10_000),
    } as never);

    await expect(service.verifyCustomerOtp(input)).rejects.toThrow(UnauthorizedException);
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('consumes a valid registration OTP, verifies the contact, and establishes a session', async () => {
    const now = new Date();
    const code = '004321';
    const crypto = new AuthCryptoService(config);
    const customer = {
      id: 'customer-id',
      phone: '+8801712345678',
      email: null,
      firstName: null,
      lastName: null,
      status: 'active',
    };
    const { service, sessions, tx } = createHarness({
      customerFindFirst: customer,
      otpFindFirst: {
        id: 'otp-id',
        channel: 'sms',
        destination: customer.phone,
        purpose: 'phone_verification',
        codeHash: crypto.hashToken('otp', code),
        expiresAt: new Date(now.getTime() + 60_000),
        consumedAt: null,
        invalidatedAt: null,
        attempts: 0,
        maxAttempts: 5,
        createdAt: now,
      },
    });

    const result = await service.verifyCustomerOtp(
      otpVerifySchema.parse({
        channel: 'sms',
        destination: customer.phone,
        purpose: 'registration',
        code,
      }),
    );

    expect(tx.customer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { phoneVerifiedAt: expect.any(Date) } }),
    );
    expect(tx.otpCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { consumedAt: expect.any(Date) } }),
    );
    expect(sessions.create).toHaveBeenCalledWith('customer', 'customer-id');
    expect(result.user).toMatchObject({ id: 'customer-id' });
  });

  it('rejects reuse of a consumed OTP without creating another session', async () => {
    const now = new Date();
    const code = '123456';
    const crypto = new AuthCryptoService(config);
    const customer = {
      id: 'customer-id',
      phone: '+8801712345678',
      email: null,
      firstName: null,
      lastName: null,
      status: 'active',
    };
    const { service, sessions, tx } = createHarness({
      customerFindFirst: customer,
      otpFindFirst: {
        id: 'otp-id',
        channel: 'sms',
        destination: customer.phone,
        purpose: 'customer_login',
        codeHash: crypto.hashToken('otp', code),
        expiresAt: new Date(now.getTime() + 60_000),
        consumedAt: null,
        invalidatedAt: null,
        attempts: 0,
        maxAttempts: 5,
        createdAt: now,
      },
    });
    const input = otpVerifySchema.parse({
      channel: 'sms',
      destination: customer.phone,
      purpose: 'login',
      code,
    });

    await expect(service.verifyCustomerOtp(input)).resolves.toBeDefined();
    vi.mocked(tx.otpCode.findFirst).mockResolvedValue(null);

    await expect(service.verifyCustomerOtp(input)).rejects.toThrow(UnauthorizedException);
    expect(sessions.create).toHaveBeenCalledTimes(1);
  });
});
