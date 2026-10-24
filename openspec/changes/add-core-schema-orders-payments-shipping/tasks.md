## 1. Prisma schema

- [x] 1.1 Split `packages/database/prisma/schema.prisma` into a main file plus domain files under `prisma/models/`, keep `generator`/`datasource` in the main file, and configure the database package so Prisma loads the schema folder
- [x] 1.2 Run `prisma format`, `prisma validate`, and `prisma generate` after the split and confirm the existing catalog, inventory, customer, and admin models are still generated
- [x] 1.3 Add the cart enums and `Cart`/`CartItem` models with guest/customer ownership, status, positive quantity, variant uniqueness, and the deletion rules from `design.md`
- [x] 1.4 Add the order status enum and `Order` model with order number, optional customer/cart/coupon, contact and delivery snapshots, shipping zone, money totals, and timestamps
- [x] 1.5 Add the `OrderItem` and `OrderStatusHistory` models with product snapshots, line-total arithmetic, variant protection, typed history, and indexes
- [x] 1.6 Add the return status enum and `OrderReturn`/`OrderReturnItem` models with the header lifecycle, positive quantities, refund amounts, and same-order item relation
- [x] 1.7 Add the payment method/status enums and `Payment` model with order reference, positive amount, provider reference, lifecycle timestamps, and no secret/payload columns
- [x] 1.8 Add the courier/shipment status enums and `ShippingZone`, `ShippingZoneDistrict`, and `Shipment` models with flat fees, district uniqueness, tracking uniqueness, COD amount, and timestamps
- [x] 1.9 Add the coupon discount-type enum and `Coupon`/`CouponRedemption` models with normalized codes, value checks, validity/limits, one redemption per order, and deletion rules
- [x] 1.10 Add the reverse relations to existing customer, cart, variant, admin user, and order models, then run `prisma format` and `prisma validate`

## 2. Forward migration

- [x] 2.1 Create `packages/database/prisma/migrations/20260105000000_orders_payments_shipping/migration.sql`
- [x] 2.2 Create the PostgreSQL enums for cart status, order status, return status, payment method/status, courier, shipment status, and coupon discount type
- [x] 2.3 Create `carts` and `cart_items` with the required checks, unique cart/variant index, foreign keys, and lookup indexes
- [x] 2.4 Create `shipping_zones`, `shipping_zone_districts`, and `coupons` before the tables that reference them
- [x] 2.5 Create `orders` with unique order number and cart reference, contact/address snapshots, money checks, coupon/discount check, status, zone/fee reference, and indexes
- [x] 2.6 Create `order_items` and `order_status_history` with the quantity/price checks, unique variant per order, snapshot columns, and foreign keys
- [x] 2.7 Create `order_returns` and `order_return_items` with the status, quantity, refund checks, unique item per return, and delete rules
- [x] 2.8 Create the return-item validation trigger that rejects items from another order and cumulative quantities above the ordered quantity
- [x] 2.9 Create `payments` with method/status enums, positive amount, provider-reference partial unique index, and lifecycle timestamp checks
- [x] 2.10 Create `shipments` with the Steadfast courier, status, tracking-number partial unique index, non-negative COD amount, delivered-timestamp check, and order reference
- [x] 2.11 Create `coupon_redemptions` with the unique order index, coupon/customer references, and positive discount check
- [x] 2.12 Add the append-only `BEFORE UPDATE OR DELETE` trigger and trigger function for `order_status_history`
- [x] 2.13 Add all lookup indexes from `design.md`, including order listing, history, return, payment, shipment, coupon, and redemption indexes
- [x] 2.14 Confirm the SQL applies cleanly to an empty database with `pnpm --filter database db:migrate`
- [x] 2.15 Run `db:migrate` a second time, confirm it is a no-op, then confirm `db:status` and `schema_version` report the orders/payments/shipping migration
- [x] 2.16 Regenerate `src/expected-version.ts` and Prisma Client, and confirm the expected version names `20260105000000_orders_payments_shipping`

## 3. Integration tests

- [x] 3.1 Add `packages/database/test/integration/cart-checkout-schema.spec.ts` using the existing migration reset helper
- [x] 3.2 Test guest and customer carts, unknown customers, cart statuses, positive quantities, duplicate variants, unknown variants, and cart/variant deletion behavior
- [x] 3.3 Test cart-to-order linking, rejection of a second order from one cart, converted-cart reuse, and order snapshot immutability after cart changes
- [x] 3.4 Add `packages/database/test/integration/orders-payments-shipping-schema.spec.ts` covering order numbers, guest/registered contact rules, delivery snapshots, money totals, status defaulting, and unsupported values
- [x] 3.5 Test order items: snapshots, line-total arithmetic, duplicate variant rejection, unknown variant rejection, and product/variant delete restrictions
- [x] 3.6 Test order status history: initial row, transition recording, and rejection of updates/deletes by the trigger
- [x] 3.7 Test returns: default status, same-order enforcement, cumulative quantity cap, duplicate line rejection, refund/quantity checks, item cascade, and order-delete restriction
- [x] 3.8 Test payments: methods, statuses, positive amounts, multiple attempts, provider-reference uniqueness, missing lifecycle timestamps, and unsupported values
- [x] 3.9 Test shipping zones: unique codes, non-negative fees, one zone per district, zone deletion with mappings, order fee snapshots, and zone-delete restriction when used
- [x] 3.10 Test shipments: Steadfast courier, status defaulting, tracking uniqueness, COD bounds, delivered timestamp requirement, multiple shipments, and order-delete restriction
- [x] 3.11 Test coupons: code normalization/format, discount type/value bounds, validity windows, usage-limit bounds, redemption uniqueness per order, guest redemption, and delete restrictions
- [x] 3.12 Update `migrations.spec.ts` ledger assertions to include `20260105000000_orders_payments_shipping` and ensure later fixture migrations still sort after it
- [x] 3.13 Run `pnpm --filter database test:integration` against a fresh local database and fix every failing constraint test

## 4. Documentation and verification

- [x] 4.1 Document carts, order snapshots and totals, append-only history, returns, payments, shipping zones/shipments, coupons/redemptions, and deletion rules in `packages/database/README.md`
- [x] 4.2 Run `pnpm --filter database lint`, `pnpm --filter database typecheck`, and `pnpm --filter database test`
- [x] 4.3 Run a full fresh-database migration and the database integration suite one final time
- [x] 4.4 Run `openspec validate add-core-schema-orders-payments-shipping --strict`
- [x] 4.5 Confirm no API, admin, storefront, seed, provider, or notification code changed in this change
