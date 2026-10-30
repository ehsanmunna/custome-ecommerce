# Design

## Context

See proposal.md for motivation and scope. `apps/admin` currently contains only a TypeScript placeholder; its package has no Angular dependencies. The project guidance specifies Angular. The API contract is in `apps/api/openapi/openapi.yaml`, and `packages/api-sdk` already generates typed OpenAPI definitions and uses `openapi-fetch`.

The admin API currently marks auth, roles and permissions, catalog, media, and inventory operations implemented. Order and return, settings, shipping-zone, coupon, CMS, and analytics operations are described in the contract but not implemented. The contract's `/admin/users` operations manage administrator accounts, not customers; customer lookup therefore needs a separate store-scoped, read-only API contract. Inventory items already contain a per-variant low-stock threshold.

The authentication guard compares its required permission string literally against the permission keys attached to the admin's role. Existing controller/contract keys are endpoint-level dotted names, while seeded baseline roles currently use broader underscore names, so seeded users may be denied despite having the intended category grant.

## Goals / Non-Goals

**Goals:**
- Keep the dashboard and API contract aligned, with domain authorization enforced by the API as well as reflected in the UI.
- Deliver a usable per-client admin application over the versioned API without duplicating domain rules in the browser.
- Make missing contract-described operations and customer lookup API prerequisites explicit.

**Non-Goals:**
- Replacing the backend authentication model or changing admin self-provisioning.
- Persisting secrets or introducing a cross-client platform console.
- Building a separate analytics store or inventory threshold model.

## Decisions

### Use Angular for the admin application

**Decision:** Replace the placeholder with an Angular application, following the project's documented stack and admin phase plan.

**Rationale:** Angular is the explicitly selected framework for the admin, while no existing dashboard UI convention needs to be preserved.

**Alternative considered:** Continue the TypeScript placeholder or choose another framework. Rejected because neither delivers the planned Angular dashboard.

### Treat OpenAPI as the API boundary

**Decision:** Use the shared generated API SDK for typed browser requests. Implement the contract-described admin operations needed for orders/returns, settings, shipping zones, coupons, CMS, and analytics before wiring those screens. Add a separate, read-only customer lookup contract; do not reuse `/admin/users`, which represents administrators.

**Rationale:** This uses the existing OpenAPI and SDK workflow, keeps API behavior testable without the UI, and closes the identified mismatch between described and implemented operations.

**Alternative considered:** Build screens against ad-hoc browser requests or mock-only APIs. Rejected because those options bypass the contract and would not deliver an end-to-end dashboard.

### Keep server authorization authoritative

**Decision:** Derive navigation and route access from the signed-in user's permissions, while relying on the API guard for final permission and scope enforcement. Handle API authorization failures as denied operations, not successful UI state.

**Rationale:** Client-side checks improve usability but cannot replace server authorization.

**Alternative considered:** Hide menu entries only. Rejected because direct navigation and crafted requests would remain possible.

### Enforce explicit order and return lifecycle graphs

**Decision:** Allow order transitions `pending → confirmed/cancelled`, `confirmed → processing/cancelled`, `processing → shipped/cancelled`, `shipped → delivered/partially_delivered`, `partially_delivered → delivered`, and `delivered → returned`. Allow return transitions `requested → approved/rejected/cancelled`, `approved → received/cancelled`, and `received → refunded`; rejected, cancelled, and refunded returns are terminal. Persist each return status transition, actor, optional note, and timestamp in append-only history, including an initial history row when a return is created.

**Rationale:** Status values alone do not express valid lifecycle transitions, and the existing status-update contract accepts a note. Explicit graphs prevent invalid state changes, while durable history preserves the reason and accountability for support and audit.

**Alternative considered:** Accept any defined enum status and discard notes. Rejected because valid enum values do not imply valid transitions, and discarding submitted notes would lose operator input.

### Seed the canonical endpoint-level permission keys

**Decision:** Use the exact permission keys declared by protected API operations as the canonical permission catalog. Seed those keys and explicit least-privilege grants for owner, manager, staff, and support. On reseed, translate known legacy broad grants into their endpoint-level equivalents, remove obsolete broad grants from baseline system roles, and preserve custom-role grant rows. Keep the existing `orders_manage` parcel permission unchanged because changing it is detected as a breaking v1 contract change.

**Rationale:** The guard uses exact matching, so seeds, API requirements, and frontend route permissions must share the same keys. Explicit grants let the server remain authoritative and keep the client navigation consistent, while translating legacy grants preserves custom roles' intended access.

**Alternative considered:** Translate dotted permissions to broad legacy keys in the guard. Rejected because that would continue to couple route enforcement to broad categories and make endpoint-level role management unreliable.

### Keep authentication tokens in memory

**Decision:** Hold access and refresh tokens in application memory and use the existing refresh endpoint during the running application session. On reload, require sign-in again unless the API later supports a secure cookie-based session.

**Rationale:** The current API returns bearer tokens in JSON and does not define an HttpOnly cookie flow. Avoiding persistent browser storage reduces exposure of refresh tokens to script injection.

**Alternative considered:** Persist bearer or refresh tokens in local storage. Rejected because scripts running in the origin can read them.

### Use per-deployment runtime configuration

**Decision:** Load the API base URL and optional branding from validated, client-specific runtime configuration. Do not embed credentials or provider secrets in frontend configuration.

**Rationale:** The platform deploys one instance per client and requires white-labeling; runtime configuration keeps the app reusable without exposing secrets.

### Preserve read-only customer support scope

**Decision:** Add customer search and detail endpoints with least-privilege permission checks and only the profile, addresses, and order context needed for support. Do not add account, password, or OTP mutation.

**Rationale:** The project context includes customer administration, but the existing flow explicitly prohibits admin self-registration and provides no customer-admin API. A narrow lookup surface supports the admin use case without broadening access to credentials.

## Risks / Trade-offs

- [Several API operations exist only in the contract] → Implement and contract-test the required API operations before integrating their screens; do not mark routes implemented until they pass API tests.
- [Existing clients have roles granted only legacy broad permission keys] → Make the seed translate known grants to equivalent endpoint-level permissions, reconcile baseline system-role grants, and verify custom-role access and grants remain intact on a previously seeded database.
- [Customer records include personal data] → Limit fields and permissions to support needs, keep endpoints store-scoped, and test that auth credentials and OTP data are never returned.
- [Memory-only tokens require re-authentication after reload] → Document the behavior in the login UX; revisit only with a secure cookie-based API design.
- [Angular dependencies and build setup do not yet exist] → Add the supported Angular tooling within `apps/admin`, retain the workspace package scripts, and validate build, typecheck, and lint.
- [Different screens may expose inconsistent loading and API errors] → Reuse a shared typed API client and common error/loading presentation while keeping server responses authoritative.

## Migration Plan

1. Define canonical permissions in the OpenAPI contract and reconcile seeded baseline role grants; complete contracts for unsupported admin behavior and implement the API gaps with authorization and tests.
2. Regenerate and validate the shared SDK against the final contract.
3. Add the Angular runtime and shell, then deliver dashboard workflows by domain.
4. Validate the API and UI together, including permission-denial and error cases, before enabling the admin application for a client.

Rollback is to disable the admin frontend deployment and remove newly introduced API routes from the implemented-operations list and route registration. Preserve existing API operations and database records; no destructive data rollback is required by this design.
