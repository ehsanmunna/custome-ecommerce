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
  Post,
  Query,
} from '@nestjs/common';
import { AuthAccess } from '../auth/auth-access.decorator';
import { MEDIA_PERMISSION_MAP } from './media.permissions';
import {
  parseMediaInput,
  mediaCompleteInputSchema,
  mediaPaginationQuerySchema,
  mediaUploadInputSchema,
} from './media.schemas';
import { MediaService } from './media.service';

@Controller('admin/media')
export class MediaController {
  constructor(@Inject(MediaService) private readonly media: MediaService) {}

  @Get()
  @AuthAccess({
    access: 'admin',
    permission: MEDIA_PERMISSION_MAP['media.read'],
    scope: 'store',
  })
  list(@Query() query: Record<string, unknown>) {
    return this.media.list(parseMediaInput(mediaPaginationQuerySchema, query));
  }

  @Post()
  @AuthAccess({
    access: 'admin',
    permission: MEDIA_PERMISSION_MAP['media.create'],
    scope: 'store',
  })
  create(@Body() body: unknown) {
    return this.media.createUpload(parseMediaInput(mediaUploadInputSchema, body));
  }

  @Post(':mediaId/complete')
  @HttpCode(HttpStatus.OK)
  @AuthAccess({
    access: 'admin',
    permission: MEDIA_PERMISSION_MAP['media.create'],
    scope: 'store',
  })
  complete(@Param('mediaId', ParseUUIDPipe) mediaId: string, @Body() body: unknown) {
    return this.media.completeUpload(mediaId, parseMediaInput(mediaCompleteInputSchema, body));
  }

  @Delete(':mediaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthAccess({
    access: 'admin',
    permission: MEDIA_PERMISSION_MAP['media.delete'],
    scope: 'store',
  })
  async remove(@Param('mediaId', ParseUUIDPipe) mediaId: string): Promise<void> {
    await this.media.delete(mediaId);
  }
}
