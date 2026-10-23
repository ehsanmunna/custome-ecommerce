-- Expose the newest successfully applied migration as the schema version.
-- The ledger itself belongs to Prisma; this view is the only public contract
-- other packages should depend on.
CREATE VIEW schema_version AS
SELECT
  migration_name AS version,
  checksum,
  finished_at
FROM _prisma_migrations
WHERE finished_at IS NOT NULL
ORDER BY migration_name DESC
LIMIT 1;
