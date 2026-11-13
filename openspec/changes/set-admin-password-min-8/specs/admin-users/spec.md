# Spec Delta

## Purpose

Defines the password length rule applied when an operator creates an admin user through the API or the admin dashboard. Aligns with plan.md item 8 (admin authentication and role permissions).

## ADDED Requirements

### Requirement: Admin user passwords require at least eight characters

The system SHALL require an admin-user password of at least 8 characters when creating an admin user, and SHALL reject shorter passwords. The rule SHALL apply to the API request and the Add administrator form. It SHALL NOT apply to password login or to passwords already stored for existing accounts.

#### Scenario: Reject a password shorter than eight characters
- **WHEN** an operator with `admin.users.create` permission POSTs an admin user with a 7-character password to `admin/users`
- **THEN** the system returns 400 Bad Request with a validation error for the password field and creates no admin user

#### Scenario: Accept a password of exactly eight characters
- **WHEN** an operator with `admin.users.create` permission POSTs an admin user with an 8-character password to `admin/users`
- **THEN** the system creates the admin user and stores only a password hash

#### Scenario: Admin form blocks a short password
- **WHEN** an operator enters a 7-character password in the Add administrator form and attempts to submit
- **THEN** the form shows the minimum-length validation message and sends no create request

#### Scenario: Admin form accepts an eight-character password
- **WHEN** an operator enters an 8-character password in the Add administrator form with all other fields valid
- **THEN** the form is valid and the create request is sent

#### Scenario: Existing credentials remain usable
- **WHEN** an existing admin user with a stored password shorter than 8 characters signs in with the matching password
- **THEN** authentication is evaluated normally and is not rejected by the creation-time length rule

### Requirement: Admin-user API contract matches the password minimum

The documented `AdminUserCreate` request SHALL declare a minimum password length of 8 so contract-driven clients validate the same rule the API enforces.

#### Scenario: Contract reflects the minimum length
- **WHEN** a client reads the `AdminUserCreate.password` schema from the published OpenAPI document
- **THEN** the schema declares `minLength: 8`
