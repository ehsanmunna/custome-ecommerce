## 1. Cart-checkout module foundation

- [ ] 1.1 Create the NestJS cart-checkout module, storefront controller, and service; register the module in `AppModule`
- [ ] 1.2 Add Zod request/response validation schemas and response mappers for cart, cart item, checkout request, and order shapes
- [ ] 1.3 Add deterministic money helpers for poisha arithmetic and total computation (subtotal, discount, delivery fee, tax, total)

## 2. Cart reads and line-item writes

- [ ] 2.1 Implement cart creation (guest and customer), cart retrieval with line items, and cart item add/update/remove
- [ ] 2.2 Enforce one line per variant, positive quantity, valid variant reference, and active cart status
- [ ] 2.3 Add unit tests for cart item validation, duplicate-variant rejection, and status transitions

## 3. Checkout flow

- [ ] 3.1 Implement transactional checkout: lock cart and variant inventory rows, re-check price and stock from the database, validate coupon and shipping zone
- [ ] 3.2 Implement order and order-item creation with snapshotted product/SKU/attributes/price and poisha totals; mark the cart `converted`
- [ ] 3.3 Reject checkout on insufficient stock, missing variant, already-converted cart, invalid coupon/zone, or missing required contact/delivery fields
- [ ] 3.4 Add service tests for sufficient/insufficient stock, duplicate checkout, coupon validity/limits, and zone fee resolution

## 4. Contract, SDK, and verification

- [ ] 4.1 Add the six cart/checkout operations to `x-implemented-operations` in `apps/api/openapi/openapi.yaml`
- [ ] 4.2 Add HTTP integration tests for public cart and checkout flows, validation errors, permission-free access, and rejected cases
- [ ] 4.3 Regenerate `packages/api-sdk` and run `pnpm contract:lint`, `pnpm contract:check`, `pnpm contract:test`, and `pnpm --filter api-sdk generate:check`
- [ ] 4.4 Run `pnpm --filter api test`, `pnpm --filter api lint`, and `pnpm --filter api typecheck`
