-- Reset the public schema for CI so migrations can be exercised from zero.
-- Roles are cluster-wide and are created separately by docker/initdb/01-roles.sql.
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public AUTHORIZATION current_user;
GRANT USAGE ON SCHEMA public TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
