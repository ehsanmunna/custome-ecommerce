import type { Prisma } from 'database';

export type AdminUserWithPermissions = Prisma.AdminUserGetPayload<{
  include: {
    role: {
      include: {
        permissions: {
          include: { permission: true };
        };
      };
    };
  };
}>;

export interface CustomerIdentity {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  status: 'active' | 'blocked';
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
}

export type AuthPrincipal =
  | {
      identityType: 'customer';
      subjectId: string;
      sessionId: string;
      user: CustomerIdentity;
    }
  | {
      identityType: 'admin';
      subjectId: string;
      sessionId: string;
      user: AdminUserWithPermissions;
    };

export interface AuthenticatedRequest {
  headers: { authorization?: string };
  auth?: AuthPrincipal;
}
