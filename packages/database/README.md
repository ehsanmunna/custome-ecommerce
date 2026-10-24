# database

Owns the Prisma schema, the ordered migration stream, and the generated Prisma client. Every client
database follows this exact stream.

Key paths:

- `prisma/schema.prisma` — datasource and generator.
- `prisma/models/` — domain model files loaded together by Prisma.
- `prisma/migrations/` — committed, immutable SQL migrations.
- `src/index.ts` — re-exports the generated client and `EXPECTED_SCHEMA_VERSION`.

The migration scripts read `MIGRATION_DATABASE_URL`. The API only ever reads `DATABASE_URL` (the
runtime identity, which cannot change schema).

## Client database seeding

After applying all migrations with `MIGRATION_DATABASE_URL`, run `pnpm db:seed` with the client
runtime `DATABASE_URL`. The seed command uses DML only and does not apply migrations. It creates the
store roles and baseline grants, conservative non-secret settings, and inactive zero-fee Dhaka and
outside-Dhaka shipping zones. Existing settings, zone fees, and active states are preserved.

For optional initial administrator bootstrap, provide both `SEED_ADMIN_EMAIL` (valid lowercase
email) and `SEED_ADMIN_PASSWORD` through the deployment environment when running the seed command.
The password is stored only as an Argon2id hash. `SEED_ADMIN_DISPLAY_NAME` is optional and defaults
to `Store Owner`. If no admin exists, the command creates an active owner account; if any admin
already exists, it leaves all accounts unchanged. Do not place bootstrap credentials in source
control or logs. If neither credential is set, baseline data is seeded without creating an admin;
setting only one credential is an error.

The command does not create a platform super-admin, assign shipping districts, or activate shipping
zones. Review and configure those client-specific values before enabling checkout.

## Catalog schema

The catalog migration adds these tables:

- `categories`, `category_translations`, `brands`, `brand_translations`
- `products`, `product_translations`, `product_variants`
- `attribute_definitions`
- `media_assets`, `media_alt_texts`, `product_media`

Rules to preserve in later changes:

- Money is stored as integer **poisha** (`price_poisha`, `compare_at_price_poisha`); never store taka
  or floating-point values.
- A product has exactly one primary `category_id`. Multi-category support needs a separate change.
- Category, brand, and product text lives in per-locale (`bn`, `en`) translation rows. Slugs are
  unique per entity type and locale.
- Variant attributes are JSONB and are validated against the product category's
  `attribute_definitions` by the API.
- Media rows store R2 provider keys and metadata, never binaries. A product has at most one primary
  image; category and brand image references are cleared when the media asset is deleted.

## Inventory schema

The inventory migration adds these tables:

- `inventory_items` — current balance per variant, keyed by `variant_id`.
- `stock_reservations` — individual holds with a status and an optional external reference.
- `stock_movements` — append-only ledger of every balance change.

Rules to preserve in later changes:

- Inventory is single-location. There is exactly one `inventory_items` row per variant and no location
  column; multi-location stock needs a separate change.
- `quantity_on_hand` and `quantity_reserved` are non-negative integers, and reserved never exceeds
  on-hand. Available stock is derived as `quantity_on_hand - quantity_reserved`. An item is low on
  stock when available is less than or equal to `low_stock_threshold`.
- Only `active` reservations count towards `quantity_reserved`. A reservation may reference a cart,
  order, or manual action through `reference_type` plus `reference_id`; there is no foreign key
  because carts and orders arrive in a later change.
- `stock_movements` is append-only at the database level. A trigger rejects updates and deletes, so
  corrections must be new compensating movements. Movement types and their allowed on-hand/reserved
  delta signs are enforced by `CHECK` constraints.
- A variant cannot be deleted while an inventory item, reservation, or movement exists. Archive the
  variant instead.
- The inventory API owns row locking (`SELECT ... FOR UPDATE`) and writes the counter, reservation, and
  movement in one transaction. The schema provides the backstop constraints, not the concurrency
  control.

## Customer and admin auth schema

The customers/auth migration adds these tables:

- `customers` - customer accounts with optional phone and email identities.
- `customer_addresses` - delivery addresses owned by a customer.
- `otp_codes` - hashed, expiring OTP records for customer login and verification.
- `admin_users` - staff accounts with exactly one role.
- `admin_roles` and `admin_permissions` - editable role and permission catalog.
- `admin_role_permissions` - permission grants per role.

Rules to preserve in later changes:

- A customer must have at least one identity: an E.164 `phone`, a lowercase `email`, or both. Unique
  constraints allow many customers to omit either column.
- Customer passwords are stored only as an opaque hash in `password_hash`, and only when an email is
  present. Phone-only accounts use OTP login. The API hashes with Argon2id; the database checks only
  non-emptiness and a minimum length.
- OTP `code_hash` values are opaque; raw codes are never stored. OTP records keep channel, purpose,
  destination, expiry, consumption/invalidation time, and attempt counts. SMS destinations must be
  E.164; email destinations must be lowercase. History is retained so the API can enforce issuance
  rate limits.
