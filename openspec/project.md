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
