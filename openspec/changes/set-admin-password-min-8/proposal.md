# Proposal

## Why

Admin-user creation currently rejects passwords shorter than 10 characters in both the API schema and the admin dashboard form. The intended policy for internal staff accounts is a minimum of 8 characters, so the stricter 10-character rule blocks valid credentials and differs from the decision made during exploration. The OpenAPI contract also still advertises `minLength: 1`, so generated clients do not reflect the real rule.

## What Changes

- Lower the admin-user password minimum from 10 to 8 characters in the API request schema.
- Lower the same minimum in the admin dashboard's Add administrator form and update its validation message.
- Align `AdminUserCreate.password` in `openapi.yaml` with the runtime rule by setting `minLength: 8`.
- Add boundary coverage: 7 characters rejected, 8 characters accepted, at both the API schema and admin form levels.
- Keep login validation at `min(1)` so existing credentials, including seeded accounts, continue to work.
- Leave customer registration and customer passwords unchanged.

## Capabilities

### New Capabilities

- `admin-users`: the admin-user lifecycle, including the password length rule enforced when an operator creates an admin user through the API and dashboard.

### Modified Capabilities

- None.

## Impact

- API: `apps/api/src/admin-users/admin-users.schemas.ts` (minimum and message), `apps/api/openapi/openapi.yaml` (`AdminUserCreate.password.minLength`).
- Admin UI: `apps/admin/src/users/admin-users-list.component.ts` (form validator and error message).
- Tests: API schema boundary tests and admin form validation tests.
- No database migration, no change to password hashing, sessions, login, or existing admin accounts.

## Non-goals

- Changing the customer registration password minimum.
- Changing password login validation.
- Adding a maximum password length, complexity rules, password rotation, or password expiry.
- Adding password change or reset flows for admin users.
- Revalidating or migrating passwords already stored for existing accounts.
