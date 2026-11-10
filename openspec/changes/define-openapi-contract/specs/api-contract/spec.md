## Purpose

Defines the canonical, versioned HTTP contract for the platform API and the compatibility boundary consumed by TypeScript clients. The contract makes planned v1 operations and their externally visible request, response, security, and error behavior testable.

## ADDED Requirements

### Requirement: The v1 contract covers the planned API surface

The canonical OpenAPI document SHALL describe every operation exposed by the API. Its v1 operation set MUST cover liveness and readiness; admin authentication, users, roles, and permissions; media; public and administrative catalog; inventory; customer authentication, profile, and addresses; carts and checkout; orders, lifecycle changes, and returns; payments; shipping; coupons and promotions; store settings; CMS content; notifications; and analytics. Operations SHALL be tagged by capability, and public storefront operations SHALL be distinguishable from administrative operations.

#### Scenario: Complete capability coverage
- **WHEN** the OpenAPI document is validated against the planned v1 API surface
- **THEN** every capability listed in this requirement has its applicable operations documented
- **AND** each operation has a unique HTTP method and path

#### Scenario: Undocumented API route
- **WHEN** an API route is added without a corresponding OpenAPI operation
- **THEN** contract validation fails

#### Scenario: Planned operation has no route implementation yet
- **WHEN** an operation is part of the planned v1 contract but its feature is not implemented
- **THEN** the contract remains the source of truth for that operation
- **AND** contract planning does not imply that the operation is already available at runtime

### Requirement: Operations define complete wire behavior

Each operation SHALL define its request parameters and body, successful response schemas and status codes, and applicable error responses. Shared schemas MUST express required fields, nullability, supported enum values, and validation constraints. API paths SHALL be versioned under `/v1`; timestamps SHALL use ISO 8601 date-time values; monetary amounts SHALL be non-negative integer poisha; and localized content SHALL use `bn` or `en`.

#### Scenario: Invalid request is described
- **WHEN** a request violates a documented required field, format, range, or enum
- **THEN** the operation documents a client-error response and a machine-readable validation detail

#### Scenario: Monetary values use the platform unit
- **WHEN** an operation accepts or returns an amount
- **THEN** the amount is represented as an integer count of poisha

#### Scenario: Localized content uses supported locales
- **WHEN** an operation accepts or returns localized content
- **THEN** each locale is represented using the `bn` or `en` locale key

#### Scenario: API path identifies its major version
- **WHEN** a client invokes a v1 operation
- **THEN** its path is rooted at `/v1`

### Requirement: Collection operations use consistent pagination

Every operation that returns a collection SHALL document `page` and `pageSize` query parameters and a response containing the collection items, total item count, current page, and page size. Defaults and maximum page size MUST be stated in the contract.

#### Scenario: Paginated collection response
- **WHEN** a client requests a collection with supported pagination parameters
- **THEN** the response includes items and the corresponding total, page, and page-size metadata

#### Scenario: Page size exceeds the maximum
- **WHEN** a client requests a page size above the documented maximum
- **THEN** the operation documents deterministic client-error handling

### Requirement: Errors and access requirements are explicit

Error responses SHALL use a shared RFC 9457 problem-details schema with a stable machine-readable code and no sensitive internal details. Every operation SHALL declare whether it is public or requires bearer authentication; protected admin operations MUST declare their required permission, and customer operations MUST describe the required customer identity. Contract schemas and examples MUST NOT expose passwords, OTP values, provider credentials, or raw payment webhook payloads.

#### Scenario: Public operation
- **WHEN** an operation is intended for unauthenticated storefront access
- **THEN** its security requirements identify it as public

#### Scenario: Protected administrative operation
- **WHEN** an operation changes or reads administrative data
- **THEN** it requires bearer authentication and documents the required permission

#### Scenario: Authorization failure
- **WHEN** a caller is unauthenticated or lacks the declared permission
- **THEN** the operation documents the corresponding authorization error using the shared problem-details schema

#### Scenario: Sensitive data is excluded
- **WHEN** request or response schemas for authentication, payment, or provider operations are reviewed
- **THEN** they do not expose secrets or raw authentication/payment payloads

### Requirement: The TypeScript API SDK is derived from the contract

The TypeScript API SDK SHALL provide typed access to documented operations and schemas, use a caller-configured API base URL, and support bearer credentials for protected operations. SDK generation or synchronization MUST be reproducible from the canonical OpenAPI document, and validation MUST detect when generated SDK artifacts are stale.

#### Scenario: SDK exposes a documented operation
- **WHEN** a client package is generated or synchronized from the OpenAPI document
- **THEN** its types and callable operations correspond to the documented paths, methods, parameters, and schemas

#### Scenario: Contract changes require SDK synchronization
- **WHEN** the OpenAPI document changes without updating generated SDK artifacts
- **THEN** the SDK consistency check fails

### Requirement: V1 contract evolution preserves compatibility

Changes to the v1 contract SHALL preserve existing operation behavior for additive changes. A change that removes or renames an operation, makes a previously optional input required, narrows accepted values, or otherwise breaks a documented client interaction MUST use a new major API version rather than silently changing `/v1`. Contract validation MUST check API implementation routes and generated SDK artifacts against the canonical contract.

#### Scenario: Additive v1 contract change
- **WHEN** an operation or optional response field is added without changing existing behavior
- **THEN** the change may remain in `/v1`

#### Scenario: Breaking contract change
- **WHEN** a proposed change is incompatible with a documented v1 client interaction
- **THEN** the change is rejected from `/v1` and requires a new major API version

#### Scenario: Implementation and contract diverge
- **WHEN** an implemented route, method, request, or response diverges from the canonical document
- **THEN** contract validation fails
