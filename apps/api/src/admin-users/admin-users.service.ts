import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'database';
import { PrismaService } from '../platform/database/prisma.service';
import { PasswordHashService } from '../auth/password-hash.service';
import type {
  AdminUserCreateInput,
  AdminUserUpdateInput,
} from './admin-users.schemas';

type AdminUserRecord = Prisma.AdminUserGetPayload<{
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

interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminUserPage {
  items: AdminUserOutput[];
  meta: PaginationMeta;
}

export interface AdminUserOutput {
  id: string;
  email: string;
  displayName: string;
  status: 'active' | 'disabled';
  role: {
    id: string;
    key: string;
    name: string;
    description?: string;
    scope: 'store' | 'platform';
    system: boolean;
    permissions: string[];
  };
  permissions: string[];
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordHashService,
  ) {}

  async listAdminUsers(page: number, pageSize: number): Promise<AdminUserPage> {
    const skip = (page - 1) * pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.adminUser.findMany({
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.adminUser.count(),
    ]);

    return {
      items: items.map((user) => this.toAdminUserOutput(user)),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async getAdminUser(userId: string): Promise<AdminUserOutput> {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException(`Admin user "${userId}" not found`);
    }

    return this.toAdminUserOutput(user);
  }

  async createAdminUser(input: AdminUserCreateInput): Promise<AdminUserOutput> {
    const existing = await this.prisma.adminUser.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      throw new ConflictException(`Admin user "${input.email}" already exists`);
    }

    const role = await this.prisma.adminRole.findUnique({
      where: { id: input.roleId },
      include: {
        permissions: { include: { permission: true } },
      },
    });
    if (!role) {
      throw new BadRequestException(`Role "${input.roleId}" does not exist`);
    }

    const passwordHash = await this.passwords.hash(input.password);

    const user = await this.prisma.adminUser.create({
      data: {
        roleId: input.roleId,
        email: input.email,
        passwordHash,
        displayName: input.displayName,
        status: 'active',
      },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });

    return this.toAdminUserOutput(user);
  }

  async updateAdminUser(userId: string, input: AdminUserUpdateInput): Promise<AdminUserOutput> {
    const existing = await this.prisma.adminUser.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException(`Admin user "${userId}" not found`);
    }

    if (input.roleId !== undefined && input.roleId !== existing.roleId) {
      const role = await this.prisma.adminRole.findUnique({
        where: { id: input.roleId },
      });
      if (!role) {
        throw new BadRequestException(`Role "${input.roleId}" does not exist`);
      }
    }

    const user = await this.prisma.adminUser.update({
      where: { id: userId },
      data: {
        ...(input.displayName !== undefined && { displayName: input.displayName }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.roleId !== undefined && { roleId: input.roleId }),
      },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });

    return this.toAdminUserOutput(user);
  }

  async disableAdminUser(userId: string): Promise<void> {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });
    if (!user) {
      throw new NotFoundException(`Admin user "${userId}" not found`);
    }

    await this.prisma.adminUser.update({
      where: { id: userId },
      data: { status: 'disabled' },
    });
  }

  private toAdminUserOutput(user: AdminUserRecord): AdminUserOutput {
    const permissions = user.role.permissions.map(({ permission }) => permission.key);

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      status: user.status as 'active' | 'disabled',
      role: {
        id: user.role.id,
        key: user.role.key,
        name: user.role.name,
        description: user.role.description ?? undefined,
        scope: user.role.scope as 'store' | 'platform',
        system: user.role.isSystem,
        permissions,
      },
      permissions,
    };
  }
}
