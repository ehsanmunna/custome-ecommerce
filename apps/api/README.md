# API contract

The canonical OpenAPI 3.1 contract is [openapi/openapi.yaml](./openapi/openapi.yaml). Its server base
is `/v1`, so the health operation `GET /health/live` resolves to `/v1/health/live`. The two health
operations are currently implemented. Other operations describe the planned v1 boundary and are not
available until their feature changes implement them.

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
