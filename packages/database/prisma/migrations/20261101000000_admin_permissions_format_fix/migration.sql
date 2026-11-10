-- Fix admin_permissions key and group_key format constraints to allow dots and hyphens

-- Drop existing constraints
ALTER TABLE "admin_permissions" DROP CONSTRAINT "admin_permissions_key_format";
ALTER TABLE "admin_permissions" DROP CONSTRAINT "admin_permissions_group_key_format";

-- Add new constraints allowing dots (.) in key and hyphens (-) in group_key
ALTER TABLE "admin_permissions" ADD CONSTRAINT "admin_permissions_key_format"
  CHECK ("key" ~ '^[a-z][a-z0-9_.-]*$');

ALTER TABLE "admin_permissions" ADD CONSTRAINT "admin_permissions_group_key_format"
  CHECK ("group_key" ~ '^[a-z][a-z0-9_.-]*$');