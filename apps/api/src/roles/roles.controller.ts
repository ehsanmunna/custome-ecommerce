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
import { RolesService } from './roles.service';
import {
  paginationQuerySchema,
  parseRolesInput,
  roleInputSchema,
  roleUpdateInputSchema,
} from './roles.schemas';

@Controller('admin')
export class RolesController {
  constructor(@Inject(RolesService) private readonly roles: RolesService) {}

  @Get('roles')
  @AuthAccess({ access: 'admin', permission: 'admin.roles.read', scope: 'store' })
  listRoles(@Query() query: Record<string, unknown>) {
    const input = parseRolesInput(paginationQuerySchema, query);
    return this.roles.listRoles(input.page, input.pageSize);
  }

  @Post('roles')
  @AuthAccess({ access: 'admin', permission: 'admin.roles.create', scope: 'store' })
  createRole(@Body() body: unknown) {
    const input = parseRolesInput(roleInputSchema, body);
    return this.roles.createRole(input);
  }

  @Patch('roles/:roleId')
  @AuthAccess({ access: 'admin', permission: 'admin.roles.update', scope: 'store' })
  updateRole(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() body: unknown,
  ) {
    const input = parseRolesInput(roleUpdateInputSchema, body);
    return this.roles.updateRole(roleId, input);
  }

  @Delete('roles/:roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthAccess({ access: 'admin', permission: 'admin.roles.delete', scope: 'store' })
  async deleteRole(@Param('roleId', ParseUUIDPipe) roleId: string): Promise<void> {
    await this.roles.deleteRole(roleId);
  }

  @Get('permissions')
  @AuthAccess({ access: 'admin', permission: 'admin.roles.read', scope: 'store' })
  listPermissions(@Query() query: Record<string, unknown>) {
    const input = parseRolesInput(paginationQuerySchema, query);
    return this.roles.listPermissions(input.page, input.pageSize);
  }
}
