-- AlterTable
ALTER TABLE "StoredMedia" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StoredMedia" ADD COLUMN "durationMs" INTEGER;

-- CreateIndex
CREATE INDEX "StoredMedia_menuItemId_scope_sortOrder_idx" ON "StoredMedia"("menuItemId", "scope", "sortOrder");
