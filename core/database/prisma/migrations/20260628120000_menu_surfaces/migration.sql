-- CreateEnum
CREATE TYPE "MenuStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Menu" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "surfaceKey" TEXT,
    "status" "MenuStatus" NOT NULL DEFAULT 'DRAFT',
    "activeVersionId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuVersion" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshot" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuVersion_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "MenuCategory" ADD COLUMN "menuId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Menu_activeVersionId_key" ON "Menu"("activeVersionId");

-- CreateIndex
CREATE INDEX "Menu_restaurantId_status_idx" ON "Menu"("restaurantId", "status");

-- CreateIndex
CREATE INDEX "Menu_restaurantId_sortOrder_idx" ON "Menu"("restaurantId", "sortOrder");

-- CreateIndex
CREATE INDEX "MenuVersion_menuId_idx" ON "MenuVersion"("menuId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuVersion_menuId_versionNumber_key" ON "MenuVersion"("menuId", "versionNumber");

-- CreateIndex
CREATE INDEX "MenuCategory_menuId_idx" ON "MenuCategory"("menuId");

-- AddForeignKey
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "MenuVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuVersion" ADD CONSTRAINT "MenuVersion_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuCategory" ADD CONSTRAINT "MenuCategory_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE SET NULL ON UPDATE CASCADE;
