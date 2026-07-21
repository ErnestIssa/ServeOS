-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ModifierOptionLifecycle" AS ENUM ('ACTIVE', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "ModifierOption" ADD COLUMN IF NOT EXISTS "lifecycle" "ModifierOptionLifecycle" NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX IF NOT EXISTS "ModifierOption_lifecycle_idx" ON "ModifierOption"("lifecycle");
