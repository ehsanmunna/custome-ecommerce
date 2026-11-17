-- Reconcile the admin permission catalog with the enforced API contract.
--
-- The catalog is the set of permission keys required by protected admin
-- operations, plus the reserved notification-administration keys. This
-- migration is idempotent so it can run on fresh and drifted installations.

-- 1. Insert every canonical permission. Existing rows keep their current group.
INSERT INTO "admin_permissions" ("key", "group_key", "description")
VALUES
  ('admin.auth.logout', 'admin-auth', 'End the current admin session'),
  ('admin.auth.read', 'admin-auth', 'Read the current admin identity'),
  ('admin.users.read', 'admin-users', 'View administrators'),
  ('admin.users.create', 'admin-users', 'Create administrators'),
  ('admin.users.update', 'admin-users', 'Update administrators'),
  ('admin.users.disable', 'admin-users', 'Disable or enable administrators'),
  ('admin.roles.read', 'roles', 'View roles and permissions'),
  ('admin.roles.create', 'roles', 'Create roles'),
  ('admin.roles.update', 'roles', 'Update roles'),
  ('admin.roles.delete', 'roles', 'Delete roles'),
  ('customers.read', 'customers', 'View customer support records'),
  ('catalog.brands.read', 'catalog', 'View brands'),
  ('catalog.brands.create', 'catalog', 'Create brands'),
  ('catalog.brands.update', 'catalog', 'Update brands'),
  ('catalog.brands.delete', 'catalog', 'Delete brands'),
  ('catalog.categories.read', 'catalog', 'View categories'),
  ('catalog.categories.create', 'catalog', 'Create categories'),
  ('catalog.categories.update', 'catalog', 'Update categories'),
  ('catalog.categories.delete', 'catalog', 'Delete categories'),
  ('catalog.products.read', 'catalog', 'View products and variants'),
  ('catalog.products.create', 'catalog', 'Create products'),
  ('catalog.products.update', 'catalog', 'Update products and variants'),
  ('catalog.products.delete', 'catalog', 'Delete products'),
  ('image-storage.read', 'image-storage', 'Read stored images'),
  ('media.create', 'media', 'Upload media assets'),
  ('media.delete', 'media', 'Delete media assets'),
  ('inventory.read', 'inventory', 'View inventory and reservations'),
  ('inventory.adjust', 'inventory', 'Adjust inventory and reservations'),
  ('orders.read', 'orders', 'View orders'),
  ('orders.status.update', 'orders', 'Change order status'),
  ('orders.returns.read', 'orders', 'View return requests'),
  ('orders.returns.update', 'orders', 'Update return requests'),
  ('orders_manage', 'orders', 'Create a shipping parcel'),
  ('shipping.zones.read', 'shipping', 'View shipping zones'),
  ('shipping.zones.create', 'shipping', 'Create shipping zones'),
  ('shipping.zones.update', 'shipping', 'Update shipping zones'),
  ('shipping.zones.delete', 'shipping', 'Delete shipping zones'),
  ('promotions.coupons.read', 'promotions', 'View coupons'),
  ('promotions.coupons.create', 'promotions', 'Create coupons'),
  ('promotions.coupons.update', 'promotions', 'Update coupons'),
  ('promotions.coupons.delete', 'promotions', 'Delete coupons'),
  ('settings.read', 'settings', 'View store settings'),
  ('settings.update', 'settings', 'Update store settings'),
  ('cms.pages.read', 'cms', 'View CMS pages'),
  ('cms.pages.create', 'cms', 'Create CMS pages'),
  ('cms.pages.update', 'cms', 'Update CMS pages'),
  ('cms.pages.delete', 'cms', 'Delete CMS pages'),
  ('cms.banners.read', 'cms', 'View banners'),
  ('cms.banners.create', 'cms', 'Create banners'),
  ('cms.banners.update', 'cms', 'Update banners'),
  ('cms.banners.delete', 'cms', 'Delete banners'),
  ('notifications.read', 'notifications', 'View notifications'),
  ('notifications.test', 'notifications', 'Send test notifications'),
  ('analytics.read', 'analytics', 'View analytics')
