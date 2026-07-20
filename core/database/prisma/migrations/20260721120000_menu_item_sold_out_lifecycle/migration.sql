-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "isSoldOut" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "MenuItemLifecycle" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "lifecycle" "MenuItemLifecycle" NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX IF NOT EXISTS "MenuItem_lifecycle_idx" ON "MenuItem"("lifecycle");
