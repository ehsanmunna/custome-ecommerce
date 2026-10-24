## 1. Define the canonical v1 contract

- [x] 1.1 Inventory the planned v1 operations from the API roadmap and related capability specs, including health, authentication, media, catalog, inventory, customers, carts and checkout, orders and returns, payments, shipping, promotions, settings, CMS, notifications, and analytics.
- [x] 1.2 Add the canonical OpenAPI 3.1 YAML document under `apps/api/openapi/`, with `/v1` as its server base and capability tags for each operation group.
- [x] 1.3 Define shared schemas for RFC 9457 problem details, pagination, locales, ISO 8601 timestamps, integer poisha, and bearer authentication.

## 2. Specify operation behavior

- [x] 2.1 Document each planned operation's method, path, parameters, request body, success response, validation constraints, and applicable error responses.
- [x] 2.2 Mark public, customer-authenticated, and admin-authenticated operations and document the required admin permission for protected administrative operations.
- [x] 2.3 Define consistent collection pagination parameters, response metadata, default page size, maximum page size, and invalid-input behavior.
- [x] 2.4 Align domain request and response schemas with settled project requirements while leaving unresolved provider and business policies undecided.
- [x] 2.5 Document the existing liveness and readiness operations and distinguish contract-only planned operations from currently implemented runtime routes.

## 3. Generate and validate the TypeScript SDK

- [x] 3.1 Select and pin reproducible OpenAPI validation, compatibility-check, and TypeScript SDK generation tooling.
- [x] 3.2 Replace the placeholder SDK surface with typed operations and schemas generated from the canonical document, retaining configurable base URL and bearer credentials.
- [x] 3.3 Add checks that fail on invalid OpenAPI, stale generated SDK artifacts, undocumented implemented routes, and breaking v1 contract changes.
- [x] 3.4 Add contract tests for current health routes and make the contract-test pattern available for domain routes as they are implemented.

## 4. Integrate and document the workflow

- [x] 4.1 Wire contract validation, compatibility checks, SDK consistency, and applicable API contract tests into the repository's existing validation workflow.
- [x] 4.2 Document how to update the canonical contract, regenerate the SDK, run checks, and require a new API major version for breaking changes.
- [x] 4.3 Run the targeted API and SDK checks and verify that the generated client matches the contract.
