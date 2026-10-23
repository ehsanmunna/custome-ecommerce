import { Module } from '@nestjs/common';
import { SchemaCompatibilityService } from './schema-compatibility.service';

@Module({
  providers: [SchemaCompatibilityService],
  exports: [SchemaCompatibilityService],
})
export class SchemaModule {}
