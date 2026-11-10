## Context

See `proposal.md` for motivation and scope. The database uses Prisma domain model files and an immutable, forward-only PostgreSQL migration stream. Each client has its own database, locale-specific catalog text uses `bn` and `en`, and media assets are stored separately from their binaries. The current migration stream ends at `20260105000000_orders_payments_shipping`.

## Goals / Non-Goals

**Goals:**

- Keep settings, content, and secret references consistent across client databases.
- Store localized page and banner content without coupling it to API, admin, or storefront code.
- Preserve integrity through unique constraints, foreign keys, and deletion rules.
- Keep secret material out of the schema and migration history.

**Non-Goals:**

- Define the secret manager, provider adapters, settings APIs, CMS editor, or rendering behavior.
- Enforce provider-specific configuration semantics or content-block structure in PostgreSQL.
- Seed client-specific configuration, placements, pages, or banners.

## Decisions

### 1. Store non-secret configuration separately from provider secret references

Use a `StoreSetting` record with a stable unique key, JSON value, and timestamps for non-secret configuration such as tax and provider options. Use a separate `ProviderSecretReference` record keyed by provider and credential name, containing only an opaque external reference and timestamps. Do not add a credential-value, encrypted-secret, webhook-payload, or raw-provider-configuration column.

- **Why:** Separate record shapes make the secret boundary explicit and prevent a credential from being mistaken for a supported value in the secret-reference model. It also keeps secret lifecycle and storage with the external secret manager.
- **Alternative:** Put a nullable value and reference in a generic key/value row. This is smaller but makes it easier for callers to put a credential into the generic value field and requires a cross-field invariant.
- A non-empty reference can be checked in the database, but PostgreSQL cannot confirm that a reference resolves or that arbitrary JSON contains no secret. Later settings APIs must validate allowed keys and never accept credential values; that API work is outside this change.

### 2. Separate page identity from locale-specific translations

Use a `CmsPage` parent and `CmsPageTranslation` rows with locale, slug, structured JSON content, optional SEO title/description, publication state, and timestamps. Enforce one translation per page and locale and unique slugs per locale. New translations default to `draft`.

- **Why:** Translation readiness and publication can vary by language, while the page identity remains stable. Locale-scoped slug uniqueness permits equivalent slugs in `bn` and `en`.
- **Alternative:** Store both languages in one JSON document. That weakens relational uniqueness and makes one-language edits and publication harder to query.
- The schema stores content JSON but does not prescribe or validate an editor-specific block format.

### 3. Model banners as localized records with optional media

Use `CmsBanner` for placement key, ordering, active state, optional media asset reference, and timestamps; store localized presentation and destination fields in `CmsBannerTranslation`. Use the existing media asset relation rather than storing image bytes or introducing an upload flow. Deleting a media asset clears its optional banner reference; deleting a page or banner cascades to its translation rows.

- **Why:** Placement and ordering are shared across locales, while text and destination content are localized. Optional media allows content to remain available if an asset is removed.
- **Alternative:** Store every locale and placement on one banner row. This duplicates shared metadata and makes partial translations awkward.

### 4. Keep persistence-only contracts in this change

The change adds schema, migration, database integration tests, and database documentation only. Stable setting keys and banner placement keys remain strings so later APIs can add configuration without a migration for each provider or placement. Database constraints enforce structural integrity; provider allow-lists, authorization, rendering, and content policy belong to later API/admin/storefront work.

- **Why:** This follows the database-first build order and avoids coupling migrations to application modules that are not part of this change.
- **Alternative:** Include CRUD endpoints or an editor now. That would cross the planned database/API/admin boundaries and require decisions about authorization and public delivery.

## Risks / Trade-offs

- **Opaque secret references can be invalid or stale** → later settings APIs must validate the allowed reference format and resolve references only through the configured secret manager; the database stores no secret values.
- **Generic JSON settings and CMS content cannot be semantically validated by relational constraints** → database checks enforce record shape and uniqueness; later API contracts validate supported keys and content structure.
- **Deleting media can leave a banner without an image** → the banner remains intact and its nullable media reference is cleared; later admin UX can identify the missing asset.
- **Publishing one locale does not publish another** → publication state belongs to the translation row and is tested independently for each locale.
- **Schema changes are forward-only** → deploy by snapshotting, applying the migration, and verifying the schema version; recover by restoring the pre-migration snapshot, not by editing an applied migration.

## Migration Plan

1. Add Prisma models in domain files for settings and CMS content while preserving existing relations and generator configuration.
2. Add one migration after `20260105000000_orders_payments_shipping`, provisionally named `20260106000000_settings_cms`; create locale/status enums, tables, checks, indexes, and foreign keys in dependency order.
3. Generate and validate the Prisma client and expected schema version; run integration tests against PostgreSQL, including migration from an empty database.
4. Document the tables, secret-reference boundary, localization, and deletion behavior in `packages/database/README.md`.
5. Deploy the migration before any later application release that uses these tables. No data backfill or seed is required.

## Open Questions

None. Concrete setting keys and banner placement names can be established by later API/admin work without changing this schema contract.
