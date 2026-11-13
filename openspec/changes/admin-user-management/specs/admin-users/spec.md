# Spec Delta

## Purpose

Lets operators create, read, update, enable, and disable admin users and assign each an existing role from the admin dashboard.

## ADDED Requirements

### Requirement: List admin users
The system SHALL return a paginated list of admin users with id, email, display name, status, role key, role scope, and created-at timestamp.

#### Scenario: Operator lists admin users
- **WHEN** operator with `admin.users.read` permission GETs `admin/users`
- **THEN** system returns page of admin users including role key and scope

#### Scenario: Operator without permission is denied
- **WHEN** operator lacking `admin.users.read` permission GETs `admin/users`
- **THEN** system returns 403 Forbidden

### Requirement: Get a single admin user
The system SHALL return one admin user's details by id, including role and permissions.

#### Scenario: Operator gets an admin user
- **WHEN** operator with `admin.users.read` permission GETs `admin/users/{userId}`
- **THEN** system returns the admin user with role key, scope, and permissions

#### Scenario: Admin user not found
- **WHEN** operator GETs `admin/users/{userId}` for a non-existent id
- **THEN** system returns 404 Not Found

### Requirement: Create an admin user
The system SHALL create a new admin user with email, password hash, display name, status, and an assigned existing role.

#### Scenario: Operator creates an admin user
- **WHEN** operator with `admin.users.create` permission POSTs valid email, display name, role id, and status to `admin/users`
- **THEN** system creates the admin user and returns it with role key, scope, and permissions

#### Scenario: Duplicate email is rejected
- **WHEN** operator POSTs an email already assigned to another admin user
- **THEN** system returns 409 Conflict

#### Scenario: Unknown role is rejected
- **WHEN** operator POSTs a role id that does not exist
- **THEN** system returns 400 Bad Request

### Requirement: Update an admin user
The system SHALL update an admin user's display name, status, and assigned role.

#### Scenario: Operator updates an admin user
- **WHEN** operator with `admin.users.update` permission PATCHes `admin/users/{userId}` with new display name or role id
- **THEN** system updates the admin user and returns the updated record

#### Scenario: System role scope cannot change
- **WHEN** operator attempts to change the scope of a system role through role assignment
- **THEN** system returns 409 Conflict

### Requirement: Disable or enable an admin user
The system SHALL set an admin user's status to active or disabled.

#### Scenario: Operator disables an admin user
- **WHEN** operator with `admin.users.disable` permission POSTs to `admin/users/{userId}/disable`
- **THEN** system sets the admin user's status to disabled and returns 204 No Content

#### Scenario: Operator enables a disabled admin user
- **WHEN** operator with `admin.users.update` permission PATCHes `admin/users/{userId}` with `status: active`
- **THEN** system sets the admin user's status to active and returns the updated record

#### Scenario: Disabled admin user cannot sign in
- **WHEN** disabled admin user attempts to authenticate
- **THEN** system rejects the authentication with 401 Unauthorized

### Requirement: Successful saves are confirmed and return to the list

After an admin user is created or updated successfully, the admin dashboard SHALL close the save form, show a success notification, and display the refreshed admin users list. The save confirmation SHALL NOT depend on the list refresh succeeding. If the save fails, the form SHALL remain open with the entered values and an error notification SHALL be shown.

#### Scenario: Successful create returns to the refreshed list
- **WHEN** an operator saves a valid new admin user
- **THEN** the dashboard closes the form, shows a success notification, and displays the refreshed list including the new user

#### Scenario: Successful update returns to the refreshed list
- **WHEN** an operator saves changes to an existing admin user
- **THEN** the dashboard closes the form, shows a success notification, and displays the refreshed list with the updated values

#### Scenario: Refresh failure does not hide the save confirmation
- **WHEN** an admin user is saved successfully but the subsequent list refresh fails
- **THEN** the dashboard still shows the save success notification and reports the list refresh failure separately

#### Scenario: Failed save keeps the form open
- **WHEN** an operator submits a create or update that the API rejects
- **THEN** the form remains open with the entered values and only an error notification is shown

### Requirement: Admin user list actions match the shared list pattern

The admin users list SHALL present row actions with the same button treatment used by other admin list pages: a primary Edit action and a danger status action. The Edit and Enable row actions SHALL be visible only with `admin.users.update`; the Disable row action SHALL be visible only with `admin.users.disable`.

#### Scenario: Active user shows permitted Edit and Disable actions
- **WHEN** an operator with `admin.users.update` and `admin.users.disable` permissions views an active admin user
- **THEN** the row shows Edit and Disable actions styled consistently with the Products list actions

#### Scenario: Disabled user shows permitted Edit and Enable actions
- **WHEN** an operator with `admin.users.update` permission views a disabled admin user
- **THEN** the row shows Edit and Enable actions

#### Scenario: Row actions are hidden without permission
- **WHEN** an operator lacks `admin.users.update` or `admin.users.disable`
- **THEN** the corresponding Edit, Enable, or Disable action is not rendered
