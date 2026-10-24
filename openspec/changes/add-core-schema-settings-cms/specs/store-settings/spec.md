## Purpose

Defines persisted, store-wide configuration shared by the API and admin for each client database. Provider secrets remain in externally managed secret storage and are never persisted as setting values.

## ADDED Requirements

### Requirement: Store settings have stable unique keys and structured values

The system SHALL store store-wide settings with a non-empty stable key and a structured value. A key MUST identify at most one setting in a store database. Settings SHALL cover configuration such as tax, payment, courier, and notification options without requiring a client identifier in the row.

#### Scenario: Store configuration is stored
- **WHEN** a valid tax or provider option is saved under a unique key
- **THEN** it is persisted and can be read using that key

#### Scenario: Duplicate setting key rejected
- **WHEN** a second setting is saved using an existing key
- **THEN** the write is rejected

#### Scenario: Empty setting key rejected
- **WHEN** a setting is saved without a non-empty key
- **THEN** the write is rejected

### Requirement: Provider credentials are represented only by external references

The persistence schema MUST NOT provide a provider credential-value column. Provider credentials SHALL be represented by dedicated records containing only a non-empty reference to externally managed secret storage. Generic store setting values are reserved for non-secret configuration; later settings APIs MUST validate allowed keys and values before persistence.

#### Scenario: External secret reference stored
- **WHEN** a provider configuration is saved with a valid external secret reference and no credential value
- **THEN** only the reference is persisted

#### Scenario: Secret reference record stores no credential
- **WHEN** a provider secret reference is stored
- **THEN** the record contains the external reference and no credential value

#### Scenario: Empty secret reference rejected
- **WHEN** a provider secret-reference record is written with an empty reference
- **THEN** the write is rejected

### Requirement: Store settings preserve explicit values and lifecycle timestamps

The system SHALL preserve configured setting values until they are intentionally changed or removed. A newly created setting MUST record creation and update timestamps, and changing a value MUST update its update timestamp.

#### Scenario: Setting update records change time
- **WHEN** an existing setting value is changed
- **THEN** its latest value is stored and its update timestamp advances

#### Scenario: Unchanged setting is retained
- **WHEN** other settings are changed
- **THEN** the value of this setting remains unchanged
