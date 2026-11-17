import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/platform/database/prisma.service';
import { RolesService } from '../src/roles/roles.service';

function roleRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'role-1',
    key: 'owner',
    name: 'Owner',
    description: null,
    scope: 'store',
    isSystem: true,
    sortOrder: 0,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-01T00:00:00.000Z'),
    users: [],
    permissions: [{ permission: { key: 'admin.auth.read' } }],
    ...overrides,
  };
}

function createHarness(record: Record<string, unknown> = roleRecord()) {
  const prisma = {
    adminRole: {
      findUnique: vi.fn(async () => record),
      update: vi.fn(async () => record),
      delete: vi.fn(async () => record),
    },
    adminPermission: {
      findMany: vi.fn(async () => [{ id: 'permission-1', key: 'admin.roles.read' }]),
    },
  };
  return { prisma, service: new RolesService(prisma as unknown as PrismaService) };
}

describe('RolesService system role protection', () => {
  it('rejects a system role key change', async () => {
    const { prisma, service } = createHarness();

    await expect(service.updateRole('role-1', { key: 'owner_renamed' })).rejects.toThrow(
      new ConflictException('Cannot change key of a system role'),
    );
    expect(prisma.adminRole.update).not.toHaveBeenCalled();
  });

  it('rejects a system role name change', async () => {
    const { prisma, service } = createHarness();

    await expect(service.updateRole('role-1', { name: 'Renamed owner' })).rejects.toThrow(
      new ConflictException('Cannot change name of a system role'),
    );
    expect(prisma.adminRole.update).not.toHaveBeenCalled();
  });

  it('rejects deleting a system role', async () => {
    const { prisma, service } = createHarness();

    await expect(service.deleteRole('role-1')).rejects.toThrow(
      new ConflictException('Cannot delete a system role'),
    );
    expect(prisma.adminRole.delete).not.toHaveBeenCalled();
  });

  it('allows updating the grants of a system role', async () => {
    const updated = roleRecord({
      permissions: [{ permission: { key: 'admin.roles.read' } }],
    });
    const { prisma, service } = createHarness();
    prisma.adminRole.update.mockResolvedValue(updated);

    const result = await service.updateRole('role-1', { permissionKeys: ['admin.roles.read'] });

    expect(result.permissions).toEqual(['admin.roles.read']);
    expect(prisma.adminPermission.findMany).toHaveBeenCalledWith({
      where: { key: { in: ['admin.roles.read'] } },
    });
    expect(prisma.adminRole.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'role-1' },
        data: expect.objectContaining({
          permissions: {
            deleteMany: {},
            create: [{ permission: { connect: { key: 'admin.roles.read' } } }],
          },
        }),
      }),
    );
  });

  it('still allows renaming a custom role', async () => {
    const custom = roleRecord({ key: 'auditor', name: 'Auditor', isSystem: false });
    const { prisma, service } = createHarness(custom);
    prisma.adminRole.update.mockResolvedValue({ ...custom, name: 'Senior auditor' });

    const result = await service.updateRole('role-1', { name: 'Senior auditor' });

    expect(result.name).toBe('Senior auditor');
  });
});
