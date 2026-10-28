import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'database';
import { PrismaService } from '../platform/database/prisma.service';

type RoleRecord = Prisma.AdminRoleGetPayload<{
  include: {
    permissions: {
      include: { permission: true };
    };
  };
}>;

interface RoleInput {
  key: string;
  name: string;
  description?: string;
  scope: 'store' | 'platform';
  permissionKeys: string[];
}

export interface RoleOutput {
  id: string;
  key: string;
  name: string;
  description?: string;
  scope: 'store' | 'platform';
  system: boolean;
  permissions: string[];
}

interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface RolePage {
  items: RoleOutput[];
  meta: PaginationMeta;
}

interface PermissionOutput {
  id: string;
  key: string;
  description?: string;
  group: string;
  sortOrder: number;
}

export interface PermissionPage {
  items: PermissionOutput[];
  meta: PaginationMeta;
}

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async listRoles(page: number, pageSize: number): Promise<RolePage> {
    const skip = (page - 1) * pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.adminRole.findMany({
        include: {
          permissions: {
            include: { permission: true },
          },
        },
        skip,
        take: pageSize,
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.adminRole.count(),
    ]);

    return {
      items: items.map((role) => this.toRoleOutput(role)),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async createRole(input: RoleInput): Promise<RoleOutput> {
    const existing = await this.prisma.adminRole.findUnique({
      where: { key: input.key },
    });
    if (existing) {
      throw new ConflictException(`Role "${input.key}" already exists`);
    }

    const permissions = await this.prisma.adminPermission.findMany({
      where: { key: { in: input.permissionKeys } },
    });
    if (permissions.length !== input.permissionKeys.length) {
      throw new BadRequestException('One or more permission keys are invalid');
    }

    const role = await this.prisma.adminRole.create({
      data: {
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        scope: input.scope,
        isSystem: false,
        sortOrder: 0,
        permissions: {
          create: input.permissionKeys.map((key) => ({
            permission: { connect: { key } },
          })),
        },
      },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });

    return this.toRoleOutput(role);
  }

  async updateRole(roleId: string, input: Partial<RoleInput>): Promise<RoleOutput> {
    const existing = await this.prisma.adminRole.findUnique({
      where: { id: roleId },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException(`Role "${roleId}" not found`);
    }

    if (existing.isSystem && input.scope !== undefined && input.scope !== existing.scope) {
      throw new ConflictException('Cannot change scope of a system role');
    }

    if (input.permissionKeys !== undefined) {
      const permissions = await this.prisma.adminPermission.findMany({
        where: { key: { in: input.permissionKeys } },
      });
      if (permissions.length !== input.permissionKeys.length) {
        throw new BadRequestException('One or more permission keys are invalid');
      }
    }

    const role = await this.prisma.adminRole.update({
      where: { id: roleId },
      data: {
        ...(input.key !== undefined && { key: input.key }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.scope !== undefined && { scope: input.scope }),
        ...(input.permissionKeys !== undefined && {
          permissions: {
            deleteMany: {},
            create: input.permissionKeys.map((key) => ({
              permission: { connect: { key } },
            })),
          },
        }),
      },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });

    return this.toRoleOutput(role);
  }

  async deleteRole(roleId: string): Promise<void> {
    const role = await this.prisma.adminRole.findUnique({
      where: { id: roleId },
      include: { users: true },
    });
    if (!role) {
      throw new NotFoundException(`Role "${roleId}" not found`);
    }
    if (role.isSystem) {
      throw new ConflictException('Cannot delete a system role');
    }
    if (role.users.length > 0) {
      throw new ConflictException('Cannot delete a role assigned to admin users');
    }

    await this.prisma.adminRole.delete({
      where: { id: roleId },
    });
  }

  async listPermissions(page: number, pageSize: number): Promise<PermissionPage> {
    const skip = (page - 1) * pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.adminPermission.findMany({
        skip,
        take: pageSize,
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.adminPermission.count(),
    ]);

    return {
      items: items.map((p) => ({
        id: p.id,
        key: p.key,
        description: p.description ?? undefined,
        group: p.groupKey,
        sortOrder: p.sortOrder,
      })),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  private toRoleOutput(role: RoleRecord): RoleOutput {
    return {
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description ?? undefined,
      scope: role.scope as 'store' | 'platform',
      system: role.isSystem,
      permissions: role.permissions.map((rp) => rp.permission.key),
    };
  }
}
