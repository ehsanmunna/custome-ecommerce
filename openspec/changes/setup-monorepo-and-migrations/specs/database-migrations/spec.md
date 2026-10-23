## Purpose

Provides one ordered, version-controlled schema history that every client database follows, so the same application build can run against any client database with a verifiable schema version.

## ADDED Requirements

### Requirement: Migrations are ordered, immutable, and applied once
The system SHALL maintain a single ordered stream of migrations identified by a sortable version identifier. A migration that has been applied MUST NOT be modified or reordered.

#### Scenario: Pending migrations exist
- **WHEN** the migration command runs against a database with unapplied migrations
- **THEN** migrations are applied in version order
- **AND** each applied migration is recorded in the migration ledger with its version, checksum, and completion time

#### Scenario: No pending migrations
- **WHEN** the migration command runs against an up-to-date database
- **THEN** the command exits successfully without changing schema
- **AND** no ledger entries are added

#### Scenario: Applied migration was modified
- **WHEN** a migration already recorded as applied has a different checksum than the one on disk
- **THEN** the migration command fails before applying anything
- **AND** the error identifies the modified migration

### Requirement: Migration failures are atomic
The system SHALL apply each migration atomically. If a migration fails, the database MUST remain at the last successfully completed version and the command MUST exit with a non-zero status.

#### Scenario: Migration fails midway
- **WHEN** a migration fails while executing
- **THEN** its changes are rolled back
- **AND** the recorded schema version remains the previous successful version
- **AND** the command exits with a non-zero status and reports the failing migration

### Requirement: Fresh databases can be initialized from zero
The system SHALL bring an empty database to the current schema using only the committed migration stream.

#### Scenario: Empty database
- **WHEN** the migration command runs against a database with no tables
- **THEN** every migration is applied in order
- **AND** the resulting schema matches the schema produced on a database that applied the same migrations incrementally

### Requirement: Existing databases upgrade without data loss
The system SHALL apply pending migrations to a database that already contains data without deleting or corrupting existing rows.

#### Scenario: Existing client database
- **WHEN** the migration command runs against a populated database on an older version
- **THEN** only pending migrations are applied
- **AND** existing rows remain readable
- **AND** the recorded schema version becomes the newest applied version

### Requirement: Schema version is observable
The system SHALL expose the current schema version and migration status so operators and the API can verify compatibility.

#### Scenario: Status query
- **WHEN** an operator requests migration status
- **THEN** the output lists applied migrations, the current schema version, and any pending migrations

#### Scenario: Uninitialized database
- **WHEN** status is requested for a database with no migration ledger
- **THEN** the command reports the database as uninitialized and exits with a non-zero status

### Requirement: All client databases share one migration stream
The system MUST NOT contain client-specific migrations or per-client schema branches. Every client database MUST be migratable with the same committed migration set.

#### Scenario: Client-specific change requested
- **WHEN** a schema change is needed for only one client
- **THEN** it is rejected as a migration
- **AND** it is resolved through configuration, a custom field, or a core feature instead

#### Scenario: Schema drift detected
- **WHEN** a database's recorded version cannot be matched to a known migration version
- **THEN** the migration command fails and reports drift instead of attempting a partial apply

### Requirement: Every migration has a rehearsed rollback path
The system SHALL document a rollback path for each production migration and MUST rehearse it on staging before the migration reaches a client production database.

#### Scenario: Rollback rehearsal
- **WHEN** a migration is prepared for a client production database
- **THEN** its documented rollback path has been executed successfully against a staging copy
- **AND** the rehearsal is recorded with the release

#### Scenario: Rollback is required
- **WHEN** a deployed migration must be undone
- **THEN** the documented rollback path restores the database to the previous schema version and preserves data

### Requirement: Migration execution is restricted
The system SHALL require a dedicated migration identity for schema changes. The runtime API identity MUST NOT hold permission to alter schema.

#### Scenario: Runtime identity attempts schema change
- **WHEN** the API runtime identity attempts to create or alter a table
- **THEN** the database rejects the operation

#### Scenario: Migration identity runs migrations
- **WHEN** the migration command runs with the dedicated migration identity
- **THEN** schema changes are permitted and recorded
