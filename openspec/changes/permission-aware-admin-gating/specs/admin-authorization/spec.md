# Spec Delta

## Purpose

Defines the permission catalog, baseline grants, and role-key contract that authorize the admin API and console, so the contract, seed data, and database agree on the same keys.

## ADDED Requirements

### Requirement: Canonical permission catalog

The permission catalog SHALL contain a key for every permission required by a protected admin API operation or checked by the admin console, and SHALL not retain seeded keys that no operation or console check enforces.

#### Scenario: Media read key is seeded

- **WHEN** protected media operations require `image-storage.read` and the catalog is seeded
- **THEN** the key exists in every environment and can be granted to a role

#### Scenario: Administrator disable key is restored

- **WHEN** an existing installation reseeds after the administrator-disable operation is deployed
- **THEN** `admin.users.disable` exists and the disable operation succeeds for an authorized role

#### Scenario: Orphan key is rejected

- **WHEN** a seeded key has no protected operation and no console check
- **THEN** the catalog consistency test fails unless the key is explicitly declared reserved

### Requirement: Baseline system-role grants

Baseline system roles SHALL receive explicit least-privilege grants using endpoint-level keys: owner receives every catalog key; manager receives operational keys without administrator or role administration; staff receives read-only catalog, media, inventory, and order keys; support receives read-only order and customer keys.

#### Scenario: Media access is consistent

- **WHEN** a baseline role can reach the media area
- **THEN** it holds `image-storage.read` and holds `media.create` or `media.delete` only when it may change media

#### Scenario: Administrator management is consistent

- **WHEN** a baseline role may update administrators
- **THEN** it also holds `admin.users.disable` and the disable action is available to it

#### Scenario: Grants are explicit

- **WHEN** a baseline role is seeded
- **THEN** every permission it receives is an explicit catalog key rather than a wildcard or legacy category name

### Requirement: Grant reconciliation on reseed

Reseeding an existing installation SHALL insert missing catalog entries, reconcile baseline system-role grants, translate known legacy broad grants for custom roles, and preserve unrelated custom-role grants.

#### Scenario: Drifted installation converges

- **WHEN** the database is missing a required key or a baseline grant and the seed runs
- **THEN** the catalog and baseline grants match the canonical source without manual edits

#### Scenario: Custom grants survive

- **WHEN** a custom role holds grants that are not part of the baseline definition
- **THEN** reseeding leaves those grants unchanged

#### Scenario: Repeated seed is idempotent

- **WHEN** the seed runs twice in succession
- **THEN** the catalog and grants after the second run equal the first run and no duplicate records are created

### Requirement: Role key format agreement

The admin API and console SHALL accept role keys in the same format enforced by the database constraint: lowercase, beginning with a letter, and containing only lowercase letters, digits, and underscores.

#### Scenario: Invalid key is a validation error

- **WHEN** an administrator submits a role key containing a hyphen, dot, uppercase letter, or leading digit
- **THEN** the API rejects it with a validation error instead of a server error

#### Scenario: Valid key is accepted

- **WHEN** an administrator submits a key such as `store_manager`
- **THEN** validation, the database constraint, and the console form all accept it

#### Scenario: Contracts share one rule

- **WHEN** the role-key rules are compared across the API, database constraint, and console form
- **THEN** they accept and reject the same examples
