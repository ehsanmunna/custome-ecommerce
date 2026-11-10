# Spec Delta

## Purpose

Defines the behavior contract for admin role and permission management, including listing roles, creating roles with permission grants, updating roles, deleting non-system roles, and listing the permission catalog.

## ADDED Requirements

### Requirement: List roles
The system SHALL return a paginated list of admin roles, each with its key, name, scope, system flag, and assigned permission keys.

#### Scenario: Successful role list
- **WHEN** an authenticated admin with `admin.roles.read` permission calls `GET /admin/roles`
- **THEN** the system returns a paginated `RolePage` with all store-scoped roles

#### Scenario: Role list requires permission
- **WHEN** an authenticated admin without `admin.roles.read` permission calls `GET /admin/roles`
- **THEN** the system returns a 403 Forbidden

### Requirement: Create role
The system SHALL create a new admin role with a unique key, name, optional description, scope, and permission key grants.

#### Scenario: Successful role creation
- **WHEN** an authenticated admin with `admin.roles.create` permission calls `POST /admin/roles` with a valid role key, name, scope, and permission keys
- **THEN** the system creates the role and returns the created `Role`

#### Scenario: Role creation with duplicate key
- **WHEN** an admin calls `POST /admin/roles` with a key that already exists
- **THEN** the system returns a 409 Conflict

#### Scenario: Role creation requires permission
- **WHEN** an authenticated admin without `admin.roles.create` permission calls `POST /admin/roles`
- **THEN** the system returns a 403 Forbidden

### Requirement: Update role
The system SHALL update an existing role's name, description, scope, and permission key grants.

#### Scenario: Successful role update
- **WHEN** an authenticated admin with `admin.roles.update` permission calls `PATCH /admin/roles/{roleId}` with valid updates
- **THEN** the system updates the role and returns the updated `Role`

#### Scenario: Update non-existent role
- **WHEN** an admin calls `PATCH /admin/roles/{roleId}` with a role ID that does not exist
- **THEN** the system returns a 404 Not Found

#### Scenario: Role update requires permission
- **WHEN** an authenticated admin without `admin.roles.update` permission calls `PATCH /admin/roles/{roleId}`
- **THEN** the system returns a 403 Forbidden

### Requirement: Delete role
The system SHALL delete a role that is not system-owned and not assigned to any admin user.

#### Scenario: Successful role deletion
- **WHEN** an authenticated admin with `admin.roles.delete` permission calls `DELETE /admin/roles/{roleId}` for a non-system role with no assigned users
- **THEN** the system deletes the role and returns 204 No Content

#### Scenario: Delete system role rejected
- **WHEN** an admin calls `DELETE /admin/roles/{roleId}` for a system role (isSystem = true)
- **THEN** the system returns a 403 Forbidden

#### Scenario: Delete role with assigned users rejected
- **WHEN** an admin calls `DELETE /admin/roles/{roleId}` for a role assigned to at least one admin user
- **THEN** the system returns a 409 Conflict

#### Scenario: Role deletion requires permission
- **WHEN** an authenticated admin without `admin.roles.delete` permission calls `DELETE /admin/roles/{roleId}`
- **THEN** the system returns a 403 Forbidden

### Requirement: List permissions
The system SHALL return a paginated list of all available permissions with their key, description, group, and sort order.

#### Scenario: Successful permission list
- **WHEN** an authenticated admin with `admin.roles.read` permission calls `GET /admin/permissions`
- **THEN** the system returns a paginated `PermissionPage` with all permissions

#### Scenario: Permission list requires permission
- **WHEN** an authenticated admin without `admin.roles.read` permission calls `GET /admin/permissions`
- **THEN** the system returns a 403 Forbidden

### Requirement: Scope enforcement
The system SHALL enforce that admin roles with `scope: 'store'` cannot perform platform-scoped operations.

#### Scenario: Platform scope denied for store role
- **WHEN** a store-scoped admin attempts an operation requiring `scope: 'platform'`
- **THEN** the system returns a 403 Forbidden
