## Purpose

Defines the shared admin identity and authorization data model every client database uses: admin
users, editable roles, a permission catalog, and role-permission grants. It covers plan.md items 4,
8, and 26 and is the foundation for admin login, RBAC guards, and the staff/roles screens. Role and
permission seed rows arrive with the seed change; the audit log arrives with change #6.

## ADDED Requirements

### Requirement: Admin users authenticate by unique email and hashed password

The system SHALL store admin users with a required lowercase email, a required non-reversible password
hash, a display name, and a status of `active` or `disabled`. An email MUST be unique across admin
users, a new admin MUST default to `active`, and the schema MUST NOT contain a plaintext password
column.

#### Scenario: Admin user created

- **WHEN** an admin user is saved with a lowercase email, a password hash, a display name, and a role
- **THEN** the admin is stored with the `active` status

#### Scenario: Duplicate admin email rejected

- **WHEN** a second admin user is saved with an email already used by another admin
- **THEN** the write is rejected

#### Scenario: Mixed-case admin email rejected

- **WHEN** an admin email contains uppercase characters
- **THEN** the write is rejected

#### Scenario: Empty admin password hash rejected

- **WHEN** an admin user is saved with an empty password hash
- **THEN** the write is rejected

#### Scenario: Admin can be disabled

- **WHEN** an existing admin user is saved with the `disabled` status
- **THEN** the status is stored

#### Scenario: Unsupported admin status rejected

- **WHEN** an admin user is saved with a status outside `active` and `disabled`
- **THEN** the write is rejected

### Requirement: Every admin user has exactly one role

The system SHALL require each admin user to reference one existing role. An admin MUST NOT be stored
without a role, and a role assigned to an admin MUST NOT be deleted while that admin still references
it.

#### Scenario: Admin assigned an existing role

- **WHEN** an admin user is saved with an existing role
- **THEN** the association is stored and readable

#### Scenario: Admin without a role rejected

- **WHEN** an admin user is saved without a role
- **THEN** the write is rejected

#### Scenario: Unknown role rejected

- **WHEN** an admin user is saved with a role identifier that does not exist
- **THEN** the write is rejected

#### Scenario: Delete a role in use

- **WHEN** a role still assigned to an admin user is deleted
- **THEN** the delete is rejected

### Requirement: Roles have a stable key and a scope

The system SHALL store roles with a unique lowercase identifier key, a display name, an optional
description, a scope of `store` or `platform`, a system flag, and a sort order. Role keys MUST be
unique and formatted as lowercase identifiers, and an unsupported scope MUST be rejected.

#### Scenario: Store role created

- **WHEN** a role is saved with a lowercase key and the `store` scope
- **THEN** the role is stored as a store role

#### Scenario: Platform role created

- **WHEN** a role is saved with a lowercase key and the `platform` scope
- **THEN** the role is stored as a platform role

#### Scenario: Duplicate role key rejected

- **WHEN** two roles are saved with the same key
- **THEN** the second write is rejected

#### Scenario: Invalid role key rejected

- **WHEN** a role key contains uppercase characters, spaces, or unsupported characters
- **THEN** the write is rejected

#### Scenario: Unsupported role scope rejected

- **WHEN** a role is saved with a scope outside `store` and `platform`
- **THEN** the write is rejected

### Requirement: System roles cannot be deleted

The system SHALL mark seeded default roles as system roles and MUST reject deleting a system role.
A non-system role MAY be deleted once no admin references it.

#### Scenario: Delete a system role

- **WHEN** a role marked as a system role is deleted
- **THEN** the delete is rejected

#### Scenario: Delete a custom role

- **WHEN** a non-system role with no assigned admins is deleted
- **THEN** the delete succeeds

#### Scenario: System flag is stored

- **WHEN** a role is saved with the system flag set
- **THEN** the flag is readable back

### Requirement: Permissions form a stable catalog

The system SHALL store permissions with a unique lowercase identifier key, an optional description, a
group key, and a sort order. Permission keys MUST be unique and formatted as lowercase identifiers.

#### Scenario: Permission created

- **WHEN** a permission is saved with a lowercase key and a group key
- **THEN** the permission is stored

#### Scenario: Duplicate permission key rejected

- **WHEN** two permissions are saved with the same key
- **THEN** the second write is rejected

#### Scenario: Invalid permission key rejected

- **WHEN** a permission key contains uppercase characters, spaces, or unsupported characters
- **THEN** the write is rejected

### Requirement: Role permissions define effective access

The system SHALL grant permissions to roles through role-permission links. A role MAY have zero
permissions, a role-permission pair MUST be unique, deleting a non-system role SHALL remove its
grants, and deleting a permission that is still granted MUST be rejected. An admin's effective
permissions SHALL be exactly the permissions granted to the admin's role.

#### Scenario: Permission granted to a role

- **WHEN** a permission is granted to a role
- **THEN** the grant is stored and readable

#### Scenario: Duplicate grant rejected

- **WHEN** the same permission is granted twice to the same role
- **THEN** the second write is rejected

#### Scenario: Role with no permissions

- **WHEN** a role is stored without any permission grants
- **THEN** the role is accepted

#### Scenario: Delete a role removes its grants

- **WHEN** a non-system role with permission grants is deleted
- **THEN** its role-permission links are removed

#### Scenario: Delete a granted permission rejected

- **WHEN** a permission still granted to a role is deleted
- **THEN** the delete is rejected

#### Scenario: Delete an ungranted permission

- **WHEN** a permission not granted to any role is deleted
- **THEN** the delete succeeds

#### Scenario: Admin permissions come from the role

- **WHEN** an admin's role has a permission
- **THEN** the admin is associated with that permission through the role
- **AND** the schema stores no per-user permission override

### Requirement: Platform administration is separate from store roles

The system SHALL distinguish platform-scope roles from store-scope roles. A platform role MUST be
identifiable as a platform role and MUST NOT be treated as one of the store roles (`owner`, `manager`,
`staff`, `support`). A platform administrator SHALL be an admin whose assigned role has platform
scope.

#### Scenario: Super-admin role is a platform role

- **WHEN** a super-admin role is stored with platform scope
- **THEN** it is distinguishable from every store-scope role

#### Scenario: Store roles keep store scope

- **WHEN** the default owner, manager, staff, and support roles are stored
- **THEN** each carries store scope

#### Scenario: Platform admin is identifiable

- **WHEN** an admin is assigned a platform-scope role
- **THEN** the admin is distinguishable as a platform administrator from the assigned role
