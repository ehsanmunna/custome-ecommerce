import {
  Controller,
  Get,
  Inject,
  Param,
  Query,
} from '@nestjs/common';
import { AuthAccess } from '../auth/auth-access.decorator';
import { CatalogService } from './catalog.service';
import {
  localeQuerySchema,
  parseCatalogInput,
  storefrontQuerySchema,
} from './catalog.schemas';

@Controller('storefront/products')
export class StorefrontProductController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Get()
  @AuthAccess({ access: 'public' })
  products(@Query() query: Record<string, unknown>) {
    const input = parseCatalogInput(storefrontQuerySchema, query);
    return this.catalog.storefrontProducts(input);
  }

  @Get(':slug')
  @AuthAccess({ access: 'public' })
  product(@Param('slug') slug: string, @Query() query: Record<string, unknown>) {
    const { locale } = parseCatalogInput(localeQuerySchema, query);
    return this.catalog.storefrontProduct(slug, locale);
  }
}
