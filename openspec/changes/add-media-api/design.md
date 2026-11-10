## Context

See `proposal.md` for motivation and `specs/media-api/spec.md` for externally visible behavior.

The API is NestJS with Prisma and PostgreSQL, versioned at `/v1`. The catalog schema already has
`media_assets`, `media_alt_texts`, and `product_media`; category, brand, and CMS banner references
already use `ON DELETE SET NULL` or `ON DELETE CASCADE`. `size_bytes` is `BIGINT`, so responses must
convert it explicitly instead of serializing a Prisma `BigInt`.

The canonical OpenAPI document already declares `listMedia`, `createMediaUpload`, and `deleteMedia`,
with `MediaAsset`, `MediaUploadRequest`, and `MediaPage`. Those operations are not implemented or
listed in `x-implemented-operations`. The auth guard resolves permissions from current role grants
and requires store scope for store operations. Baseline permissions are stored with underscore keys
because the database check constraint rejects dots, while the contract uses dotted permission
identifiers. `contract:check` treats changing an operation's `x-required-permission` as breaking.

No R2/S3 dependency or storage adapter exists yet. `apps/api` follows module/controller/service
structure, validates environment variables with Zod, and maps HTTP errors through the shared RFC
9457 problem filter. CI runs unit tests, HTTP integration tests, contract checks, OpenAPI linting,
and SDK generation checks.

## Goals / Non-Goals

**Goals:**

- Make the three declared media operations usable and add the minimum contract surface required for
  direct uploads and resizing variants.
- Keep metadata persistence, authorization, and error mapping in the media module; isolate all
  provider-specific R2 behavior behind an adapter.
- Keep tests deterministic and offline by replacing the storage adapter in unit and HTTP tests.
- Preserve the v1 contract: only add optional response fields and new operations.

**Non-Goals:**

- Server-side image processing, stored resized objects, queues, or workers.
- Public/storefront media endpoints, metadata editing, replacement uploads, or multipart proxying.
- Database schema changes, R2 bucket provisioning, CDN cache purging, or abandoned-upload lifecycle
  automation.
- Re-working catalog permission identifiers or the existing auth guard contract.

## Decisions

### 1. Presigned direct PUT plus an explicit completion operation

`createMediaUpload` persists a pending media record and returns a short-lived presigned PUT
instruction. The client uploads bytes directly to R2, then calls
`POST /admin/media/{mediaId}/complete`. Completion calls R2 `HeadObject` and uses the object's
actual byte size and content type as authoritative metadata.

**Why:** the API never buffers or proxies binaries, which keeps memory and bandwidth bounded and
matches the plan's presigned-upload requirement. Completion gives a verifiable point for dimensions
and prevents client-claimed size/type from being trusted.

**Alternatives:** API-proxied multipart uploads (would change the JSON contract and put large bodies
through the API); trusting client metadata (cannot detect abandoned or mismatched uploads).

### 2. Add optional upload instructions and variants to the existing media schema

Keep the `201` response as `MediaAsset` and add an optional `upload` object containing `url`,
`method`, `headers`, and `expiresAt`. Add an optional `variants` map (`thumbnail`, `card`, `detail`,
`large`), each with `url` and `width`. Add the completion operation and its request schema. All
changes are additive and keep existing request shapes and permission declarations unchanged.

**Why:** a wrapper response or reusing `url` as the upload URL would be a breaking or ambiguous wire
change. Optional fields are compatible with the contract checker and generated SDK.

**Alternatives:** a new `MediaUploadResponse` wrapper (breaks the declared 201 type); putting the
presigned URL in `MediaAsset.url` (overloads the documented delivery URL and omits headers).

### 3. Isolate R2 behind a storage adapter

Define a small `MediaStorage` abstraction for presigning a PUT, heading an object, deleting an
object, and building public/variant URLs. Implement it with the S3-compatible R2 endpoint
(`https://<account>.r2.cloudflarestorage.com`, region `auto`). Register it in a `MediaModule`; tests
substitute an in-memory fake.

