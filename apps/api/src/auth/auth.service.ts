import { timingSafeEqual } from 'node:crypto';
import {
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from 'database';
import { AuthCryptoService } from './auth-crypto.service';
import { AUTH_RUNTIME_CONFIG } from './auth-crypto.service';
import type { AuthRuntimeConfig } from './auth-crypto.service';
import type {
  CustomerRegistrationInput,
  OtpRequestInput,
  OtpVerifyInput,
  PasswordLoginInput,
} from './auth.schemas';
import { AuthSessionService } from './auth-session.service';
import type { AuthTokenPair } from './auth-session.service';
import type { AdminUserWithPermissions, CustomerIdentity } from './auth.types';
import { OTP_DELIVERY_ADAPTER } from './otp-delivery';
import type { OtpDeliveryAdapter } from './otp-delivery';
import { PasswordHashService } from './password-hash.service';
import { PrismaService } from '../platform/database/prisma.service';

const adminLoginInclude = {
  role: {
    include: {
      permissions: {
        include: { permission: true },
      },
    },
  },
} as const;

const CUSTOMER_CREDENTIAL_ERROR = 'Invalid email or password';
const OTP_CREDENTIAL_ERROR = 'Invalid or expired verification code';

class OtpRejectedError extends Error {}

export interface CustomerResponse {
  id: string;
  phone: string | null;
  email: string | null;
  displayName: string | undefined;
  status: 'active' | 'blocked';
}

export interface AdminResponse {
  id: string;
  email: string;
  displayName: string;
  status: 'active' | 'disabled';
  role: {
    id: string;
    key: string;
    name: string;
    scope: 'store' | 'platform';
    system: boolean;
    permissions: string[];
  };
  permissions: string[];
}

export interface AuthSessionResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user?: CustomerResponse | AdminResponse;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordHashService,
    private readonly crypto: AuthCryptoService,
    private readonly sessions: AuthSessionService,
    @Inject(AUTH_RUNTIME_CONFIG) private readonly config: AuthRuntimeConfig,
    @Inject(OTP_DELIVERY_ADAPTER) private readonly otpDelivery: OtpDeliveryAdapter,
  ) {}

  async registerCustomer(input: CustomerRegistrationInput): Promise<CustomerResponse> {
    const passwordHash = input.password ? await this.passwords.hash(input.password) : null;

    try {
      const customer = await this.prisma.customer.create({
        data: {
          phone: input.phone,
          email: input.email,
          passwordHash,
          firstName: input.displayName,
        },
        select: {
          id: true,
          phone: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
        },
      });

      return this.toCustomerResponse(customer);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Customer identity is already registered');
      }

      throw error;
    }
  }

  async customerPasswordLogin(input: PasswordLoginInput): Promise<AuthSessionResponse> {
    const customer = await this.prisma.customer.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        phone: true,
        email: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
        status: true,
      },
    });

    const validPassword =
      customer?.passwordHash !== null &&
      customer?.passwordHash !== undefined &&
      (await this.passwords.verify(customer.passwordHash, input.password));

    if (!customer || !validPassword || customer.status !== 'active') {
      throw new UnauthorizedException(CUSTOMER_CREDENTIAL_ERROR);
    }

    const updated = await this.prisma.customer.updateMany({
      where: { id: customer.id, status: 'active' },
      data: { lastLoginAt: new Date() },
    });
    if (updated.count !== 1) {
      throw new UnauthorizedException(CUSTOMER_CREDENTIAL_ERROR);
    }
    const tokens = await this.sessions.create('customer', customer.id);

    return this.withSession(tokens, this.toCustomerResponse(customer));
  }

  async requestCustomerOtp(input: OtpRequestInput): Promise<{ status: 'accepted' }> {
    if (!this.otpDelivery.configured) {
      throw new ServiceUnavailableException('One-time code delivery is not configured');
    }

    const destination =
      input.channel === 'email' ? input.destination.toLowerCase() : input.destination;
    const purpose = this.otpPurpose(input.channel, input.purpose);
    const customer = await this.prisma.customer.findFirst({
      where:
        input.channel === 'email'
          ? { email: destination, status: 'active' }
          : { phone: destination, status: 'active' },
      select: {
        id: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
      },
    });
    const verifiedAt =
      input.channel === 'email' ? customer?.emailVerifiedAt : customer?.phoneVerifiedAt;

    if (!customer || (input.purpose === 'registration' && verifiedAt !== null)) {
      return { status: 'accepted' };
    }

    const now = new Date();
    const code = this.crypto.createOtpCode();
    const lockHash = this.crypto.hashToken('otp', `${destination}:${purpose}`);
    const lockId = BigInt.asIntN(64, BigInt(`0x${lockHash.slice(0, 16)}`));
    const rateLimitStart = new Date(
      now.getTime() - this.config.authOtpRateLimitWindowSeconds * 1000,
    );
    const otp = await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(${lockId})`;

      const recentIssuances = await transaction.otpCode.count({
        where: { destination, purpose, createdAt: { gte: rateLimitStart } },
      });
      if (recentIssuances >= this.config.authOtpRateLimitCount) {
        return null;
      }

      await transaction.otpCode.updateMany({
        where: { destination, purpose, consumedAt: null, invalidatedAt: null },
        data: { invalidatedAt: now },
      });

      return transaction.otpCode.create({
        data: {
          channel: input.channel,
          purpose,
          destination,
          codeHash: this.crypto.hashToken('otp', code),
          expiresAt: new Date(now.getTime() + this.config.authOtpTtlSeconds * 1000),
          maxAttempts: this.config.authOtpMaxAttempts,
        },
        select: { id: true, createdAt: true },
      });
    });

    if (!otp) {
      return { status: 'accepted' };
    }

    try {
      await this.otpDelivery.send(input.channel, destination, code);
    } catch (error) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: {
          invalidatedAt: new Date(Math.max(Date.now(), otp.createdAt.getTime() + 1)),
        },
      });

      throw new ServiceUnavailableException('One-time code delivery is temporarily unavailable', {
        cause: error,
      });
    }

    return { status: 'accepted' };
  }

  async verifyCustomerOtp(input: OtpVerifyInput): Promise<AuthSessionResponse> {
    const destination =
      input.channel === 'email' ? input.destination.toLowerCase() : input.destination;
    const customer = await this.prisma.customer.findFirst({
      where:
        input.channel === 'email'
          ? { email: destination, status: 'active' }
          : { phone: destination, status: 'active' },
      select: {
        id: true,
        phone: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
      },
    });

    if (!customer) {
      throw new UnauthorizedException(OTP_CREDENTIAL_ERROR);
    }

    const purpose = this.otpPurpose(input.channel, input.purpose);
    const now = new Date();

    let otpVerified = false;
    try {
      otpVerified = await this.prisma.$transaction(async (transaction) => {
        const otp = await transaction.otpCode.findFirst({
          where: {
            channel: input.channel,
            destination,
            purpose,
            consumedAt: null,
            invalidatedAt: null,
            expiresAt: { gt: now },
          },
          orderBy: { createdAt: 'desc' },
        });

        if (
          !otp ||
          otp.expiresAt <= now ||
          otp.consumedAt !== null ||
          otp.invalidatedAt !== null ||
          otp.attempts >= otp.maxAttempts
        ) {
          return false;
        }

        const candidateHash = this.crypto.hashToken('otp', input.code);
        const matches =
          candidateHash.length === otp.codeHash.length &&
          timingSafeStringEqual(candidateHash, otp.codeHash);

        if (!matches) {
          await transaction.otpCode.updateMany({
            where: {
              id: otp.id,
              attempts: otp.attempts,
              consumedAt: null,
              invalidatedAt: null,
              expiresAt: { gt: now },
            },
            data: { attempts: { increment: 1 } },
          });
          return false;
        }

        if (input.purpose === 'registration') {
          const verified = await transaction.customer.updateMany({
            where: {
              id: customer.id,
              status: 'active',
              ...(input.channel === 'email'
                ? { emailVerifiedAt: null }
                : { phoneVerifiedAt: null }),
            },
            data: input.channel === 'email' ? { emailVerifiedAt: now } : { phoneVerifiedAt: now },
          });
          if (verified.count !== 1) {
            return false;
          }
        }

        const consumed = await transaction.otpCode.updateMany({
          where: {
            id: otp.id,
            consumedAt: null,
            invalidatedAt: null,
            attempts: { lt: otp.maxAttempts },
            expiresAt: { gt: now },
          },
          data: { consumedAt: now },
        });
        if (consumed.count !== 1) {
          throw new OtpRejectedError();
        }

        return true;
      });
    } catch (error) {
      if (error instanceof OtpRejectedError) {
        throw new UnauthorizedException(OTP_CREDENTIAL_ERROR);
      }

      throw error;
    }

    if (!otpVerified) {
      throw new UnauthorizedException(OTP_CREDENTIAL_ERROR);
    }

    const activeCustomer = await this.prisma.customer.updateMany({
      where: { id: customer.id, status: 'active' },
      data: { lastLoginAt: now },
    });
    if (activeCustomer.count !== 1) {
      throw new UnauthorizedException(OTP_CREDENTIAL_ERROR);
    }
    const tokens = await this.sessions.create('customer', customer.id);

    return this.withSession(tokens, this.toCustomerResponse(customer));
  }

  async refreshCustomer(refreshToken: string): Promise<AuthSessionResponse> {
    const tokens = await this.sessions.rotate(refreshToken, 'customer');
    const customer = await this.prisma.customer.findUnique({
      where: { id: tokens.subjectId },
      select: { id: true, status: true },
    });
    if (!customer || customer.status !== 'active') {
      await this.sessions.revoke(tokens.sessionId);
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.withSession(tokens);
  }

  async refreshAdmin(refreshToken: string): Promise<AuthSessionResponse> {
    const tokens = await this.sessions.rotate(refreshToken, 'admin');
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: tokens.subjectId },
      select: { id: true, status: true },
    });
    if (!admin || admin.status !== 'active') {
      await this.sessions.revoke(tokens.sessionId);
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.withSession(tokens);
  }

  async adminPasswordLogin(input: PasswordLoginInput): Promise<AuthSessionResponse> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { email: input.email },
      include: adminLoginInclude,
    });
    const validPassword =
      admin !== null && (await this.passwords.verify(admin.passwordHash, input.password));

    if (!admin || !validPassword || admin.status !== 'active') {
      throw new UnauthorizedException(CUSTOMER_CREDENTIAL_ERROR);
    }

    const activeAdmin = await this.prisma.adminUser.updateMany({
      where: { id: admin.id, status: 'active' },
      data: { lastLoginAt: new Date() },
    });
    if (activeAdmin.count !== 1) {
      throw new UnauthorizedException(CUSTOMER_CREDENTIAL_ERROR);
    }
    const tokens = await this.sessions.create('admin', admin.id);

    return this.withSession(tokens, this.toAdminResponse(admin));
  }

  customerIdentity(user: CustomerIdentity): CustomerResponse {
    return this.toCustomerResponse(user);
  }

  adminIdentity(user: AdminUserWithPermissions): AdminResponse {
    return this.toAdminResponse(user);
  }

  private otpPurpose(
    channel: 'sms' | 'email',
    purpose: 'login' | 'registration',
  ): 'customer_login' | 'phone_verification' | 'email_verification' {
    if (purpose === 'login') {
      return 'customer_login';
    }

    return channel === 'sms' ? 'phone_verification' : 'email_verification';
  }

  private withSession(
    tokens: AuthTokenPair,
    user?: CustomerResponse | AdminResponse,
  ): AuthSessionResponse {
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      ...(user ? { user } : {}),
    };
  }

  private toCustomerResponse(customer: {
    id: string;
    phone: string | null;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    status: 'active' | 'blocked';
  }): CustomerResponse {
    const displayName =
      [customer.firstName, customer.lastName].filter(Boolean).join(' ') || undefined;

    return {
      id: customer.id,
      phone: customer.phone,
      email: customer.email,
      displayName,
      status: customer.status,
    };
  }

  private toAdminResponse(admin: AdminUserWithPermissions): AdminResponse {
    const permissions = admin.role.permissions.map(({ permission }) => permission.key);

    return {
      id: admin.id,
      email: admin.email,
      displayName: admin.displayName,
      status: admin.status,
      role: {
        id: admin.role.id,
        key: admin.role.key,
        name: admin.role.name,
        scope: admin.role.scope,
        system: admin.role.isSystem,
        permissions,
      },
      permissions,
    };
  }
}

function timingSafeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
