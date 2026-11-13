# Design

## Context

Admin-user creation is validated twice today: the API request schema in `apps/api/src/admin-users/admin-users.schemas.ts` enforces `min(10)`, and the Add administrator form in `apps/admin/src/users/admin-users-list.component.ts` enforces `Validators.minLength(10)` with a matching message. The published `AdminUserCreate.password` schema in `apps/api/openapi/openapi.yaml` still declares `minLength: 1`, so it does not describe either rule. Password login uses `passwordLoginSchema` with `min(1)` and is separate from creation. See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**

- Enforce an 8-character minimum when creating an admin user, through both the API and the dashboard form.
- Make the OpenAPI `AdminUserCreate` contract match the enforced rule.
- Cover the 7/8 boundary in automated tests.

**Non-Goals:**

- Changing customer registration, customer login, or admin login rules.
- Adding maximum length, complexity, expiry, rotation, or password reset.
- Changing hashing, sessions, database constraints, or existing credentials.

## Decisions

### 1. Lower the literal minimum in both validation layers

Change `min(10)` to `min(8)` in the API schema and `Validators.minLength(10)` to `Validators.minLength(8)` in the form, and update the form message and API message to say 8.

**Why not share a constant?** The admin app does not depend on `packages/shared-types`, and the API already treats its Zod schema as the source of truth. Introducing a runtime shared package for one number would add a dependency and build coupling without removing the need for UI-side validation. The API remains authoritative; the form only mirrors it for immediate feedback.

**Alternative considered:** expose the rule through client configuration or the API. Rejected as disproportionate for a single stable constant and would make the form depend on a network/config load before validating.

### 2. Keep the rule creation-only

The check stays in `adminUserCreateSchema` and the create mode of the form. `passwordLoginSchema` remains `min(1)`, and the form's edit mode still disables the password field.

**Why:** lowered creation rules must not invalidate existing credentials, including seeded administrators that may have passwords shorter than 8 characters. Login should evaluate the stored hash, not re-apply a newer creation policy.

### 3. Update the OpenAPI contract by hand

Set `AdminUserCreate.password.minLength` to `8` in `apps/api/openapi/openapi.yaml`.

**Why:** the contract is hand-maintained today and already out of sync. Generating OpenAPI from the Zod schemas would remove this class of drift, but it is a larger tooling change outside this scope.

### 4. Test the boundary at both layers and the contract

Add API schema unit coverage for 7 rejected and 8 accepted, extend the admin form tests for both boundaries, and assert the documented `minLength` is 8.

**Why:** the value is duplicated by design, so each copy needs its own guard. A contract assertion prevents the OpenAPI drift from returning silently.

## Risks / Trade-offs

- **Duplicated literal can drift between API and form** → tests assert the same 7/8 boundary on both sides, and both messages state the value explicitly.
- **Lower minimum slightly weakens password strength** → accepted policy decision; the system still requires a length floor and does not rely on composition rules.
- **Existing admin passwords below 8 remain valid for login** → intended compatibility behavior; no data migration is performed.
- **OpenAPI can drift again** → the new contract assertion fails if `minLength` stops matching.
- **Form message remains hardcoded English** → pre-existing behavior for this modal; not expanded into a localization change here.

## Migration Plan

No database or data migration is required. Deploy the API schema, dashboard form, and OpenAPI update together. Rollback is a code revert; no stored data depends on the minimum, so no cleanup is needed.
