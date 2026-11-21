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
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AuthAccess } from '../auth/auth-access.decorator';
import { CatalogService } from './catalog.service';
import {
  parseCatalogInput,
  productAdminQuerySchema,
  productInputSchema,
} from './catalog.schemas';

@Controller('admin/products')
export class AdminProductController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Get()
  @AuthAccess({ access: 'admin', permission: 'catalog.products.read', scope: 'store' })
  products(@Query() query: Record<string, unknown>) {
    const input = parseCatalogInput(productAdminQuerySchema, query);
    return this.catalog.adminProducts({ ...input, locale: 'bn' });
  }

  @Get(':productId')
  @AuthAccess({ access: 'admin', permission: 'catalog.products.read', scope: 'store' })
  product(@Param('productId', ParseUUIDPipe) id: string) {
    return this.catalog.adminProduct(id);
  }

  @Post()
  @AuthAccess({ access: 'admin', permission: 'catalog.products.create', scope: 'store' })
  createProduct(@Body() body: unknown) {
    return this.catalog.createProduct(parseCatalogInput(productInputSchema, body));
  }

  @Patch(':productId')
  @AuthAccess({ access: 'admin', permission: 'catalog.products.update', scope: 'store' })
  updateProduct(@Param('productId', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.catalog.updateProduct(id, parseCatalogInput(productInputSchema, body));
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthAccess({ access: 'admin', permission: 'catalog.products.delete', scope: 'store' })
  async deleteProduct(@Param('productId', ParseUUIDPipe) id: string): Promise<void> {
    await this.catalog.deleteProduct(id);
  }
}

