# Tasks

## 1. Database Migrations

- [x] 1.1 Create warehouses table migration with name (unique), location (optional), description (optional), and status fields
- [x] 1.2 Create inventory_items table migration with product_id, warehouse_id, and quantity fields, with foreign key constraints
- [ ] 1.3 Create location_prices table migration with product_id, warehouse_id, and price fields, with foreign key constraints
- [ ] 1.4 Add inventory-related columns to products table: inventory_status (text), inventory_items (json), and price_fallback (text)
- [ ] 1.5 Create data migration to initialize inventory items for all active products (default warehouse and quantity 1000)
- [ ] 1.6 Verify all migrations run successfully and data migration completes without errors

## 2. Inventory Module Implementation

- [ ] 2.1 Create inventory module with NestJS structure (controller, service, DTOs, entities)
- [ ] 2.2 Implement inventory entity mapping to inventory_items table with TypeORM decorators
- [ ] 2.3 Create warehouses service with CRUD operations including validation for unique names
- [ ] 2.4 Create inventory items service with validation for valid product and warehouse references
- [ ] 2.5 Implement availability calculation service that returns 'available', 'unavailable', or 'partially_available'
- [ ] 2.6 Write unit tests for availability calculation covering all three status cases

## 3. API Endpoints

- [ ] 3.1 Implement GET/POST/PUT/DELETE endpoints for warehouse management at /api/inventory/warehouses/*
- [ ] 2.2 Implement GET/POST/PUT/DELETE endpoints for inventory items at /api/inventory/products/*
- [ ] 3.3 Implement GET endpoint for product availability at /api/products/{id}/availability
- [ ] 3.4 Implement GET endpoint for product inventory details at /api/products/{id}/inventory
- [ ] 3.5 Update product detail endpoint to include inventory_status and inventory_items in response
- [ ] 3.6 Write integration tests for all new inventory API endpoints

## 4. Inventory Integration

- [ ] 4.1 Add inventory validation interceptor to checkout flow that checks inventory before processing
- [ ] 4.2 Implement error responses for unavailable products and missing warehouses in checkout
- [ ] 4.3 Add availability caching with configurable TTL for frequently accessed products
- [ ] 4.4 Write tests for inventory validation in checkout flow covering success and failure cases
- [ ] 4.5 Ensure product service properly handles inventory data for all operations (create, update, delete)

## 5. Admin Dashboard

- [ ] 5.1 Create inventory section in admin sidebar navigation
- [ ] 5.2 Build inventory management form for warehouse creation/editing with validation
- [ ] 5.3 Build inventory items management interface for product-warehouse inventory
- [ ] 5.4 Update product creation/editing form to include inventory configuration
- [ ] 5.5 Write ESM tests for inventory admin components (CRUD operations, validation)
- [ ] 5.6 Test admin inventory management flow end-to-end

## 6. Client Updates

- [ ] 6.1 Update product detail page to fetch and display inventory status
- [ ] 6.2 Add inventory validation check before checkout flow
- [ ] 6.3 Display inventory availability to users on product detail page
- [ ] 6.4 Test inventory display and validation in checkout flow
- [ ] 6.5 Ensure inventory data loads efficiently (pagination, caching where appropriate)

## Workflow follow-up

- Review the change against project guidelines
- Archive the change after verification