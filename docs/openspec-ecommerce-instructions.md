# Custom E-commerce Platform: OpenSpec Instructions

A working guide for building the platform with spec-driven development using
[OpenSpec](https://github.com/Fission-AI/OpenSpec). It contains:

1. Setup steps
2. A ready-to-paste `openspec/project.md`
3. The list of capabilities (specs)
4. An ordered change plan (Database, API, Admin, Storefront)
5. Spec writing rules with an example
6. Prompts to give your AI assistant at each stage
7. Open decisions to settle before they block a spec

> Slash command names differ between AI tools (`/openspec:proposal`,
> `/openspec-proposal`, and so on). Run `openspec update` after upgrading to
> regenerate them, or just ask in plain language ("create an OpenSpec proposal
> for ..."). Check the OpenSpec README for the current commands.

---

## 1. Setup

```bash
npm install -g @fission-ai/openspec@latest
cd ecommerce-core          # the monorepo root
openspec init              # choose your AI tool when prompted
```

Expected structure:

```
openspec/
  project.md               # project conventions (section 2)
  specs/                   # current truth, one folder per capability
    <capability>/spec.md
  changes/                 # proposed work, one folder per change
    <change-id>/
      proposal.md          # why and what
      design.md            # technical approach (only when needed)
      tasks.md             # implementation checklist
      specs/<capability>/spec.md   # deltas: ADDED / MODIFIED / REMOVED
    archive/               # finished changes
```

Core workflow:

1. **Propose:** create `changes/<change-id>/` with proposal, tasks, and spec deltas.
2. **Review:** you read and edit the proposal and deltas until you agree.
3. **Apply:** the AI implements `tasks.md` step by step.
4. **Archive:** the deltas merge into `openspec/specs/`, and the change moves to `archive/`.

Useful commands:

```bash
openspec list                         # active changes
openspec list --specs                 # existing capability specs
openspec show <change-id>             # view a change
openspec validate <change-id> --strict
openspec archive <change-id> --yes    # merge deltas into specs
```

---

## 2. `openspec/project.md` (paste this)

```markdown
# Project: Custom E-commerce Platform

## Purpose
A reusable e-commerce platform for multiple clients. Every client gets the
same backend API, the same database schema, and the same admin panel design.
Each client gets their own storefront and their own database.

## Architecture
- Headless: storefronts talk to the API only.
- One codebase for API, schema, and admin. Deployed once per client.
- Per client: separate database, separate `.env`, separate storefront repo.
- Monorepo (`ecommerce-core`): `apps/api`, `apps/admin`,
  `apps/storefront-starter`, `packages/api-sdk`, `packages/shared-types`,
  `migrations`, `docker`.

## Tech stack
- API: NestJS (TypeScript), modular, REST + OpenAPI
- Database: PostgreSQL (one database per client), migrations as the only way
  to change schema
- Admin: Angular
- Storefront: SSR framework per client (SEO required), built from the starter
- Media: Cloudflare R2 in the CLIENT's own Cloudflare account
- Hosting: API on a shared VPS (container per client); storefront and admin on
  the client's Vercel/Cloudflare account; PostgreSQL location per client
  (see open decisions)

## Hard rules
1. Schema and API code are identical for all clients. Never fork per client.
2. Client differences go through, in this order: config/feature flag,
   `metadata` JSONB custom fields, storefront-only change, adapter, then a
   core feature behind a flag.
3. Schema changes only through migrations. Never edit a client DB by hand.
4. All providers (payment, courier, SMS, email, storage) sit behind adapter
   interfaces. Credentials are per client and never committed.
5. Checkout always re-checks price and stock from the database.
6. Money is BDT only, stored as integer poisha (or numeric(12,2); pick one
   and use it everywhere).
7. User-facing text fields are translatable (Bangla `bn`, English `en`).
8. The API is versioned (`/v1`). Additive changes stay in the current
   version. Breaking changes need a new version. Critical changes must have
   contract tests and run on staging first.
9. No caching layer for now. Do not add Redis or search caching.

## Domain decisions (v1)
- Product variants: unstructured attributes (JSONB), with attribute
  definitions per category so the admin form and filters stay consistent.
  Example: clothes have color and size; diapers have weight range and pack size.
- Inventory: single location, stock per variant, reservations, and a
  stock-movements ledger.
- Order statuses: Pending, Confirmed, Processing, Shipped, Delivered,
  Cancelled, Returned, Partially delivered. Only owner and manager can change
  status. COD orders start as Pending until confirmed by phone.
- Customers: login by phone OTP and by email; guest checkout allowed.
- Admin roles: owner, manager, staff, support. A separate platform role
  (tech-admin / super-admin) runs migrations and rollbacks and is audit-logged.
- Payments: COD, bKash, ShurjoPay.
- Courier: Steadfast.
- Search: PostgreSQL queries with indexes (full-text plus trigram). No external
  search engine in v1.
- Delivery charge: flat rate by zone (inside Dhaka / outside Dhaka).
- Tax: single tax-rate setting, prices tax-inclusive.
- Coupons: percentage or fixed, min order, expiry, usage limit, no stacking.
- Staging environment for every client.

## Conventions
- Capability names: kebab-case (`catalog`, `inventory`, `orders`).
- Change IDs: verb-led kebab-case (`add-catalog-schema`).
- Every requirement has at least one scenario.
- Tests: contract tests against the OpenAPI spec; integration tests for the
  checkout and stock-reservation flow.
```

---

## 3. Capabilities (one `openspec/specs/<name>/spec.md` each)

| Capability | Covers |
|---|---|
| `platform-config` | Settings, feature flags, tenant `.env`, `schema_version` check, health checks |
| `auth-customers` | Phone OTP and email login, guest checkout, addresses, OTP rate limits |
| `auth-admin` | Admin users, roles (owner/manager/staff/support), permissions, tech-admin role, audit log; API endpoints `GET/POST/PATCH/DELETE /admin/roles` and `GET /admin/permissions` implemented via `add-admin-roles-endpoint` |
| `catalog` | Products, categories, brands, attribute definitions, variants, SEO fields, translations |
| `media` | Image upload (R2), variants/resizing, key-based URLs |
| `inventory` | Stock per variant, reservations, movements ledger, adjustments, low-stock alerts |
| `pricing-promotions` | Prices, tax setting, coupons |
| `cart-checkout` | Guest and user carts, delivery charge by zone, order creation |
| `orders` | Statuses, transitions and permissions, status history, returns |
| `payments` | Adapter interface, COD, bKash, ShurjoPay, payment status |
| `shipping` | Adapter interface, Steadfast, shipment tracking |
| `notifications` | SMS and email adapters, templates (bn/en), OTP messages |
| `cms-lite` | Banners, pages, menus |
| `reporting` | Admin dashboard metrics |
| `api-versioning` | Version rules, contract tests, staging release flow |
| `provisioning` | `create-client` script, migrate and seed, backups |

---

## 4. Change plan (in your preferred order)

Create one OpenSpec change per row. Finish and archive each before starting
the next, except where noted.

### Phase 1: Database

| # | Change ID | Result |
|---|---|---|
| 1 | `setup-monorepo-and-migrations` | Monorepo, migration tool, Docker Postgres, `schema_version` check |
| 2 | `add-core-schema-catalog` | Categories, products, attribute definitions, variants, translations, media table |
| 3 | `add-core-schema-inventory` | Inventory items, reservations, stock movements |
| 4 | `add-core-schema-customers-auth` | Customers, addresses, OTP table, admin users, roles, permissions |
| 5 | `add-core-schema-orders-payments-shipping` | Carts, orders, items, status history, payments, shipments, returns, coupons, shipping zones |
| 6 | `add-core-schema-settings-cms` | Settings, feature flags, banners, pages, menus, audit log |
| 7 | `add-seed-script` | Default roles, settings, admin user, zones |

### Phase 2: API

| # | Change ID | Result |
|---|---|---|
| 8 | `define-openapi-contract` | OpenAPI spec first, SDK generation |
| 9 | `add-auth-api` | Customer OTP and email login, admin login, RBAC guards |
| 10 | `add-admin-roles-endpoint` | `GET/POST/PATCH/DELETE /admin/roles` and `GET /admin/permissions` API endpoints with role-based access control |
| 11 | `add-catalog-api` | Catalog CRUD, search and filters |
| 12 | `add-media-api` | Presigned uploads to R2, resize job |
| 13 | `add-inventory-api` | `reserve`, `release`, `deduct`, `adjust` service interface |
| 14 | `add-cart-checkout-api` | Cart, delivery charge, order placement (COD first) |
| 15 | `add-orders-api` | Status transitions with permissions, history, returns |
| 16 | `add-payment-adapters` | bKash, ShurjoPay |
| 17 | `add-steadfast-shipping-adapter` | Create shipment, track status |
| 18 | `add-notification-adapters` | SMS and email adapters, bn/en templates |
| 19 | `add-checkout-vertical-slice-tests` | End-to-end: product, cart, COD order, stock change |

### Phase 3: Admin dashboard

| # | Change ID | Result |
|---|---|---|
| 19 | `add-admin-shell-and-auth` | Angular shell, login, role-based menus, white-label config |
| 20 | `add-admin-catalog-and-inventory` | Product forms driven by attribute definitions, stock screens |
| 21 | `add-admin-orders` | Order list, confirmation flow, status changes, returns |
| 22 | `add-admin-settings-and-cms` | Settings, zones, coupons, banners, pages |
| 23 | `add-admin-dashboard-reports` | Sales, orders, low stock |

### Phase 4: Storefront

| # | Change ID | Result |
|---|---|---|
| 24 | `add-storefront-starter` | SSR starter: products, cart, checkout, OTP login, SEO |
| 25 | `add-first-client-storefront` | First client's design on top of the starter |

### Phase 5: Operations

| # | Change ID | Result |
|---|---|---|
| 26 | `add-provisioning-cli` | `create-client`: create DB, migrate, seed, deploy |
| 27 | `add-backups-and-monitoring` | Nightly `pg_dump` to the client's R2, error monitoring |

---

## 5. Spec writing rules

- One capability per `spec.md`. Requirements use **SHALL / MUST**.
- Each requirement has at least one `#### Scenario:` with WHEN / THEN.
- Deltas in a change use `## ADDED Requirements`, `## MODIFIED Requirements`,
  or `## REMOVED Requirements`. Do not put the whole spec in a delta; include
  only what changes.
- Describe behavior, not implementation. Put "how" in `design.md`.
- Add `design.md` only for cross-cutting or risky changes (checkout,
  reservations, migrations, adapters).

### Example: `changes/add-inventory-api/specs/inventory/spec.md`

```markdown
## ADDED Requirements

### Requirement: Stock reservation at order placement
The system SHALL reserve stock for each order item when an order is placed,
and SHALL NOT reserve stock when an item is only added to a cart.

#### Scenario: Enough stock
- **WHEN** a customer places an order for 2 units of a variant with 5 in stock
- **THEN** the order is created
- **AND** 2 units are reserved
- **AND** a stock movement of type `reservation` is recorded

#### Scenario: Not enough stock
- **WHEN** a customer places an order for 3 units of a variant with 2 in stock
- **THEN** the order is rejected with an "insufficient stock" error
- **AND** no stock is reserved

### Requirement: Release on cancellation
The system SHALL release reserved stock when an order is cancelled.

#### Scenario: Cancel a pending order
- **WHEN** a manager cancels a pending order with reserved stock
- **THEN** the reserved units return to available stock
- **AND** a stock movement of type `release` is recorded
```

### Example: `proposal.md`

```markdown
# Change: Add inventory API

## Why
Checkout must reserve and deduct stock safely in the same transaction as order
creation.

## What Changes
- Add `reserve`, `release`, `deduct`, and `adjust` operations
- Add stock movement ledger writes on every change
- Emit `stock.low` and `stock.updated` events

## Impact
- Affected specs: inventory, cart-checkout
- Affected code: apps/api/src/inventory, apps/api/src/orders
```

### Example: `tasks.md`

```markdown
## 1. Implementation
- [ ] 1.1 Add inventory service with reserve/release/deduct/adjust
- [ ] 1.2 Write movements in the same transaction as stock changes
- [ ] 1.3 Expose admin adjustment endpoint (owner, manager only)
- [ ] 1.4 Emit stock events
- [ ] 1.5 Integration tests: concurrent orders on the last unit
- [ ] 1.6 Update OpenAPI and regenerate SDK
```

---

## 6. Prompts for your AI assistant

**Fill in the project file (once):**

> Read `openspec/project.md` and the instructions in
> `openspec-ecommerce-instructions.md`. Fix inconsistencies and list anything
> missing before we write specs.

**Create the capability specs (once):**

> Using section 3 of `openspec-ecommerce-instructions.md`, create an OpenSpec
> proposal for the first change in the plan. Draft requirements with scenarios
> for each capability it touches. Do not write code.

**Propose a change:**

> Create an OpenSpec proposal for `<change-id>` from section 4 of
> `openspec-ecommerce-instructions.md`. Follow `openspec/project.md`. Include
> spec deltas with scenarios, a `tasks.md`, and a `design.md` only if the
> change is risky or cross-cutting.

**Review before coding:**

> Run `openspec validate <change-id> --strict` and check the deltas against the
> hard rules in `project.md`. List conflicts, missing scenarios, and anything
> that would break the "same schema, same API for every client" rule.

**Apply:**

> Implement `<change-id>` task by task from `tasks.md`. Mark each task done,
> run the tests, and stop if a task needs a decision that is not in the specs.

**Archive:**

> Archive `<change-id>` and confirm that `openspec/specs/` now contains the
> merged requirements.

**Client request check:**

> A client asks for `<request>`. Using the hard rules in `project.md`, decide
> whether it is config, custom field, storefront-only, adapter, or core feature,
> and whether it needs a new API version. Then create a proposal if needed.

---

## 7. Definition of done for any change

- [ ] Spec deltas validated (`openspec validate <change-id> --strict`)
- [ ] Every requirement has a scenario, and each scenario has a test
- [ ] Migrations run cleanly on a fresh DB and on a copy of an existing client DB
- [ ] OpenAPI updated and SDK regenerated
- [ ] No client-specific code added to core
- [ ] Verified on staging before any client production deploy
- [ ] Change archived so `openspec/specs/` stays the source of truth

---

## 8. Open decisions (settle before the specs that depend on them)

| Decision | Needed before | Current default |
|---|---|---|
| API version rule: only breaking changes create a new version, or every client request | `define-openapi-contract` | Breaking changes only |
| PostgreSQL location: client-managed Postgres, or on the shared VPS | First deployment (`add-provisioning-cli`) | Postgres on the VPS, separate DB per client; Neon paid if the client wants managed |
| SMS provider (Bangladesh gateway) | `add-notification-adapters` | One provider via adapter, client's own account |
| Email provider | `add-notification-adapters` | One provider via adapter, client's own domain (SPF/DKIM/DMARC) |
| ORM / migration tool (TypeORM or Prisma) | `setup-monorepo-and-migrations` | Not chosen |
| Money storage: integer poisha or `numeric(12,2)` | `add-core-schema-catalog` | Not chosen |
| Commercial model, support terms, data/legal terms | First paying client | Not defined |
