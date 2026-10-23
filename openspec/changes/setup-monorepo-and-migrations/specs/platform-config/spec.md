## Purpose

Defines how a running API instance proves it is correctly configured and compatible with the database schema before it accepts traffic.

## ADDED Requirements

### Requirement: Required configuration is validated at startup
The system SHALL validate all required environment configuration before binding a network listener. If any required value is missing or invalid, startup MUST fail with an error that names every offending key and MUST NOT serve requests.

#### Scenario: Missing required value
- **WHEN** the API starts without a required database connection setting
- **THEN** startup fails
- **AND** the error names the missing setting
- **AND** no HTTP listener is bound

#### Scenario: Invalid value
- **WHEN** a required setting is present but fails its type or format validation
- **THEN** startup fails with an error naming that setting and the expected format

#### Scenario: Complete configuration
- **WHEN** every required setting is present and valid
- **THEN** startup proceeds to the schema compatibility check

### Requirement: Invalid configuration is never silently defaulted
The system SHALL NOT fall back to a built-in value for a required setting. Defaults MAY apply only to settings explicitly documented as optional.

#### Scenario: Optional setting omitted
- **WHEN** an optional setting is omitted
- **THEN** the documented default is used
- **AND** the effective value is logged without exposing secrets

### Requirement: Liveness and readiness endpoints
The system SHALL expose unauthenticated liveness and readiness endpoints under `/v1/health`. Liveness MUST report only that the process is running. Readiness MUST report whether the instance can serve traffic, including database connectivity.

#### Scenario: Database reachable
- **WHEN** the database accepts a connection within the configured timeout
- **THEN** `/v1/health/ready` responds with HTTP 200
- **AND** the body reports the database as healthy

#### Scenario: Database unreachable
- **WHEN** the database connection fails or times out
- **THEN** `/v1/health/ready` responds with HTTP 503
- **AND** the body reports the database as unhealthy
- **AND** `/v1/health/live` still responds with HTTP 200

#### Scenario: Secrets are not exposed
- **WHEN** any health endpoint responds
- **THEN** the response contains no credentials, connection strings, or configuration values beyond an allowlisted set of status fields

### Requirement: Schema compatibility is checked before serving
The system SHALL compare the database schema version with the schema version the running build expects. The instance MUST refuse to serve traffic when the database is behind the build, ahead of the build, or uninitialized.

#### Scenario: Schema versions match
- **WHEN** the database schema version equals the version expected by the build
- **THEN** startup completes and the instance becomes ready to serve requests

#### Scenario: Database is behind
- **WHEN** the database schema version is older than the version expected by the build
- **THEN** startup fails
- **AND** the error states both versions and instructs the operator to run migrations
- **AND** the instance does not serve requests

#### Scenario: Database is ahead
- **WHEN** the database schema version is newer than the version expected by the build
- **THEN** startup fails
- **AND** the error states both versions and identifies the build as outdated
- **AND** the instance does not serve requests

#### Scenario: Database is uninitialized
- **WHEN** no schema version record exists
- **THEN** startup fails
- **AND** the error instructs the operator to run migrations

### Requirement: Health check database probes are bounded
The system SHALL bound database probes with a timeout so that an unresponsive database cannot make health checks hang.

#### Scenario: Database hangs
- **WHEN** the database accepts a connection but does not answer the probe
- **THEN** the readiness probe returns HTTP 503 after the configured timeout
- **AND** the failure is recorded in the application log
