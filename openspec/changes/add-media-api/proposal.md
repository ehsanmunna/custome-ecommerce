## Why

The platform has media database tables and planned OpenAPI media operations, but no runtime
behavior. Catalog and CMS content can reference media records that cannot yet be uploaded, listed,
delivered, or deleted, so administrators have no working media workflow.

## What Changes

- Implement the contract's administrative media operations: paginated listing, upload creation, and
  deletion, protected by the media permissions and store role scope.
- Create media uploads as presigned direct-to-R2 PUTs. `createMediaUpload` persists a pending media
  record, localized alt text, and a short-lived upload instruction (URL, method, headers, expiry).
- Add an additive `POST /admin/media/{mediaId}/complete` operation that verifies the uploaded object
  through R2, records authoritative size/MIME metadata plus supplied image dimensions, and returns
  the completed `MediaAsset`.
- Deliver assets from a configured public R2 custom-domain base URL and expose deterministic
  Cloudflare Image Resizing variants (`thumbnail`, `card`, `detail`, `large`) as additive optional
  media fields.
- Delete the database record first (cascading alt text and product links, nulling category, brand,
  and banner references) and best-effort delete the R2 object, without failing the request on
  storage cleanup errors.
- Seed the persisted `media_read` and `media_manage` permissions and grant them to owner/manager
  (and read access to staff), using the existing underscore permission-key convention.
- Add R2 configuration to the validated API environment, update `.env.example`, and document the
  upload flow and required Cloudflare settings.
- Amend the canonical OpenAPI contract additively and declare the implemented operations; regenerate
  and verify the API SDK.

## Capabilities

### New Capabilities

- `media-api`: Administrative media upload intents, direct-to-R2 completion, listing, public
  delivery and resized URL variants, and deletion with object cleanup.

### Modified Capabilities

- None.

## Impact

- Affected code: new NestJS media module, controller, service, R2 storage adapter, validation and
  error mapping; API configuration schema/service; database seed permission defaults and tests;
  contract-check implementation declaration; `packages/api-sdk` generated types.
- Affected API: three existing media operations become implemented, and the contract adds a
  completion operation plus optional upload-instruction and variant fields. Existing request shapes
  and permission declarations remain compatible.
- Affected dependencies: add the AWS S3 client and presigner packages used against the
  S3-compatible R2 endpoint.
- No database migration: media, alt-text, and association tables already exist. Only seed data
  changes.
- Depends on the existing auth guard, catalog media associations, and database constraints.

## Non-goals

- Storefront or public media read endpoints; storefronts receive URLs through catalog/content
  responses.
- Server-side resizing jobs, stored resized objects, image processing dependencies, or a queue.
- Editing an existing media record's alt text, metadata, or replacement uploads.
- SVG, video, document, or arbitrary non-image uploads, and antivirus scanning.
- R2 bucket provisioning, lifecycle rules for abandoned uploads, CDN cache configuration, or
  per-client onboarding automation.
- Changes to the catalog API's existing media association behavior.
