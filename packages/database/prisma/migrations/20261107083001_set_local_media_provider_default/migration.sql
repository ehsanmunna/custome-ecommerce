-- Update default media provider to 'local'

ALTER TABLE "media_assets" ALTER COLUMN "provider" SET DEFAULT 'local';
