import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthAccess } from '../auth/auth-access.decorator';
import {
  parseImageStorageInput,
  imageStorageUploadSchema,
  mediaListQuerySchema,
  parseMediaInput,
} from './image-storage.schemas';
import { ImageStorageService, MediaPage } from './image-storage.service';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer?: Buffer;
  stream: NodeJS.ReadableStream;
}

interface ImageStorageResponse {
  type(type: string): ImageStorageResponse;
  set(field: string, value: string): ImageStorageResponse;
}

@Controller('image-storage')
export class ImageStorageController {
  constructor(@Inject(ImageStorageService) private readonly storage: ImageStorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @AuthAccess({
    access: 'admin',
    permission: 'media.create',
    scope: 'store',
  })
  async upload(
    @UploadedFile() file: MulterFile,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const input = parseImageStorageInput(imageStorageUploadSchema, {
      feature: req.body?.feature,
      alt: req.body?.alt ? JSON.parse(req.body.alt) : undefined,
    });

    return this.storage.upload(input.feature, file, input.alt);
  }

  @Get('serve')
  @AuthAccess({
    access: 'admin',
    permission: 'image-storage.read',
    scope: 'store',
  })
  async serve(
    @Query('storageKey') storageKey: string,
    @Res() res: ImageStorageResponse,
  ): Promise<void> {
    const result = await this.storage.serve(storageKey);
    res.type(result.mimeType);
    res.set('Content-Length', String(result.size));
    result.stream.pipe(res as unknown as NodeJS.WritableStream);
  }

  @Get('list')
  @AuthAccess({
    access: 'admin',
    permission: 'image-storage.read',
    scope: 'store',
  })
  async list(@Query() query: Record<string, unknown>): Promise<MediaPage> {
    return this.storage.list(parseMediaInput(mediaListQuerySchema, query));
  }
}
