# Design

## Context

Current product model has a single availability status with no inventory tracking. Admin dashboard has basic product management. No warehouse concept exists. Inventory data is managed through a single product table field.

## Goals / Non-Goals

**Goals:**
- Implement inventory management system supporting multiple warehouses and inventory tracking
- Calculate product availability based on inventory status
- Expose inventory management API endpoints
- Integrate inventory checks into product detail and checkout flows

**Non-Goals:**
- Inventory auditing (audit trails for inventory changes)
- Inventory sync with external warehouses
- Bulk inventory operations (import/export)
- Inventory reports and analytics

## Decisions

**Decision: Warehouse model** → Create separate `warehouses` table rather than adding location fields to products.
- **Rationale**: Warehouses have their own identity (name, address, status) beyond product relationships. Separating them enables future expansion (warehouse-specific settings, separate inventory limits per warehouse).
- **Alternatives considered**: Adding location fields to products (would make inventory management complex and limit to single location), using product locations (insufficient for warehouse-specific settings and access control).

**Decision: Inventory as separate entity** → Inventory items link products to warehouses, not just a quantity field on products.
- **Rationale**: Multiple inventory records needed per product (one per warehouse). Centralizing inventory logic in a service rather than embedding it in product service.
- **Alternatives considered**: Storing inventory as nested product data (would require complex nested queries and updates).

**Decision: Availability calculation** → Implement as a service method called by checkout controller, not as a database trigger or computed column.
- **Rationale**: Calculation may involve external factors (e.g., geographic restrictions). Service layer provides flexibility for future extensions.
- **Alternatives considered**: Database trigger (harder to test), computed column (limits calculation complexity), API endpoint (adds latency to every product query).

**Decision: Inventory validation on checkout** → Validate inventory at checkout time, not at product availability endpoint.
- **Rationale**: Inventory may change between requests (concurrent updates). Checking at checkout ensures accuracy. Product availability endpoint can cache for performance.
- **Alternatives considered**: Real-time inventory checks on every product query (high load), pre-calculated availability (staging issues with concurrent inventory changes).

## Risks / Trade-offs

**Risk**: Inventory race conditions during concurrent updates
→ **Mitigation**: Use database row-level locking in inventory update operations; implement idempotent update tokens for client-side retry.

**Risk**: Inventory queries becoming expensive with many warehouses
→ **Mitigation**: Add database indexes on warehouse-product relationships; implement availability caching with configurable TTL.

**Risk**: Existing product data migration
→ **Mitigation**: Create migration to initialize inventory items for all active products with quantity 1000 at the "default" warehouse. Products without explicit inventory configuration can have a default inventory level.

**Risk**: Checkout performance degradation from inventory checks
→ **Mitigation**: Implement availability caching for products accessed frequently; consider Redis cache layer for high-traffic sites.

## Migration Plan

1. **Database migrations**:
   - Create `warehouses` table
   - Create `inventory_items` table with product_id and warehouse_id foreign keys
   - Create `location_prices` table for location-based pricing
   - Add inventory-related columns to products table (`inventory_status`, `inventory_items`, `price_fallback`)
   - Run data migration to initialize inventory items for existing products

2. **API layer**:
   - Create inventory module with warehouses service, inventory items service
   - Create availability calculation service
   - Add inventory validation interceptor to checkout flow
   - Update product service to include inventory status in responses
   - Add new API endpoints under `/api/inventory/` and update `/api/products/`

3. **Admin dashboard**:
   - Create inventory section in admin sidebar
   - Implement inventory management forms for warehouses and inventory items
   - Update product creation/editing to include inventory configuration

4. **Client updates**:
   - Update product detail page to check inventory status
   - Add inventory validation to checkout flow
   - Display inventory availability to users

## Open Questions

- Should inventory quantities be integers or decimals? (Decimals allow for fractional inventory, integers are simpler for UI)
- What happens to inventory on product deletion? (Should inventory be deleted too, or soft-deleted?)
- Should location-based pricing be limited to certain fields (e.g., price only) or applied to all product attributes?