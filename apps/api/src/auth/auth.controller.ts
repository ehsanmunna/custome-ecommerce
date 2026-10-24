import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { z } from 'zod';
import { AuthAccess } from './auth-access.decorator';
import {
  customerRegistrationSchema,
  otpRequestSchema,
  otpVerifySchema,
  passwordLoginSchema,
  refreshRequestSchema,
} from './auth.schemas';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from './auth.types';
import { AuthSessionService } from './auth-session.service';

function parseBody<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Invalid request body',
      errors: parsed.error.issues.map(({ path, message }) => ({
        path: path.join('.'),
        message,
      })),
    });
  }

  return parsed.data;
}

@Controller('storefront/customers')
export class CustomerAuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AuthSessionService) private readonly sessions: AuthSessionService,
  ) {}

  @Post()
  @AuthAccess({ access: 'public' })
  register(@Body() body: unknown) {
    return this.auth.registerCustomer(parseBody(customerRegistrationSchema, body));
  }

  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @AuthAccess({ access: 'public' })
  login(@Body() body: unknown) {
    return this.auth.customerPasswordLogin(parseBody(passwordLoginSchema, body));
  }

  @Post('auth/otp')
  @HttpCode(HttpStatus.ACCEPTED)
  @AuthAccess({ access: 'public' })
  requestOtp(@Body() body: unknown) {
    return this.auth.requestCustomerOtp(parseBody(otpRequestSchema, body));
  }

  @Post('auth/otp/verify')
  @HttpCode(HttpStatus.OK)
  @AuthAccess({ access: 'public' })
  verifyOtp(@Body() body: unknown) {
    return this.auth.verifyCustomerOtp(parseBody(otpVerifySchema, body));
  }

  @Post('auth/refresh')
  @HttpCode(HttpStatus.OK)
  @AuthAccess({ access: 'public' })
  refresh(@Body() body: unknown) {
    const { refreshToken } = parseBody(refreshRequestSchema, body);
    return this.auth.refreshCustomer(refreshToken);
  }

  @Post('auth/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthAccess({ access: 'customer' })
  async logout(@Req() request: AuthenticatedRequest): Promise<void> {
    const sessionId = request.auth?.sessionId;
    if (!sessionId) {
      throw new UnauthorizedException('Authenticated customer session is unavailable');
    }
    await this.sessions.revoke(sessionId);
  }

  @Get('me')
  @AuthAccess({ access: 'customer' })
  current(@Req() request: AuthenticatedRequest) {
    if (request.auth?.identityType !== 'customer') {
      throw new BadRequestException('Customer identity is unavailable');
    }

    return this.auth.customerIdentity(request.auth.user);
  }
}

@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AuthSessionService) private readonly sessions: AuthSessionService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @AuthAccess({ access: 'public' })
  login(@Body() body: unknown) {
    return this.auth.adminPasswordLogin(parseBody(passwordLoginSchema, body));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @AuthAccess({ access: 'public' })
  refresh(@Body() body: unknown) {
    const { refreshToken } = parseBody(refreshRequestSchema, body);
    return this.auth.refreshAdmin(refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthAccess({ access: 'admin', permission: 'admin.auth.logout', scope: 'store' })
  async logout(@Req() request: AuthenticatedRequest): Promise<void> {
    const sessionId = request.auth?.sessionId;
    if (!sessionId) {
      throw new UnauthorizedException('Authenticated admin session is unavailable');
    }
    await this.sessions.revoke(sessionId);
  }

  @Get('me')
  @AuthAccess({ access: 'admin', permission: 'admin.auth.read', scope: 'store' })
  current(@Req() request: AuthenticatedRequest) {
    if (request.auth?.identityType !== 'admin') {
      throw new BadRequestException('Admin identity is unavailable');
    }

    return this.auth.adminIdentity(request.auth.user);
  }
}
