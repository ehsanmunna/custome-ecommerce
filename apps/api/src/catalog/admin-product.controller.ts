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
import { Roles } from '../auth/roles.decorator';
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
  @Roles('owner', 'manager')
  products(@Query() query: Record<string, unknown>) {
    const input = parseCatalogInput(productAdminQuerySchema, query);
    return this.catalog.adminProducts({ ...input, locale: 'bn' });
  }

  @Get(':productId')
  @AuthAccess({ access: 'admin', permission: 'catalog.products.read', scope: 'store' })
  @Roles('owner', 'manager')
  product(@Param('productId', ParseUUIDPipe) id: string) {
    return this.catalog.adminProduct(id);
  }

  @Post()
  @AuthAccess({ access: 'admin', permission: 'catalog.products.create', scope: 'store' })
  @Roles('owner', 'manager', 'staff')
  createProduct(@Body() body: unknown) {
    return this.catalog.createProduct(parseCatalogInput(productInputSchema, body));
  }

  @Patch(':productId')
  @AuthAccess({ access: 'admin', permission: 'catalog.products.update', scope: 'store' })
  @Roles('owner', 'manager')
  updateProduct(@Param('productId', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.catalog.updateProduct(id, parseCatalogInput(productInputSchema, body));
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthAccess({ access: 'admin', permission: 'catalog.products.delete', scope: 'store' })
  @Roles('owner')
  async deleteProduct(@Param('productId', ParseUUIDPipe) id: string): Promise<void> {
    await this.catalog.deleteProduct(id);
  }
}
