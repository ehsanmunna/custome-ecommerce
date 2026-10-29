## 1. Dependencies and configuration

- [x] 1.1 Add the AWS S3 client and presigner dependencies to `apps/api/package.json` and update the lockfile
- [x] 1.2 Extend the validated environment schema with optional R2 account, bucket, credentials, public base URL, upload TTL, max upload size, and image-resizing toggle, including production-safe validation and defaults
- [x] 1.3 Expose the new values through `AppConfigService`, add the R2 secret to logging redaction, and include safe descriptions in the effective-config log
- [x] 1.4 Document every new variable in `.env.example` and `apps/api/README.md`, including the client-owned R2 credential boundary

## 2. Contract and SDK

- [x] 2.1 Add the additive upload-instruction and image-variant objects to `MediaAsset` and define the completion request schema in `apps/api/openapi/openapi.yaml`
- [x] 2.2 Add the `POST /admin/media/{mediaId}/complete` operation with admin bearer security, permission metadata, request body, success response, and shared problem response
- [x] 2.3 Add the new and existing media routes to `x-implemented-operations` without changing existing media request shapes or permission declarations
- [x] 2.4 Regenerate `packages/api-sdk` and run `pnpm contract:lint`, `pnpm contract:check`, `pnpm contract:test`, and `pnpm --filter api-sdk generate:check`

## 3. Permissions and seed data

- [x] 3.1 Add `media_read` and `media_manage` to the baseline permission defaults with owner/manager manage grants and staff read access
- [x] 3.2 Extend seed tests to verify the new permissions, grants, repeatability, and preservation of existing custom grants

## 4. Storage adapter

- [x] 4.1 Define a `MediaStorage` interface and injection token covering presigned PUT creation, object head, object delete, public URL construction, and variant URL construction
- [x] 4.2 Implement the R2 adapter using the S3-compatible endpoint with account/bucket/credential configuration, short-lived PUT signing, and explicit content-type headers
- [x] 4.3 Implement server-side key generation from a UUID and the MIME-derived extension, plus public and Cloudflare resizing URL builders with normalized base URLs
- [x] 4.4 Translate missing-object, provider failure, and cleanup failure cases into storage results or typed internal errors without leaking credentials, endpoints, or presigned URLs
- [x] 4.5 Add adapter tests using a mocked S3 client for presign, head, delete, key generation, and URL building

## 5. Media service

- [x] 5.1 Define request/query validation for media pagination, upload intent, and completion using the existing schema-parsing conventions
- [x] 5.2 Implement paginated media listing with deterministic ordering, explicit field mapping, safe `BigInt` conversion, localized alt text, original URL, and variants
- [x] 5.3 Implement upload-intent creation with MIME allowlisting, size-limit checks, alt-text persistence in a transaction, server-generated key, and presigned PUT instruction generation
- [x] 5.4 Implement upload completion that checks the stored object, rejects missing objects with conflict, uses authoritative size and type, validates optional dimensions, and updates the record idempotently
- [x] 5.5 Implement media deletion that removes metadata, relies on existing cascades/nullification, attempts object cleanup after deletion, logs cleanup failure, and returns not found for unknown identifiers
- [x] 5.6 Return service unavailable from media operations when the required R2 or delivery configuration is missing, while leaving unrelated API operations available

## 6. API layer

- [x] 6.1 Add a `MediaModule` with an admin controller for list, create, complete, and delete routes, wired into `AppModule`
- [x] 6.2 Annotate every route with bearer admin access, store scope, and the persisted `media_read`/`media_manage` permissions mapped from the contract's media permissions
- [x] 6.3 Use path UUID validation, the declared pagination defaults and maximum, correct success status codes, and the shared problem response for validation, conflict, not-found, forbidden, and unavailable errors
- [x] 6.4 Ensure structured logs record lifecycle events and cleanup failures without including credentials, presigned URLs, or full provider responses

## 7. Tests

- [x] 7.1 Add service unit tests for listing/mapping, key generation, MIME and size validation, alt-text persistence, presigned instructions, completion verification/idempotency, variant URLs, unconfigured storage, and deletion/cleanup failure
- [x] 7.2 Add HTTP integration tests with an in-memory storage adapter covering authorized listing, create, complete, delete, pagination, 401/403 permission and scope failures, validation errors, conflict on missing uploads, and 404 deletion
- [x] 7.3 Add a test confirming the mapping from contract media permissions to persisted media permissions is enforced on every route
- [x] 7.4 Run `pnpm --filter api test`, `pnpm --filter api lint`, and `pnpm --filter api typecheck`

## 8. Documentation and verification

- [x] 8.1 Document the create-upload, client PUT, complete, and delete sequence, including required R2 CORS rules for admin-origin PUT requests
- [x] 8.2 Document Cloudflare Image Resizing expectations, the named variant widths, the public custom-domain requirement, and the abandoned-upload lifecycle recommendation
- [x] 8.3 Confirm no database migration is required, then run the database seed tests and the full repository lint, typecheck, and test commands
- [ ] 8.4 Verify the API starts without R2 configuration, media routes return 503, and media routes work with a staging R2 bucket before release
