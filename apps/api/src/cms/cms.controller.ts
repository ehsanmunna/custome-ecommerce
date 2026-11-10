import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AuthAccess } from '../auth/auth-access.decorator';
import { CmsService } from './cms.service';
import {
  parseCmsInput,
  cmsPageQuerySchema,
  cmsBannerQuerySchema,
  cmsPageInputSchema,
  cmsBannerInputSchema,
} from './cms.schemas';

@Controller('admin/pages')
export class PagesController {
  constructor(@Inject(CmsService) private readonly pages: CmsService) {}

  @Get()
  @AuthAccess({
    access: 'admin',
    permission: 'cms.pages.read',
    scope: 'store',
  })
  list(@Query() query: Record<string, unknown>) {
    return this.pages.listPages(parseCmsInput(cmsPageQuerySchema, query));
  }

  @Post()
  @AuthAccess({
    access: 'admin',
    permission: 'cms.pages.create',
    scope: 'store',
  })
  create(@Body() body: unknown) {
    return this.pages.createPage(parseCmsInput(cmsPageInputSchema, body));
  }

  @Patch(':pageId')
  @AuthAccess({
    access: 'admin',
    permission: 'cms.pages.update',
    scope: 'store',
  })
  update(@Param('pageId', ParseUUIDPipe) pageId: string, @Body() body: unknown) {
    return this.pages.updatePage(pageId, parseCmsInput(cmsPageInputSchema, body));
  }

  @Delete(':pageId')
  @AuthAccess({
    access: 'admin',
    permission: 'cms.pages.delete',
    scope: 'store',
  })
  delete(@Param('pageId', ParseUUIDPipe) pageId: string) {
    return this.pages.deletePage(pageId);
  }
}

@Controller('admin/banners')
export class BannersController {
  constructor(@Inject(CmsService) private readonly banners: CmsService) {}

  @Get()
  @AuthAccess({
    access: 'admin',
    permission: 'cms.banners.read',
    scope: 'store',
  })
  list(@Query() query: Record<string, unknown>) {
    return this.banners.listBanners(parseCmsInput(cmsBannerQuerySchema, query));
  }

  @Post()
  @AuthAccess({
    access: 'admin',
    permission: 'cms.banners.create',
    scope: 'store',
  })
  create(@Body() body: unknown) {
    return this.banners.createBanner(parseCmsInput(cmsBannerInputSchema, body));
  }

  @Patch(':bannerId')
  @AuthAccess({
    access: 'admin',
    permission: 'cms.banners.update',
    scope: 'store',
  })
  update(@Param('bannerId', ParseUUIDPipe) bannerId: string, @Body() body: unknown) {
    return this.banners.updateBanner(bannerId, parseCmsInput(cmsBannerInputSchema, body));
  }

  @Delete(':bannerId')
  @AuthAccess({
    access: 'admin',
    permission: 'cms.banners.delete',
    scope: 'store',
  })
  delete(@Param('bannerId', ParseUUIDPipe) bannerId: string) {
    return this.banners.deleteBanner(bannerId);
  }
}
