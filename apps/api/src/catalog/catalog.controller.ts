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
  attributeDefinitionInputSchema,
  brandInputSchema,
  categoryInputSchema,
  localeQuerySchema,
  localizedPaginationQuerySchema,
  paginationQuerySchema,
  parseCatalogInput,
  productAdminQuerySchema,
  productInputSchema,
  storefrontQuerySchema,
  variantInputSchema,
} from './catalog.schemas';

@Controller('storefront')
export class StorefrontCatalogController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Get('categories')
  @AuthAccess({ access: 'public' })
  categories(@Query() query: Record<string, unknown>) {
    return this.catalog.storefrontCategories(
      parseCatalogInput(localizedPaginationQuerySchema, query),
    );
  }

  @Get('categories/:slug/products')
  @AuthAccess({ access: 'public' })
  productsByCategory(@Param('slug') slug: string, @Query() query: Record<string, unknown>) {
    const input = parseCatalogInput(storefrontQuerySchema, query);
    return this.catalog.storefrontProductsByCategory(slug, input.locale, input);
  }

  @Get('products')
  @AuthAccess({ access: 'public' })
  products(@Query() query: Record<string, unknown>) {
    const input = parseCatalogInput(storefrontQuerySchema, query);
    return this.catalog.storefrontProducts(input);
  }

  @Get('products/:slug')
  @AuthAccess({ access: 'public' })
  product(@Param('slug') slug: string, @Query() query: Record<string, unknown>) {
    const { locale } = parseCatalogInput(localeQuerySchema, query);
    return this.catalog.storefrontProduct(slug, locale);
  }

  @Get('brands')
  @AuthAccess({ access: 'public' })
  brands(@Query() query: Record<string, unknown>) {
    return this.catalog.storefrontBrands(parseCatalogInput(localizedPaginationQuerySchema, query));
  }

  @Get('brands/:slug')
  @AuthAccess({ access: 'public' })
  brand(@Param('slug') slug: string, @Query() query: Record<string, unknown>) {
    const { locale } = parseCatalogInput(localeQuerySchema, query);
    return this.catalog.storefrontBrand(slug, locale);
  }
}

@Controller('admin')
export class AdminCatalogController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Get('brands')
  @AuthAccess({ access: 'admin', permission: 'catalog.brands.read', scope: 'store' })
  brands(@Query() query: Record<string, unknown>) {
    return this.catalog.adminBrands(parseCatalogInput(paginationQuerySchema, query));
  }

  @Post('brands')
  @AuthAccess({ access: 'admin', permission: 'catalog.brands.create', scope: 'store' })
  createBrand(@Body() body: unknown) {
    return this.catalog.createBrand(parseCatalogInput(brandInputSchema, body));
  }

  @Patch('brands/:brandId')
  @AuthAccess({ access: 'admin', permission: 'catalog.brands.update', scope: 'store' })
  updateBrand(@Param('brandId', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.catalog.updateBrand(id, parseCatalogInput(brandInputSchema, body));
  }

  @Delete('brands/:brandId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthAccess({ access: 'admin', permission: 'catalog.brands.delete', scope: 'store' })
  async deleteBrand(@Param('brandId', ParseUUIDPipe) id: string): Promise<void> {
    await this.catalog.deleteBrand(id);
  }

  @Get('categories')
  @AuthAccess({ access: 'admin', permission: 'catalog.categories.read', scope: 'store' })
  categories(@Query() query: Record<string, unknown>) {
    return this.catalog.adminCategories(parseCatalogInput(paginationQuerySchema, query));
  }

  @Post('categories')
  @AuthAccess({ access: 'admin', permission: 'catalog.categories.create', scope: 'store' })
  createCategory(@Body() body: unknown) {
    return this.catalog.createCategory(parseCatalogInput(categoryInputSchema, body));
  }

  @Patch('categories/:categoryId')
  @AuthAccess({ access: 'admin', permission: 'catalog.categories.update', scope: 'store' })
  updateCategory(@Param('categoryId', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.catalog.updateCategory(id, parseCatalogInput(categoryInputSchema, body));
  }

  @Delete('categories/:categoryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthAccess({ access: 'admin', permission: 'catalog.categories.delete', scope: 'store' })
  async deleteCategory(@Param('categoryId', ParseUUIDPipe) id: string): Promise<void> {
    await this.catalog.deleteCategory(id);
  }

  @Get('categories/:categoryId/attributes')
  @AuthAccess({ access: 'admin', permission: 'catalog.categories.read', scope: 'store' })
  categoryAttributes(
    @Param('categoryId', ParseUUIDPipe) id: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.catalog.categoryAttributes(id, parseCatalogInput(paginationQuerySchema, query));
  }

  @Post('categories/:categoryId/attributes')
  @AuthAccess({ access: 'admin', permission: 'catalog.categories.update', scope: 'store' })
  createCategoryAttribute(@Param('categoryId', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.catalog.createCategoryAttribute(
      id,
      parseCatalogInput(attributeDefinitionInputSchema, body),
    );
  }

  @Get('products')
  @AuthAccess({ access: 'admin', permission: 'catalog.products.read', scope: 'store' })
  products(@Query() query: Record<string, unknown>) {
    const input = parseCatalogInput(productAdminQuerySchema, query);
    return this.catalog.adminProducts({ ...input, locale: 'bn' });
  }

  @Post('products')
  @AuthAccess({ access: 'admin', permission: 'catalog.products.create', scope: 'store' })
  createProduct(@Body() body: unknown) {
    return this.catalog.createProduct(parseCatalogInput(productInputSchema, body));
  }

  @Get('products/:productId')
  @AuthAccess({ access: 'admin', permission: 'catalog.products.read', scope: 'store' })
  product(@Param('productId', ParseUUIDPipe) id: string) {
    return this.catalog.adminProduct(id);
  }

  @Patch('products/:productId')
  @AuthAccess({ access: 'admin', permission: 'catalog.products.update', scope: 'store' })
  updateProduct(@Param('productId', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.catalog.updateProduct(id, parseCatalogInput(productInputSchema, body));
  }

  @Delete('products/:productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthAccess({ access: 'admin', permission: 'catalog.products.delete', scope: 'store' })
  async deleteProduct(@Param('productId', ParseUUIDPipe) id: string): Promise<void> {
    await this.catalog.deleteProduct(id);
  }

  @Post('products/:productId/variants')
  @AuthAccess({ access: 'admin', permission: 'catalog.products.update', scope: 'store' })
  createVariant(@Param('productId', ParseUUIDPipe) productId: string, @Body() body: unknown) {
    return this.catalog.createVariant(productId, parseCatalogInput(variantInputSchema, body));
  }

  @Patch('variants/:variantId')
  @AuthAccess({ access: 'admin', permission: 'catalog.products.update', scope: 'store' })
  updateVariant(@Param('variantId', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.catalog.updateVariant(id, parseCatalogInput(variantInputSchema, body));
  }

  @Delete('variants/:variantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthAccess({ access: 'admin', permission: 'catalog.products.update', scope: 'store' })
  async deleteVariant(@Param('variantId', ParseUUIDPipe) id: string): Promise<void> {
    await this.catalog.deleteVariant(id);
  }
}
