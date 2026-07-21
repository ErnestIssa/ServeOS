-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ModifierGroupLifecycle" AS ENUM ('ACTIVE', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "ModifierGroup" ADD COLUMN IF NOT EXISTS "lifecycle" "ModifierGroupLifecycle" NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX IF NOT EXISTS "ModifierGroup_lifecycle_idx" ON "ModifierGroup"("lifecycle");
