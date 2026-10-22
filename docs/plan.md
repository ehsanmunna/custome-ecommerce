# Custom E-commerce Platform: Implementation Plan

Build order: Database → API → Admin Dashboard → Storefront

## Phase 0: Foundation
1. Create the monorepo, NestJS project, PostgreSQL, migration tool and environment config.
2. Set up API versioning (`/v1`) and CI with lint and tests.
3. Write the per-client deployment template: VPS API, client Vercel/Cloudflare, and a staging environment.

## Phase 1: Database
4. Core tables: users, roles, customers, addresses, categories, products, variants and inventory.
5. Order-side tables: carts, orders, order items, status history, payments, shipments and settings.
6. Bangla/English translation support, with flexible JSONB attributes for variants.
7. Seed data, an audit-log table, and tested migration and rollback scripts for the super-admin.

## Phase 2: API
8. Admin auth and role permissions (owner, manager, staff, support).
9. Media uploads to the client's Cloudflare R2.
10. Catalog: categories, products, flexible attributes, bn/en translations and DB-query search.
11. Inventory: single location, stock adjustments and low-stock flags.
12. Customer auth: phone OTP and email.
13. Cart and checkout.
14. Order lifecycle: admin/manager transitions, history and rules.
15. COD payment.
16. bKash payment.
17. ShurjoPay payment.
18. Steadfast courier: create parcel and handle status webhooks.
19. SMS and email notifications (choose providers before starting this step).
20. Analytics endpoints for the dashboard.
21. Hardening: tests for critical flows, OpenAPI docs, v1 freeze and migration tooling.

**Milestone 1:** The full API works and is testable without any UI.

## Phase 3: Admin Dashboard
22. App shell, login, role-based menus and permission guards.
23. Product, category, variant and media management.
24. Inventory and stock screens.
25. Orders: list, filters, status changes and courier booking.
26. Customers, staff and roles.
27. Settings: payment, courier and notification keys.
28. Analytics dashboard.
29. Polish, bn/en labels and bug fixing.

**Milestone 2:** A client can run the business from the admin panel.

## Phase 4: Reference Storefront
30. Layout, theming tokens, SSR and SEO basics (meta tags, sitemap, structured data).
31. Home, category and product pages.
32. Search.
33. Cart and checkout.
34. Payment flows: COD, bKash and ShurjoPay.
35. Login, account, order history and tracking.
36. Language switch.
37. Performance and mobile polish.

This is the starter template. Each new client storefront is a reskin or extension of it, and any API change a client needs becomes a new API version.

## Phase 5: Launch Readiness
38. Staging deploy on the client's accounts.
39. End-to-end tests of every order and payment path.
40. Security pass: OTP rate limits, webhook signature checks and role checks.
41. Backups.
42. UAT with the first client.
43. Production go-live and a handover doc.

## Risks and Ways to Shorten
- **Payment gateways (items 16-17)** are the most likely to slip, because sandbox approval and docs can take time. Apply for bKash and ShurjoPay merchant access at the start.
- **To shorten the plan**, cut ShurjoPay (17) and analytics (20, 28) from v1 and add them in v1.1.
