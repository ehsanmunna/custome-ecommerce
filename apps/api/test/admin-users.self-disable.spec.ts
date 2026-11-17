import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AdminUsersService } from '../src/admin-users/admin-users.service';
import type { PasswordHashService } from '../src/auth/password-hash.service';
import type { PrismaService } from '../src/platform/database/prisma.service';

const actorId = 'a65a44f6-0ed0-40b2-aea4-84a7e716862f';
const otherId = 'b75a44f6-0ed0-40b2-aea4-84a7e716862f';

function userRecord(id: string, status: 'active' | 'disabled' = 'active') {
  return {
    id,
    email: 'admin@example.com',
    displayName: 'Administrator',
    passwordHash: 'hash',
    roleId: 'role-1',
    status,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-01T00:00:00.000Z'),
    role: {
      id: 'role-1',
      key: 'staff',
      name: 'Staff',
      description: null,
      permissions: [{ permission: { key: 'orders.read' } }],
    },
  };
}

function createHarness() {
  let current = userRecord(otherId);
  const prisma = {
    adminUser: {
      findUnique: vi.fn(async () => current),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        current = { ...current, ...data };
        return current;
      }),
    },
  };
  const passwords = { hash: vi.fn() } as unknown as PasswordHashService;
  return {
    prisma,
    service: new AdminUsersService(prisma as unknown as PrismaService, passwords),
  };
}

describe('administrator self-disable protection', () => {
  it('rejects disabling the authenticated administrator', async () => {
    const { prisma, service } = createHarness();

    await expect(service.disableAdminUser(actorId, actorId)).rejects.toThrow(
      new ConflictException('Cannot disable your own account'),
    );
    expect(prisma.adminUser.findUnique).not.toHaveBeenCalled();
    expect(prisma.adminUser.update).not.toHaveBeenCalled();
  });

  it('disables another administrator', async () => {
    const { prisma, service } = createHarness();

    await service.disableAdminUser(otherId, actorId);

    expect(prisma.adminUser.update).toHaveBeenCalledWith({
      where: { id: otherId },
      data: { status: 'disabled' },
    });
  });

  it('rejects disabling the authenticated administrator through an update', async () => {
    const { prisma, service } = createHarness();

    await expect(
      service.updateAdminUser(actorId, { status: 'disabled' }, actorId),
    ).rejects.toThrow(new ConflictException('Cannot disable your own account'));
    expect(prisma.adminUser.update).not.toHaveBeenCalled();
  });

  it('allows an update that disables another administrator', async () => {
    const { prisma, service } = createHarness();

    const result = await service.updateAdminUser(otherId, { status: 'disabled' }, actorId);

    expect(result.status).toBe('disabled');
    expect(prisma.adminUser.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'disabled' } }),
    );
  });
});
