-- Allow multiple menu items to reference the same storage object (duplicate media = new DB row, same S3 key).
-- Non-item media (menuItemId NULL) remains unique per objectKey via partial unique index.

DROP INDEX IF EXISTS "StoredMedia_objectKey_key";

CREATE INDEX IF NOT EXISTS "StoredMedia_objectKey_idx" ON "StoredMedia"("objectKey");

-- Postgres treats NULLs as distinct in unique constraints, so (objectKey, NULL) can repeat.
-- Enforce single non-item row per objectKey:
CREATE UNIQUE INDEX IF NOT EXISTS "StoredMedia_objectKey_no_item_key"
  ON "StoredMedia"("objectKey")
  WHERE "menuItemId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "StoredMedia_objectKey_menuItemId_key"
  ON "StoredMedia"("objectKey", "menuItemId")
  WHERE "menuItemId" IS NOT NULL;
