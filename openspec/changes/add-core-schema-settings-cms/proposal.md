## Why

The platform needs a shared, migratable schema for store-wide configuration and reusable storefront content before settings APIs, admin screens, or CMS delivery can be built. A common model preserves the same behavior across client databases while keeping provider credentials outside the database.

## What Changes

- Add database models for store settings covering tax and payment, courier, and notification configuration. Store non-secret values and references to externally managed secrets, never credential values.
- Add localized CMS pages and banners with Bangla/English content, publish state, ordering, and page SEO metadata.
- Define integrity, uniqueness, validation, and deletion behavior for settings and CMS records.
- Add one forward migration, database integration tests, and schema documentation.

## Capabilities

### New Capabilities

- `store-settings`: Shared store configuration and external secret references.
- `cms-content`: Localized pages and banners with publication and SEO metadata.

### Modified Capabilities

- None.

## Non-goals

- Settings or CMS APIs, admin screens, storefront rendering, or authorization changes.
- Payment, courier, SMS, or email provider integrations; secret-manager implementation or secret values in PostgreSQL.
- Tax calculation, checkout changes, seeded defaults, media upload flows, or client-specific schema forks.
- Rich-text editing or a frontend block editor; the schema only defines persisted content and publishing metadata.

## Impact

- Affected specs: new `store-settings` and `cms-content` capabilities.
- Expected implementation scope: `packages/database` Prisma models, a forward-only PostgreSQL migration, integration tests, generated schema version, and README documentation.
- No new runtime dependency is expected. Existing databases must apply the migration before code that depends on these tables is deployed.
