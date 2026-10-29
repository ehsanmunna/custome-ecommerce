## Context

The API currently enables URI versioning at `/v1` and implements liveness and readiness endpoints. The API SDK is a placeholder, and domain endpoint behavior is planned across existing schema changes. See `proposal.md` for motivation and `specs/api-contract/spec.md` for observable requirements.

## Goals / Non-Goals

**Goals:**
- Keep one canonical contract usable by API implementation, contract validation, and TypeScript clients.
- Provide a deterministic workflow that flags undocumented routes, contract drift, and stale SDK output.

**Non-Goals:**
- Publishing or hosting an interactive Swagger UI as part of this change.
- Implementing planned domain endpoints or making unresolved provider and business-policy decisions.

## Decisions

- **Use a checked-in OpenAPI 3.1 YAML document as the source of truth.** Keep it under `apps/api/openapi/` and describe the whole planned v1 surface in one document, split into referenced files only if its size makes review impractical. A canonical file is easier to review and validate than generated API documentation, while remaining consumable by standard tooling.
- **Use `/v1` as the OpenAPI server base path.** This matches the existing NestJS URI versioning and keeps operation paths relative to the version root.
- **Use shared contract components for RFC 9457 problem details, pagination, locale, money, and bearer security.** Common components reduce inconsistent wire shapes across domain areas. Pagination uses `page` and `pageSize`; the default and maximum are explicit in the contract.
- **Generate the TypeScript SDK from the OpenAPI source.** Replace the placeholder surface in `packages/api-sdk` with the generated typed operation/schema interface and a small stable configuration boundary for base URL and credentials. Prefer a reproducible generator command and check generated output into the package so consumers do not need a generator at install time.
- **Validate both sides of the boundary.** Add OpenAPI structural/compatibility validation and API contract tests that check the implemented routes and representative request/response behavior against the document. Contract tests for planned but unimplemented operations become applicable as each feature is implemented; the contract file itself does not claim runtime availability.
- **Treat compatibility checks as a gate.** Additive v1 changes may be accepted; removal or incompatible schema/behavior changes require a new major API version. Avoid manually editing generated SDK output.

## Risks / Trade-offs

- [The broad planned operation set may include unresolved behavior] → Document only behavior already supported by project specs and settled platform decisions; leave provider-specific and open business policies unspecified until the relevant feature change resolves them.
- [A static contract can drift from NestJS routes] → Validate route coverage and add contract tests as routes are implemented; make drift checks part of the API validation workflow.
- [Generated code may be noisy in reviews] → Keep the generator deterministic, commit generated output only when the contract changes, and review the source contract as the authoritative change.
- [OpenAPI tooling may introduce a maintenance dependency] → Use standard tooling with a pinned version and keep the generated SDK usable without runtime generator dependencies.

## Migration Plan

1. Add the canonical OpenAPI document for the existing health endpoints and the planned v1 capability surface.
2. Add validation and compatibility checks for the document.
3. Generate and integrate the TypeScript SDK, retaining a stable base-URL configuration interface.
4. Add route/response contract checks for the existing health endpoints; add corresponding checks as domain routes are implemented.
5. Run the contract and SDK checks in the repository's validation workflow before merging future contract changes.

There is no runtime API migration in this change. Rollback consists of reverting the contract, generator integration, and SDK changes together; deployed v1 routes remain unchanged.