**Why:** the project requires storage providers behind adapters. It also keeps S3 SDK details,
endpoint configuration, and error translation out of media business logic, and avoids network calls
in CI.

**Alternatives:** direct SDK calls in `MediaService` (harder to test and to replace); a generic
cloud-storage library (unnecessary abstraction for one provider).

### 4. Generate storage keys server-side and validate upload requests

Derive keys as `media/{yyyy}/{mm}/{uuid}.{ext}`, where the extension comes from an allowed raster
image MIME type. Ignore the supplied file name for path construction; use it only for display and
validation. Reject unsupported types, non-positive sizes, and sizes above
`R2_MAX_UPLOAD_BYTES`. Persist alt text rows for supplied `bn`/`en` values.

**Why:** untrusted names cannot influence object paths, which prevents path traversal and
collisions. A server-generated key also lets the presigned URL be created before the database insert.

**Alternatives:** user-supplied keys (collision and traversal risk); content-addressed keys (require
hashing bytes the API never receives during direct upload).

### 5. Verify metadata at completion; accept dimensions from the client

On completion, reject when `HeadObject` reports no object (409 conflict). Use the stored object's
size and content type as authoritative, rejecting unsupported types or sizes over the configured
limit. Accept optional `width`/`height` only as a positive pair and persist them. Return the mapped
asset idempotently, without creating duplicate alt text or records.

**Why:** R2 `HeadObject` does not report image dimensions, and downloading objects to parse them
would add processing and bandwidth. Dimensions are non-security-critical metadata; the object's
existence, size, and type are verified.

**Alternatives:** require dimensions at upload intent (metadata would be unverified and incomplete
for existing clients); server-side image parsing (adds a dependency and a second network read).

### 6. Map contract media permissions to the persisted permission catalog

Keep the contract's `media.read`, `media.create`, and `media.delete` declarations unchanged because
changing `x-required-permission` is a breaking contract change. Enforce the persisted keys
`media_read` (list) and `media_manage` (create, complete, delete) in the controller, and add both
keys to the baseline seed with owner/manager grants plus staff read access.

**Why:** the database check constraint only permits lowercase underscore identifiers, and the seed
already uses that convention. A local mapping avoids changing shared auth behavior or the contract.

