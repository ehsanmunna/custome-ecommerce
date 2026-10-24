## Purpose

Provides each client database with safe, repeatable baseline authorization, store configuration, and
shipping-zone data, with an optional secure bootstrap of the first store administrator.

## ADDED Requirements

### Requirement: Store authorization defaults are seeded with least-privilege grants

The system SHALL create the system store roles `owner`, `manager`, `staff`, and `support` with store
scope, and SHALL seed these baseline permission keys: `catalog_read`, `catalog_manage`,
`inventory_read`, `inventory_manage`, `orders_read`, `orders_manage`, `orders_change_status`,
`customers_read`, `customers_manage`, `settings_read`, `settings_manage`, `roles_read`, and
`roles_manage`. The owner SHALL receive all listed baseline permissions. The manager SHALL receive all
catalog, inventory, order, and customer permissions plus `settings_read` and `roles_read`. Staff
SHALL receive `catalog_read`, `inventory_read`, and `orders_read`. Support SHALL receive
`orders_read` and `customers_read`. Only owner and manager SHALL receive `orders_change_status`;
only owner SHALL receive `settings_manage` and `roles_manage`. The keys use underscores to satisfy
the existing role/permission key constraints. No platform-scoped role or permission grant SHALL be
created.

#### Scenario: Default store roles and permissions are provisioned
- **WHEN** the seed command runs against a migrated database without the default rows
- **THEN** the four system store roles, baseline permissions, and the specified grants are created

#### Scenario: Order status permission remains restricted
- **WHEN** baseline role grants are inspected after seeding
- **THEN** `orders_change_status` is granted to owner and manager and not to staff or support

#### Scenario: Role and settings management remain owner-only
- **WHEN** baseline role grants are inspected after seeding
- **THEN** `roles_manage` and `settings_manage` are granted only to owner

#### Scenario: Platform role is not seeded
- **WHEN** the database is seeded
- **THEN** no platform-scoped role or platform permission grant is created

### Requirement: Conservative settings and inactive shipping-zone placeholders are provisioned

The system SHALL create missing baseline settings under the keys `tax`, `payments`, `courier`, and
`notifications`. Their values SHALL disable tax at a zero basis-point rate, enable cash on delivery,
and disable online payments, courier integration, and email and SMS notifications. It SHALL create
the `dhaka` and `outside_dhaka` shipping zones with zero delivery fees, inactive status, and no
district mappings. It MUST NOT store provider credentials or external secret values in settings.

#### Scenario: Safe settings are created for an unconfigured store
- **WHEN** baseline settings are absent and the seed command runs
- **THEN** `tax` is disabled at zero basis points, `payments.cod` is enabled, and online payment,
  courier, email notification, and SMS notification integrations are disabled

#### Scenario: Shipping placeholders remain inactive
- **WHEN** the seed command runs without existing baseline zones
- **THEN** `dhaka` and `outside_dhaka` exist with zero fees, inactive status, and no district mappings

#### Scenario: Existing configuration is preserved
- **WHEN** a setting value or a shipping zone fee or active state has already been configured
- **THEN** a later seed run does not overwrite that configured value

### Requirement: Baseline seeding is repeatable and non-destructive

The seed command SHALL be safe to run more than once without duplicating rows with the same baseline
keys. It MUST preserve existing settings and shipping-zone configuration, MUST NOT delete existing
data, and MUST report incompatible conflicting role or permission records rather than silently
converting them into system defaults.

#### Scenario: Repeated seed run
- **WHEN** the seed command runs more than once on the same database
- **THEN** each baseline key remains unique and existing configured settings and zones remain intact

#### Scenario: Conflicting baseline key
- **WHEN** a row with a baseline role key has incompatible scope or system status, or a baseline
  permission key has an incompatible permission group
- **THEN** the seed command reports the conflict and exits unsuccessfully without silently changing
  that row

#### Scenario: Database write failure
- **WHEN** a baseline write fails
- **THEN** the command reports the failure, exits unsuccessfully, and does not report a successful
  seed run

### Requirement: First administrator bootstrap is optional and secure

The system SHALL create a first active store administrator only when both `SEED_ADMIN_EMAIL` and
`SEED_ADMIN_PASSWORD` are configured and no admin user exists. The email MUST be valid and lowercase,
and the password MUST be non-empty. The new administrator SHALL be assigned the owner role, and the
password SHALL be stored only as an Argon2id hash and never logged. An optional
`SEED_ADMIN_DISPLAY_NAME` supplies the display name; when absent, it defaults to `Store Owner`. When
neither credential is configured, the seed command SHALL skip administrator creation. When exactly
one is configured, the command SHALL report invalid configuration and exit unsuccessfully. If any
admin user already exists, the command MUST leave all admin accounts unchanged.

#### Scenario: Credentials configured for an empty admin table
- **WHEN** both bootstrap credentials are configured and no admin user exists
- **THEN** one active owner administrator is created with an Argon2id password hash

#### Scenario: Bootstrap credentials omitted
- **WHEN** neither bootstrap credential is configured
- **THEN** baseline data is seeded and no admin user is created

#### Scenario: Partial bootstrap credentials
- **WHEN** only one bootstrap credential is configured
- **THEN** the command reports the missing configuration and exits unsuccessfully

#### Scenario: Existing administrator is preserved
- **WHEN** any admin user already exists and bootstrap credentials are configured
- **THEN** no admin user is created, updated, or replaced

### Requirement: Seed command uses only the runtime database identity

The seed command SHALL run only data manipulation operations against an already migrated client
database using `DATABASE_URL`. It MUST NOT apply schema migrations or require or use
`MIGRATION_DATABASE_URL`.

#### Scenario: Seed after migration
- **WHEN** the seed command runs with `DATABASE_URL` against a migrated database
- **THEN** it writes baseline data without requiring schema-level privileges

#### Scenario: Uninitialized database
- **WHEN** the seed command runs against a database without the required migrated schema
- **THEN** it reports the database error and exits unsuccessfully without claiming success
