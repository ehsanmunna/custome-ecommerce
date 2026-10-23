import { Module } from '@nestjs/common';
import { SchemaModule } from '../schema/schema.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [SchemaModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
