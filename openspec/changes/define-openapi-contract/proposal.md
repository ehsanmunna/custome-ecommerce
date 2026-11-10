## Why

The API has versioned health endpoints, but no shared description of its planned v1 operations or generated client. Defining that contract before API implementation gives the API, admin, and storefront a stable integration boundary and makes later changes reviewable for compatibility.

## What Changes

- Define the complete planned v1 REST surface, including platform health, admin authentication and permissions, media, catalog, inventory, customer authentication, carts and checkout, orders and returns, payments, shipping, promotions, settings and CMS, notifications, and analytics.
- Specify request and response schemas, authentication and authorization expectations, common errors, pagination, localization, and money representation in a canonical OpenAPI contract.
- Establish validation of the contract and generation or synchronization of the TypeScript API SDK from it.
- Record compatibility rules for additive changes in `/v1` and breaking changes in a new API version.

## Capabilities

### New Capabilities
- `api-contract`: The canonical, versioned OpenAPI contract and its generated TypeScript SDK boundary.

### Modified Capabilities
- None.

## Non-goals

- Implementing the planned domain endpoints, business logic, guards, persistence, or provider integrations.
- Choosing unresolved provider or business policies (including SMS/email providers and order cancellation, returns, or refunds) beyond defining contract points needed to leave those decisions open.
- Building admin or storefront features or generating clients for languages other than TypeScript.

## Impact

- Affected specs: new `api-contract`.
- Expected implementation surfaces: `apps/api`, `packages/api-sdk`, and a canonical OpenAPI document with contract validation and SDK generation.
- No API behavior changes are introduced by defining the contract; endpoint implementation remains in its respective feature changes.