ON CONFLICT ("key") DO NOTHING;

-- 2. Grant the newly required keys to the baseline roles. Existing grants are kept.
INSERT INTO "admin_role_permissions" ("role_id", "permission_id")
SELECT role_row."id", permission_row."id"
FROM "admin_roles" AS role_row
CROSS JOIN "admin_permissions" AS permission_row
WHERE role_row."key" IN ('owner', 'manager', 'staff')
  AND permission_row."key" = 'image-storage.read'
ON CONFLICT DO NOTHING;

INSERT INTO "admin_role_permissions" ("role_id", "permission_id")
SELECT role_row."id", permission_row."id"
FROM "admin_roles" AS role_row
CROSS JOIN "admin_permissions" AS permission_row
WHERE role_row."key" = 'owner'
  AND permission_row."key" = 'admin.users.disable'
ON CONFLICT DO NOTHING;

-- 3. Translate legacy broad grants held by custom roles. The legacy rows stay in
--    place so existing installations do not lose grants they still display.
WITH legacy_map (legacy_key, target_key) AS (
  VALUES
    ('catalog_read', 'catalog.brands.read'),
    ('catalog_read', 'catalog.categories.read'),
    ('catalog_read', 'catalog.products.read'),
    ('catalog_manage', 'catalog.brands.read'),
    ('catalog_manage', 'catalog.brands.create'),
    ('catalog_manage', 'catalog.brands.update'),
    ('catalog_manage', 'catalog.brands.delete'),
    ('catalog_manage', 'catalog.categories.read'),
    ('catalog_manage', 'catalog.categories.create'),
    ('catalog_manage', 'catalog.categories.update'),
    ('catalog_manage', 'catalog.categories.delete'),
    ('catalog_manage', 'catalog.products.read'),
    ('catalog_manage', 'catalog.products.create'),
    ('catalog_manage', 'catalog.products.update'),
    ('catalog_manage', 'catalog.products.delete'),
    ('media_read', 'image-storage.read'),
    ('media_manage', 'image-storage.read'),
    ('media_manage', 'media.create'),
    ('media_manage', 'media.delete'),
    ('inventory_read', 'inventory.read'),
    ('inventory_manage', 'inventory.read'),
    ('inventory_manage', 'inventory.adjust'),
    ('orders_read', 'orders.read'),
    ('orders_change_status', 'orders.read'),
    ('orders_change_status', 'orders.status.update'),
    ('customers_read', 'customers.read'),
    ('customers_manage', 'customers.read'),
    ('settings_read', 'settings.read'),
    ('settings_manage', 'settings.read'),
    ('settings_manage', 'settings.update'),
    ('roles_read', 'admin.roles.read'),
    ('roles_manage', 'admin.roles.read'),
    ('roles_manage', 'admin.roles.create'),
    ('roles_manage', 'admin.roles.update'),
    ('roles_manage', 'admin.roles.delete')
)
INSERT INTO "admin_role_permissions" ("role_id", "permission_id")
SELECT DISTINCT held."role_id", target."id"
FROM "admin_role_permissions" AS held
JOIN "admin_permissions" AS legacy ON legacy."id" = held."permission_id"
JOIN legacy_map ON legacy_map.legacy_key = legacy."key"
JOIN "admin_permissions" AS target ON target."key" = legacy_map.target_key
ON CONFLICT DO NOTHING;

-- 4. Remove keys that no protected operation and no console check enforces.
DELETE FROM "admin_role_permissions" AS grant_row
USING "admin_permissions" AS permission_row
WHERE grant_row."permission_id" = permission_row."id"
  AND permission_row."key" IN (
    'admin.users.delete',
    'media.read',
    'shipping.shipments.create',
    'shipping.shipments.read'
  );

DELETE FROM "admin_permissions"
WHERE "key" IN (
  'admin.users.delete',
  'media.read',
  'shipping.shipments.create',
  'shipping.shipments.read'
);
