# API contract

The canonical OpenAPI 3.1 contract is [openapi/openapi.yaml](./openapi/openapi.yaml). Its server base
is `/v1`, so `GET /health/live` resolves to `/v1/health/live`. Health, authentication, customer
registration, and catalog operations are implemented. Other operations describe the planned v1
boundary and are not available until their feature changes implement them.

## Authentication

Customer and admin sessions use short-lived signed access tokens and rotating opaque refresh tokens.
Refresh tokens are stored only as keyed hashes; protected requests check the persisted session and
current account status. Admin permissions and role scope are resolved from current role assignments
on each request.

Set distinct `AUTH_TOKEN_SIGNING_SECRET` and `AUTH_TOKEN_HASH_SECRET` values of at least 32
characters in production. Generate them from a cryptographically secure source and keep them in the
deployment secret manager. Development and test environments generate per-process secrets when
these values are omitted, so sessions are invalidated on restart.

OTP requests return `503 Service Unavailable` until an SMS/email delivery adapter is configured.
The API does not return OTP values or claim successful delivery when no provider is available.
Access-token and refresh-token lifetimes, OTP expiry/attempt limits, and issuance rate limits can be
configured with the corresponding `AUTH_*` environment variables; validated defaults are listed in
`.env.example` and `apps/api/src/platform/config/env.schema.ts`.

Before enabling OTP authentication in production, select the SMS/email providers, implement an
`OtpDeliveryAdapter` for the supported channels, and register it for `OTP_DELIVERY_ADAPTER` in
`AuthModule` in place of `UnavailableOtpDeliveryAdapter`. Provision provider credentials through the
deployment secret manager and verify delivery failure/timeout handling. No production provider or
provider-specific environment variables are configured by this change, so OTP requests continue to
return `503` until that integration is deployed.

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