**Alternatives:** relax the permission-key constraint and store dotted keys (a schema/auth change
with wider impact); reuse `catalog_read`/`catalog_manage` (loses the media-specific boundary and
contradicts the contract's intent).

**Known inconsistency:** catalog controllers currently require dotted keys that baseline seeding
does not create. This change does not rename or remap catalog permissions; it only ensures the media
capability does not inherit the same problem.

### 7. Build public URLs and variants deterministically

Normalize `R2_PUBLIC_BASE_URL` and append the storage key for `url`. When resizing is enabled,
build `${base}/cdn-cgi/image/width={width},format=auto/{key}` for widths 160, 480, 960, and 1600.
Omit variants when resizing is disabled or the asset is not an image.

**Why:** stable unsigned URLs are cacheable and require no per-request signing. Cloudflare Image
Resizing provides variants without storing derived objects or adding image-processing code.

**Alternatives:** signed GET URLs (expiry and regeneration complexity); pre-generated stored
variants (needs a job, new objects, and cleanup).

### 8. Treat storage configuration as an optional group

Add `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_PUBLIC_BASE_URL`, `R2_UPLOAD_TTL_SECONDS`, `R2_MAX_UPLOAD_BYTES`, and
`R2_IMAGE_RESIZING_ENABLED` to the validated environment. If required R2 values are missing or
invalid, the API still starts and media operations return 503; non-media operations are unaffected.
Never log credentials or presigned URLs.

**Why:** developers and existing deployments can run the API without R2 credentials, matching the
existing OTP-adapter behavior. Production configuration is supplied through the client's secret
manager.

**Alternatives:** fail startup without R2 (blocks unrelated development and deployments); silently
disable media (hides misconfiguration).

### 9. Delete metadata first, then attempt object cleanup

Delete the `media_assets` row and rely on existing foreign keys for alt text, product links,
category/brand image nulling, and banner nulling. After the database deletion, attempt the R2 delete
and log a structured failure if it fails; do not fail the request or recreate the record.

**Why:** metadata is authoritative, and a failed object delete leaves an unreferenced object rather
than a dangling database reference. The contract describes scheduling cleanup, but no queue exists
and adding one is out of scope.

**Alternatives:** delete the object first (a failed database delete would leave broken URLs); queue
cleanup (new infrastructure outside v1 constraints).

### 10. Map explicitly and serialize size safely

Map Prisma records to contract fields instead of returning them directly. Convert `size_bytes` to a
JavaScript number only after enforcing the configured maximum (well below
`Number.MAX_SAFE_INTEGER`), and serialize absent dimensions as omitted fields. Order listings by
`createdAt` descending then `id` descending.

**Why:** explicit mapping prevents internal columns and `BigInt` from leaking into JSON, and a
deterministic tie-breaker keeps pagination stable.

**Alternatives:** rely on a global `BigInt` JSON patch (hides the issue and changes every payload).

### 11. Test with a fake adapter and validate the contract

Unit-test key generation, validation, mapping, variant URLs, permission enforcement, completion
idempotency, and delete behavior. HTTP integration tests register an in-memory storage adapter.
Unit-test the R2 adapter with a mocked S3 client rather than contacting R2. After implementation,
add the operations to `x-implemented-operations`, run OpenAPI lint/contract compatibility/tests, and
regenerate the SDK.

**Why:** R2 is an external account-specific dependency; CI must stay deterministic and offline.

## Risks / Trade-offs

- **Presigned PUT cannot enforce the byte limit** → Validate at intent creation, re-check
  `HeadObject` at completion, reject oversize objects, and recommend an R2 lifecycle rule for
  abandoned objects in deployment docs.
- **Abandoned upload intents leave pending database rows and possibly objects** → Listing shows all
  records, deletion removes both record and object, and operators can add a lifecycle rule or future
  cleanup job. A pending asset should not be referenced until completed by the admin UI.
- **Client-supplied dimensions are unverified** → Validate positivity and pairing; treat dimensions
  as descriptive metadata. Server-side parsing can be added later without a contract change.
- **Public bucket URLs cannot be invalidated per client** → Use the client's custom domain and keep
  keys non-guessable (UUIDs); do not store sensitive content in media. CDN cache purging is a
  deployment concern.
- **Completion and deletion can race** → Completion updates by primary key and returns not found if
  the record was deleted; repeat completion is idempotent.
- **Permission identifiers differ between contract and stored catalog** → Document the local media
  mapping; changing the shared permission model remains a separate auth change. Catalog's existing
  dotted-key mismatch is not fixed here.
- **S3 SDK compatibility with R2** → Use the documented endpoint, `auto` region, and path-style
  settings; verify presign/head/delete against a staging bucket before production.
- **Contract additions require SDK regeneration** → Run `contract:check`, `contract:test`, and
  `pnpm --filter api-sdk generate:check` in CI so generated types cannot drift.

## Migration Plan

1. Add media R2 environment configuration, `.env.example` entries, and API README documentation.
2. Add `media_read`/`media_manage` to the seed and grant them to baseline roles; run seed tests. No
   database schema migration is required.
3. Add the additive contract changes and completion operation; regenerate and verify the API SDK.
4. Implement the storage adapter, media module, and tests; add the operations to
   `x-implemented-operations`.
5. Deploy configuration and secrets before the API. Roll back by reverting the API deployment; the
   contract changes are additive and the seeded permissions are harmless if the API is reverted. Do
   not delete media rows or objects as part of rollback.
