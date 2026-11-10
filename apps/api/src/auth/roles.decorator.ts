import { SetMetadata } from '@nestjs/common';

export const ROLES_METADATA = 'roles:allowed';

export const Roles = (...roles: string[]) => SetMetadata(ROLES_METADATA, roles);
