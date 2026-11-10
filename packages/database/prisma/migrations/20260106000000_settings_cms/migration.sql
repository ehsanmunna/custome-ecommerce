-- Store configuration, external provider-secret references, and localized CMS content.

-- CreateEnum
CREATE TYPE "CmsPublicationStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateTable
CREATE TABLE "store_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "store_settings_key_nonempty" CHECK (btrim("key") <> ''),
    CONSTRAINT "store_settings_value_object" CHECK (jsonb_typeof("value") = 'object')
);

-- CreateTable
CREATE TABLE "provider_secret_references" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" TEXT NOT NULL,
    "credential_name" TEXT NOT NULL,
    "secret_reference" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_secret_references_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "provider_secret_references_provider_nonempty" CHECK (btrim("provider") <> ''),
    CONSTRAINT "provider_secret_references_credential_name_nonempty" CHECK (btrim("credential_name") <> ''),
    CONSTRAINT "provider_secret_references_reference_nonempty" CHECK (btrim("secret_reference") <> '')
);

-- CreateTable
CREATE TABLE "cms_pages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cms_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_page_translations" (
    "page_id" UUID NOT NULL,
    "locale" "ContentLocale" NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL DEFAULT '{}',
    "seo_title" TEXT,
    "seo_description" TEXT,
    "status" "CmsPublicationStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cms_page_translations_pkey" PRIMARY KEY ("page_id", "locale"),
    CONSTRAINT "cms_page_translations_slug_nonempty" CHECK (btrim("slug") <> ''),
    CONSTRAINT "cms_page_translations_title_nonempty" CHECK (btrim("title") <> ''),
    CONSTRAINT "cms_page_translations_content_object" CHECK (jsonb_typeof("content") = 'object')
);

-- CreateTable
CREATE TABLE "cms_banners" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "placement_key" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "media_asset_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cms_banners_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cms_banners_placement_key_nonempty" CHECK (btrim("placement_key") <> '')
);

-- CreateTable
CREATE TABLE "cms_banner_translations" (
    "banner_id" UUID NOT NULL,
    "locale" "ContentLocale" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "destination_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cms_banner_translations_pkey" PRIMARY KEY ("banner_id", "locale"),
    CONSTRAINT "cms_banner_translations_title_nonempty" CHECK (btrim("title") <> '')
);

-- CreateIndex
CREATE UNIQUE INDEX "store_settings_key_key" ON "store_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "provider_secret_references_provider_credential_name_key"
ON "provider_secret_references"("provider", "credential_name");

-- CreateIndex
CREATE UNIQUE INDEX "cms_page_translations_locale_slug_key"
ON "cms_page_translations"("locale", "slug");

-- CreateIndex
CREATE INDEX "cms_page_translations_status_idx" ON "cms_page_translations"("status");

-- CreateIndex
CREATE INDEX "cms_banners_placement_key_is_active_sort_order_idx"
ON "cms_banners"("placement_key", "is_active", "sort_order");

-- CreateIndex
CREATE INDEX "cms_banners_media_asset_id_idx" ON "cms_banners"("media_asset_id");

-- AddForeignKey
ALTER TABLE "cms_page_translations"
ADD CONSTRAINT "cms_page_translations_page_id_fkey"
FOREIGN KEY ("page_id") REFERENCES "cms_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_banners"
ADD CONSTRAINT "cms_banners_media_asset_id_fkey"
FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_banner_translations"
ADD CONSTRAINT "cms_banner_translations_banner_id_fkey"
FOREIGN KEY ("banner_id") REFERENCES "cms_banners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
