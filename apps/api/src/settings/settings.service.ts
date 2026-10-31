import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'database';
import { PrismaService } from '../platform/database/prisma.service';
import type { SettingsQuery, SettingsUpdate } from './settings.schemas';

export interface SettingResponse {
  key: string;
  value: Prisma.InputJsonObject;
  updatedAt: string;
}

export interface SettingsPage {
  items: SettingResponse[];
  total: number;
  page: number;
  pageSize: number;
}

const ALLOWED_SETTING_KEYS = ['tax', 'payments', 'courier', 'notifications'];

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async listSettings(input: SettingsQuery): Promise<SettingsPage> {
    const [rows, total] = await Promise.all([
      this.prisma.storeSetting.findMany({
        orderBy: [{ key: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.storeSetting.count(),
    ]);

    return {
      items: rows.map((row) => ({
        key: row.key,
        value: row.value as Prisma.InputJsonObject,
        updatedAt: row.updatedAt.toISOString(),
      })),
      total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }

  async updateSettings(input: SettingsUpdate): Promise<SettingResponse[]> {
    const results: SettingResponse[] = [];

    for (const setting of input.settings) {
      if (!ALLOWED_SETTING_KEYS.includes(setting.key)) {
        throw new BadRequestException(`Setting key "${setting.key}" is not updatable`);
      }

      const existing = await this.prisma.storeSetting.findUnique({ where: { key: setting.key } });
      if (!existing) {
        throw new NotFoundException(`Setting "${setting.key}" not found`);
      }

      const updated = await this.prisma.storeSetting.update({
        where: { key: setting.key },
        data: { value: setting.value as Prisma.InputJsonObject },
      });

      results.push({
        key: updated.key,
        value: updated.value as Prisma.InputJsonObject,
        updatedAt: updated.updatedAt.toISOString(),
      });
    }

    return results;
  }
}
