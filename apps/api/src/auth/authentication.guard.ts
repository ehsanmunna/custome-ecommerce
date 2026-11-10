import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthAccessRequirement, AUTH_ACCESS_METADATA } from './auth-access.decorator';
import { AuthSessionService } from './auth-session.service';
import type { AuthenticatedRequest } from './auth.types';
import { PrismaService } from '../platform/database/prisma.service';

const adminPermissionsInclude = {
  role: {
    include: {
      permissions: { include: { permission: true } },
    },
  },
} as const;

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthSessionService) private readonly sessions: AuthSessionService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<AuthAccessRequirement>(
      AUTH_ACCESS_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!requirement) {
      throw new ForbiddenException('Route access policy is not configured');
    }

    if (requirement.access === 'public') {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.bearerToken(request.headers.authorization);
    const identityType = requirement.access;
    const claims = await this.sessions.validateAccessToken(token, identityType);

    if (identityType === 'customer') {
      const user = await this.prisma.customer.findUnique({
        where: { id: claims.sub },
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          status: true,
          emailVerifiedAt: true,
          phoneVerifiedAt: true,
        },
      });
      if (!user || user.status !== 'active') {
        throw new UnauthorizedException('Invalid or inactive customer session');
      }

      request.auth = {
        identityType,
        subjectId: user.id,
        sessionId: claims.sid,
        user,
      };
      return true;
    }

    const user = await this.prisma.adminUser.findUnique({
      where: { id: claims.sub },
      include: adminPermissionsInclude,
    });
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Invalid or inactive admin session');
    }

    if (!requirement.permission) {
      throw new ForbiddenException('Admin operation has no required permission');
    }

    const permissions = user.role.permissions.map(({ permission }) => permission.key);
    if (!permissions.includes(requirement.permission)) {
      throw new ForbiddenException('Required admin permission is missing');
    }

    if (user.role.scope !== requirement.scope) {
      throw new ForbiddenException('Admin role scope does not permit this operation');
    }

    request.auth = {
      identityType,
      subjectId: user.id,
      sessionId: claims.sid,
      user,
    };
    return true;
  }

  private bearerToken(authorization: string | undefined): string {
    const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
    if (!match) {
      throw new UnauthorizedException('Bearer authentication is required');
    }

    return match[1];
  }
}
