-- CreateEnum
CREATE TYPE "StoredMediaScope" AS ENUM (
  'PROFILE_IMAGE',
  'RESTAURANT_IMAGE',
  'MENU_IMAGE',
  'CHAT_IMAGE',
  'VIDEO',
  'PDF',
  'INVOICE',
  'DOCUMENT',
  'ATTACHMENT'
);

-- CreateEnum
CREATE TYPE "StoredMediaVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN "logoImageKey" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN "coverImageKey" TEXT;

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN "imageKey" TEXT;

-- CreateTable
CREATE TABLE "StoredMedia" (
    "id" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "scope" "StoredMediaScope" NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256Hex" TEXT,
    "visibility" "StoredMediaVisibility" NOT NULL DEFAULT 'PRIVATE',
    "originalName" TEXT,
    "uploadedById" TEXT,
    "restaurantId" TEXT,
    "userId" TEXT,
    "menuItemId" TEXT,
    "chatRoomId" TEXT,
    "chatMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoredMedia_objectKey_key" ON "StoredMedia"("objectKey");

-- CreateIndex
CREATE UNIQUE INDEX "StoredMedia_chatMessageId_key" ON "StoredMedia"("chatMessageId");

-- CreateIndex
CREATE INDEX "StoredMedia_restaurantId_scope_idx" ON "StoredMedia"("restaurantId", "scope");

-- CreateIndex
CREATE INDEX "StoredMedia_userId_idx" ON "StoredMedia"("userId");

-- CreateIndex
CREATE INDEX "StoredMedia_chatRoomId_idx" ON "StoredMedia"("chatRoomId");

-- AddForeignKey
ALTER TABLE "StoredMedia" ADD CONSTRAINT "StoredMedia_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredMedia" ADD CONSTRAINT "StoredMedia_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
