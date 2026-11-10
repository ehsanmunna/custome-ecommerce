import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_METADATA } from './roles.decorator';
import type { AuthenticatedRequest } from './auth.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowedRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!allowedRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const auth = request.auth;
    if (!auth || auth.identityType !== 'admin') {
      throw new ForbiddenException('Admin authentication is required');
    }

    const roleKey = auth.user.role.key;
    if (!allowedRoles.includes(roleKey)) {
      throw new ForbiddenException('Insufficient role for this operation');
    }

    return true;
  }
}
