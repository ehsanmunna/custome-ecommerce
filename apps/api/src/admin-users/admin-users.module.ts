import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { PasswordHashService } from '../auth/password-hash.service';

@Module({
  controllers: [AdminUsersController],
  providers: [AdminUsersService, PasswordHashService],
  exports: [AdminUsersService],
})
export class AdminUsersModule {}
