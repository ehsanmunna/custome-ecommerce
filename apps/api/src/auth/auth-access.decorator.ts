import { SetMetadata } from '@nestjs/common';
export const AUTH_ACCESS_METADATA = 'auth:access';

export type AuthAccessRequirement =
  | { access: 'public' }
  | { access: 'customer' }
  | { access: 'admin'; permission: string; scope: 'store' | 'platform' };

export const AuthAccess = (requirement: AuthAccessRequirement) =>
  SetMetadata(AUTH_ACCESS_METADATA, requirement);
