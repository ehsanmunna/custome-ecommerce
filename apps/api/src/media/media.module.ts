import { Module } from '@nestjs/common';
import { AppConfigService } from '../platform/config/app-config.service';
import { MediaController } from './media.controller';
import { MEDIA_STORAGE } from './media-storage';
import { R2MediaStorage } from './media-storage.r2';
import { MediaService } from './media.service';

@Module({
  controllers: [MediaController],
  providers: [
    MediaService,
    {
      provide: MEDIA_STORAGE,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) =>
        new R2MediaStorage({
          accountId: config.r2AccountId,
          bucket: config.r2Bucket,
          accessKeyId: config.r2AccessKeyId,
          secretAccessKey: config.r2SecretAccessKey,
          publicBaseUrl: config.r2PublicBaseUrl,
          uploadTtlSeconds: config.r2UploadTtlSeconds,
          imageResizingEnabled: config.r2ImageResizingEnabled,
        }),
    },
  ],
})
export class MediaModule {}
