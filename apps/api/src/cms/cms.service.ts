import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../platform/database/prisma.service';
import type { CmsPageQuery, CmsPageInput, CmsBannerQuery, CmsBannerInput } from './cms.schemas';

export interface CmsPageTranslationResponse {
  locale: string;
  slug: string;
  title: string;
  body?: string;
  metaTitle?: string;
  metaDescription?: string;
  status: string;
}

export interface CmsPageResponse {
  id: string;
  content: Record<string, CmsPageTranslationResponse>;
  createdAt: string;
  updatedAt: string;
}

export interface CmsPagePage {
  items: CmsPageResponse[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CmsBannerTranslationResponse {
  locale: string;
  title: string;
  body?: string;
  destinationUrl?: string;
}

export interface CmsBannerResponse {
  id: string;
  placementKey: string;
  sortOrder: number;
  isActive: boolean;
  mediaId?: string;
  content: Record<string, CmsBannerTranslationResponse>;
  createdAt: string;
  updatedAt: string;
}

export interface CmsBannerPage {
  items: CmsBannerResponse[];
  total: number;
  page: number;
  pageSize: number;
}

type TranslationEntry = { locale: string; [key: string]: unknown };

@Injectable()
export class CmsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPages(input: CmsPageQuery): Promise<CmsPagePage> {
    const [pages, total] = await Promise.all([
      this.prisma.cmsPage.findMany({
        orderBy: [{ updatedAt: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        include: { translations: true },
      }),
      this.prisma.cmsPage.count(),
    ]);

    return {
      items: pages.map((p) => this.toPageResponse(p as any)),
      total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }

  async createPage(input: CmsPageInput): Promise<CmsPageResponse> {
    const translations = Object.entries(input.content as unknown as Record<string, TranslationEntry>).map(
      ([locale, data]) => ({
        locale: locale as any,
        slug: data.slug as string,
        title: data.title as string,
        body: data.body as string | undefined,
        seoTitle: data.metaTitle as string | undefined,
        seoDescription: data.metaDescription as string | undefined,
        status: data.status as any,
      }),
    );

    const page = await this.prisma.cmsPage.create({
      data: {
        translations: {
          create: translations,
        },
      },
      include: { translations: true },
    });

    return this.toPageResponse(page as any);
  }

  async updatePage(pageId: string, input: CmsPageInput): Promise<CmsPageResponse> {
    const existing = await this.prisma.cmsPage.findUnique({
      where: { id: pageId },
      include: { translations: true },
    });
    if (!existing) {
      throw new NotFoundException(`CMS page "${pageId}" not found`);
    }

    await this.prisma.cmsPageTranslation.deleteMany({ where: { pageId } });

    const translations = Object.entries(input.content as unknown as Record<string, TranslationEntry>).map(
      ([locale, data]) => ({
        locale: locale as any,
        pageId,
        slug: data.slug as string,
        title: data.title as string,
        body: data.body as string | undefined,
        seoTitle: data.metaTitle as string | undefined,
        seoDescription: data.metaDescription as string | undefined,
        status: data.status as any,
      }),
    );

    const page = await this.prisma.cmsPage.update({
      where: { id: pageId },
      data: {
        translations: {
          create: translations,
        },
      },
      include: { translations: true },
    });

    return this.toPageResponse(page as any);
  }

  async deletePage(pageId: string): Promise<void> {
    const page = await this.prisma.cmsPage.findUnique({ where: { id: pageId } });
    if (!page) {
      throw new NotFoundException(`CMS page "${pageId}" not found`);
    }
    await this.prisma.cmsPage.delete({ where: { id: pageId } });
  }

  async listBanners(input: CmsBannerQuery): Promise<CmsBannerPage> {
    const [banners, total] = await Promise.all([
      this.prisma.cmsBanner.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        include: { translations: true },
      }),
      this.prisma.cmsBanner.count(),
    ]);

    return {
      items: banners.map((b) => this.toBannerResponse(b as any)),
      total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }

  async createBanner(input: CmsBannerInput): Promise<CmsBannerResponse> {
    const translations = Object.entries(input.content as unknown as Record<string, TranslationEntry>).map(
      ([locale, data]) => ({
        locale: locale as any,
        title: data.title as string,
        body: data.body as string | undefined,
        destinationUrl: data.destinationUrl as string | undefined,
      }),
    );

    const banner = await this.prisma.cmsBanner.create({
      data: {
        placementKey: input.placement,
        sortOrder: input.sortOrder,
        isActive: input.active,
        mediaAssetId: input.mediaId,
        translations: {
          create: translations,
        },
      },
      include: { translations: true },
    });

    return this.toBannerResponse(banner as any);
  }

  async updateBanner(bannerId: string, input: CmsBannerInput): Promise<CmsBannerResponse> {
    const existing = await this.prisma.cmsBanner.findUnique({
      where: { id: bannerId },
      include: { translations: true },
    });
    if (!existing) {
      throw new NotFoundException(`Banner "${bannerId}" not found`);
    }

    await this.prisma.cmsBannerTranslation.deleteMany({ where: { bannerId } });

    const translations = Object.entries(input.content as unknown as Record<string, TranslationEntry>).map(
      ([locale, data]) => ({
        locale: locale as any,
        bannerId,
        title: data.title as string,
        body: data.body as string | undefined,
        destinationUrl: data.destinationUrl as string | undefined,
      }),
    );

    const banner = await this.prisma.cmsBanner.update({
      where: { id: bannerId },
      data: {
        placementKey: input.placement,
        sortOrder: input.sortOrder,
        isActive: input.active,
        mediaAssetId: input.mediaId,
        translations: {
          create: translations,
        },
      },
      include: { translations: true },
    });

    return this.toBannerResponse(banner as any);
  }

  async deleteBanner(bannerId: string): Promise<void> {
    const banner = await this.prisma.cmsBanner.findUnique({ where: { id: bannerId } });
    if (!banner) {
      throw new NotFoundException(`Banner "${bannerId}" not found`);
    }
    await this.prisma.cmsBanner.delete({ where: { id: bannerId } });
  }

  private toPageResponse(page: any): CmsPageResponse {
    return {
      id: page.id,
      content: Object.fromEntries(
        page.translations.map((t: any) => [
          t.locale,
          {
            slug: t.slug,
            title: t.title,
            body: t.body ?? undefined,
            metaTitle: t.seoTitle ?? undefined,
            metaDescription: t.seoDescription ?? undefined,
            status: t.status,
          },
        ]),
      ),
      createdAt: page.createdAt.toISOString(),
      updatedAt: page.updatedAt.toISOString(),
    };
  }

  private toBannerResponse(banner: any): CmsBannerResponse {
    return {
      id: banner.id,
      placementKey: banner.placementKey,
      sortOrder: banner.sortOrder,
      isActive: banner.isActive,
      mediaId: banner.mediaAssetId ?? undefined,
      content: Object.fromEntries(
        banner.translations.map((t: any) => [
          t.locale,
          {
            title: t.title,
            body: t.body ?? undefined,
            destinationUrl: t.destinationUrl ?? undefined,
          },
        ]),
      ),
      createdAt: banner.createdAt.toISOString(),
      updatedAt: banner.updatedAt.toISOString(),
    };
  }
}
