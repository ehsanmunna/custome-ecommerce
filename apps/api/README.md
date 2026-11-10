# API contract

The canonical OpenAPI 3.1 contract is [openapi/openapi.yaml](./openapi/openapi.yaml). Its server base
is `/v1`, so `GET /health/live` resolves to `/v1/health/live`. Health, authentication, customer
registration, catalog, and media operations are implemented. Other operations describe the planned
v1 boundary and are not available until their feature changes implement them.

## Authentication

Customer and admin sessions use short-lived signed access tokens and rotating opaque refresh tokens.
Refresh tokens are stored only as keyed hashes; protected requests check the persisted session and
current account status. Admin permissions and role scope are resolved from current role assignments
on each request.

Set distinct `AUTH_TOKEN_SIGNING_SECRET` and `AUTH_TOKEN_HASH_SECRET` values of at least 32
characters in production. Generate them from a cryptographically secure source and keep them in the
deployment secret manager. Development and test environments generate per-process secrets when
these values are omitted, so sessions are invalidated on restart.

Customer OTP delivery is available independently by channel. Configure `RESEND_API_KEY` and
`RESEND_FROM_EMAIL` to enable email through Resend; verify the sender domain/address in Resend first.
Configure `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER` to enable SMS through
Twilio; provision the sender number for the account and destination region. Each provider group must
be either entirely absent or entirely set. The API starts when both groups are absent, but OTP
requests for an unconfigured channel return `503 Service Unavailable`. A configured channel remains
usable if the other provider is unavailable.
The API never returns OTP values and does not claim successful delivery when the selected channel is
unavailable.
Supply credentials through the deployment secret manager and never commit them to the repository.
Provider calls have bounded timeouts and are not retried automatically. Rejections, invalid responses,
and timeouts invalidate the pending OTP and return a temporary failure; provider response details
and OTP values are not exposed. Messages contain concise Bangla and English wording with the
configured OTP validity period.
Access-token and refresh-token lifetimes, OTP expiry/attempt limits, and issuance rate limits can be
configured with the corresponding `AUTH_*` environment variables; validated defaults are listed in
`.env.example` and `apps/api/src/platform/config/env.schema.ts`.

## Media storage

Media objects live in the client's own Cloudflare R2 account; the API stores metadata only and
never receives the binary. Configure the API with `R2_ACCOUNT_ID`, `R2_BUCKET`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_PUBLIC_BASE_URL`. Supply credentials through
the client's deployment secret manager and never commit them to the repository. The API starts
without these values, but media operations return `503 Service Unavailable` until the complete
group is configured.

`R2_UPLOAD_TTL_SECONDS` bounds the presigned upload lifetime, `R2_MAX_UPLOAD_BYTES` bounds the
accepted object size, and `R2_IMAGE_RESIZING_ENABLED` controls whether resized delivery URLs are
returned. `R2_PUBLIC_BASE_URL` must be the public custom domain (or `r2.dev` URL) bound to the
bucket and must allow public reads for delivery.

The admin upload sequence is:

1. `POST /v1/admin/media` with `fileName`, `mimeType`, `sizeBytes`, and optional `alt` text. The API
   generates the object key, stores a pending metadata record, and returns `upload.url`,
   `upload.method`, `upload.headers`, and `upload.expiresAt`.
2. The admin client sends the file bytes directly to that URL with `PUT` and exactly the returned
   headers. The API never proxies the binary and the presigned URL must not be logged or shared.
3. `POST /v1/admin/media/{mediaId}/complete` verifies the object with a HEAD request and records the
   authoritative size and content type, plus optional `width`/`height` supplied together. Completion
   is idempotent; a missing object returns `409 Conflict`.
4. `DELETE /v1/admin/media/{mediaId}` removes metadata and then best-effort deletes the object. A
   cleanup failure is logged but does not fail the request.

The bucket must allow `PUT` from the admin origin with the `Content-Type` header and allow `HEAD`
from the API. Configure a CORS rule similar to:

```json
[
  {
    "AllowedOrigins": ["https://admin.example.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

Delivery URLs use `R2_PUBLIC_BASE_URL` plus the object key. When resizing is enabled, responses also
include `thumbnail` (160 px), `card` (480 px), `detail` (960 px), and `large` (1600 px) URLs built
through Cloudflare Image Resizing (`/cdn-cgi/image/width=<n>,format=auto/<key>`). The public custom
domain must be routed through Cloudflare with Image Resizing enabled; otherwise clients should use
the original `url`. Upload intents that are never completed, or whose object is deleted outside the
API, should be cleaned up by periodically deleting metadata older than the accepted lifecycle window
and any orphaned objects during operations review.

## Updating the contract

1. Update the canonical YAML with the operation, request/response schemas, security declarations,
   permissions, and shared error response.
2. Keep collection operations on `page` / `pageSize` pagination (default 20, maximum 100). Monetary
   values are integer poisha; localized text uses `bn` and `en`.
3. For a newly implemented Nest route, add its contract operation and update
   `x-implemented-operations`. `pnpm contract:check` compares that declaration against API
   controller decorators and checks operation IDs, security declarations, pagination, and problem
   responses.
4. Regenerate and verify the typed client:

   ```sh
   pnpm --filter api-sdk generate
   pnpm --filter api-sdk generate:check
   ```

5. Run the checks used by CI:

   ```sh
   pnpm contract:lint
   pnpm contract:check
   pnpm contract:test
   pnpm --filter api-sdk generate:check
   pnpm --filter api test
   ```

`packages/api-sdk` uses the generated `paths` types with `openapi-fetch`. Pass the full API base URL,
including `/v1`, and provide `getAccessToken` when a client needs bearer authentication.

Additive changes can remain in `/v1`. Removing or renaming an operation, narrowing accepted request
values, making an optional input required, or removing a documented response field is breaking and
requires a new major API version. `pnpm contract:check` compares the current document with the
contract in the Git baseline; the first contract establishes the baseline.
