import { Module } from '@nestjs/common';
import { PagesController } from './cms.controller';
import { BannersController } from './cms.controller';
import { CmsService } from './cms.service';

@Module({
  controllers: [PagesController, BannersController],
  providers: [CmsService],
})
export class CmsModule {}
