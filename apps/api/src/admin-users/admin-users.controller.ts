import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AuthAccess } from '../auth/auth-access.decorator';
import { AdminUsersService } from './admin-users.service';
import {
  adminUserCreateSchema,
  adminUserUpdateSchema,
  adminUserIdParamSchema,
  adminUsersQuerySchema,
  parseAdminUserInput,
} from './admin-users.schemas';

@Controller('admin')
export class AdminUsersController {
  constructor(@Inject(AdminUsersService) private readonly adminUsers: AdminUsersService) {}

  @Get('users')
  @AuthAccess({ access: 'admin', permission: 'admin.users.read', scope: 'store' })
  list(@Query() query: Record<string, unknown>) {
    const input = parseAdminUserInput(adminUsersQuerySchema, query);
    return this.adminUsers.listAdminUsers(input.page, input.pageSize);
  }

  @Get('users/:userId')
  @AuthAccess({ access: 'admin', permission: 'admin.users.read', scope: 'store' })
  get(
    @Param('userId', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND })) userId: string,
  ) {
    return this.adminUsers.getAdminUser(userId);
  }

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  @AuthAccess({ access: 'admin', permission: 'admin.users.create', scope: 'store' })
  create(@Body() body: unknown) {
    const input = parseAdminUserInput(adminUserCreateSchema, body);
    return this.adminUsers.createAdminUser(input);
  }

  @Patch('users/:userId')
  @AuthAccess({ access: 'admin', permission: 'admin.users.update', scope: 'store' })
  update(
    @Param('userId', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND })) userId: string,
    @Body() body: unknown,
  ) {
    const input = parseAdminUserInput(adminUserUpdateSchema, body);
    return this.adminUsers.updateAdminUser(userId, input);
  }

  @Post('users/:userId/disable')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthAccess({ access: 'admin', permission: 'admin.users.disable', scope: 'store' })
  async disable(
    @Param('userId', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND })) userId: string,
  ): Promise<void> {
    await this.adminUsers.disableAdminUser(userId);
  }
}
