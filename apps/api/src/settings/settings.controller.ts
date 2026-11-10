import {
  Body,
  Controller,
  Get,
  Inject,
  Patch,
  Query,
} from '@nestjs/common';
import { AuthAccess } from '../auth/auth-access.decorator';
import {
  parseSettingsInput,
  settingsQuerySchema,
  settingsUpdateSchema,
} from './settings.schemas';
import { SettingsService } from './settings.service';

@Controller('admin/settings')
export class SettingsController {
  constructor(@Inject(SettingsService) private readonly settings: SettingsService) {}

  @Get()
  @AuthAccess({
    access: 'admin',
    permission: 'settings.read',
    scope: 'store',
  })
  list(@Query() query: Record<string, unknown>) {
    return this.settings.listSettings(parseSettingsInput(settingsQuerySchema, query));
  }

  @Patch()
  @AuthAccess({
    access: 'admin',
    permission: 'settings.update',
    scope: 'store',
  })
  update(@Body() body: unknown) {
    return this.settings.updateSettings(parseSettingsInput(settingsUpdateSchema, body));
  }
}
