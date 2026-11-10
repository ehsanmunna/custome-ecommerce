import { Module } from '@nestjs/common';
import { ImageStorageController } from './image-storage.controller';
import { ImageStorageService } from './image-storage.service';
import { LocalStorageAdapter } from './local-storage.adapter';
import { StorageAdapterOptions } from './storage.adapter';
import { storageAdapterOptions } from './image-storage.service';
import { PrismaService } from '../platform/database/prisma.service';

@Module({
  controllers: [ImageStorageController],
  providers: [
    ImageStorageService,
    PrismaService,
    {
      provide: 'STORAGE_ADAPTER',
      useFactory: (options: StorageAdapterOptions) => new LocalStorageAdapter(options),
      inject: ['STORAGE_ADAPTER_OPTIONS'],
    },
    {
      provide: 'STORAGE_ADAPTER_OPTIONS',
      useValue: storageAdapterOptions,
    },
  ],
  exports: [ImageStorageService],
})
export class ImageStorageModule {}