- Addresses require a recipient name, E.164 phone, address line 1, district, and division.
  `country_code` defaults to `BD`. At most one default shipping and one default billing address exist
  per customer; deleting a customer cascades their addresses.
- Each admin user has exactly one role. Emails are lowercase and unique, and passwords are opaque
  hashes.
- Role and permission keys are stable lowercase identifiers. Role scope is `store` or `platform`;
  super-admin is platform scope. System roles cannot be deleted. Deleting a custom role cascades its
  grants, while a permission still granted to a role cannot be deleted.
- Admin effective permissions are exactly the role's grants; there are no per-user overrides.

## Orders, payments, shipping, and coupon schema

The order-side migration adds these tables:

- `carts` and `cart_items` - guest or customer carts with one positive line per variant.
- `orders`, `order_items`, and `order_status_history` - immutable order snapshots, line items, and
  append-only lifecycle history.
- `order_returns` and `order_return_items` - return headers, returned quantities, and refund amounts.
- `payments` - cash-on-delivery and online payment attempts.
- `shipping_zones`, `shipping_zone_districts`, and `shipments` - flat delivery fees, district mapping,
  and Steadfast courier tracking.
- `coupons` and `coupon_redemptions` - coupon definitions and one redemption per order.

Rules to preserve in later changes:

- Money is integer **poisha**. Order totals follow
  `total = subtotal - discount + delivery_fee`; tax is the included portion of the subtotal and is never
  added again. All amounts are non-negative, discount and tax never exceed the subtotal, and a positive
  discount requires a coupon.
- Orders keep their own contact, delivery-address, product, and price snapshots. Catalog edits, customer
  address edits, zone fee changes, and cart changes must not rewrite an existing order.
- A cart may convert into at most one order (`orders.cart_id` is unique) and becomes `converted`. Guest
  carts and guest orders have no `customer_id`; deleting a customer keeps the order and clears the
  reference.
- `order_status_history` is append-only at the database level: a trigger rejects updates and deletes.
  Every order gets an initial row, and status changes are new rows.
- Orders cannot be deleted while items, status history, payments, shipments, returns, or redemptions
  exist. Cancellation and return statuses express the business outcome instead.
- Return items must reference an order item from the same order, cannot repeat within one return, and
  their cumulative quantity cannot exceed the ordered quantity. The trigger sums existing rows; the
  returns API still needs to serialize concurrent writes per order item.
- Payments are independent attempts: an order may have many. Provider references are unique per method
  when present, `paid` requires `paid_at`, refunded states require `refunded_at`, and `cancelled`
  requires `cancelled_at`. No credentials, raw payloads, card numbers, or CVV are stored.
- Delivery zones have unique codes and non-negative flat fees; each district maps to at most one zone.
  Orders keep the zone reference and the fee at placement, so a zone used by an order cannot be deleted.
- Shipments support the `steadfast` courier, default to `pending`, allow multiple rows per order, require
  `delivered_at` for `delivered`, and keep tracking numbers unique when present. A negative COD amount is
  rejected.
- Coupon codes are uppercase (`A-Z`, `0-9`, `_`, `-`) and unique. Percentage discounts are 1-100, fixed
  discounts are positive, and limits are positive when present. An order has at most one redemption, so
  coupons do not stack; usage limits are derived from redemption rows and must be enforced inside the
  checkout transaction.

## Store settings and CMS schema

The settings/CMS migration adds:

- `store_settings` — unique keys and structured JSON values for non-secret store configuration.
- `provider_secret_references` — unique provider/credential-name pairs containing only an opaque
  reference to externally managed secrets.
- `cms_pages` and `cms_page_translations` — page identity and locale-specific slug, title, structured
  content, SEO metadata, and publication state.
- `cms_banners` and `cms_banner_translations` — shared placement, ordering, active state, optional media
  reference, and locale-specific title, body, and destination URL.

Rules to preserve in later changes:

- Store setting values are reserved for non-secret configuration. The persistence schema has no
  provider credential-value column; provider credentials are kept outside PostgreSQL and represented
  only by secret references. Generic JSON cannot identify arbitrary secrets, so settings APIs must
  validate supported keys and values and never accept credential values.
- Provider/credential-name pairs are unique. The database verifies references are non-empty but does
  not resolve them; provider adapters must use the configured external secret manager.
- Page translations support the shared `bn` and `en` locales, are unique per page and locale, and have
  slugs unique within each locale. Publication state belongs to each translation and defaults to
  `draft`; publishing one locale does not publish another.
- Page content and store setting values are JSONB objects. SEO metadata is optional and localized with
  its page translation. The schema does not prescribe an editor-specific content-block format.
- Banners share their placement key, sort order, and active state across locales; translations are
  optional and unique per banner and locale. Banner media references an existing `media_assets` row;
  deleting that asset clears the reference but preserves the banner.
- Deleting a page or banner cascades to its translations. No default settings, pages, banner placements,
  or content are seeded by the migration.
