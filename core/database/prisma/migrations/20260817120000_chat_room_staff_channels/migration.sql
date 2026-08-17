-- AlterTable
ALTER TABLE "ChatRoom" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "ChatRoom" ADD COLUMN IF NOT EXISTS "channelKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ChatRoom_restaurantId_channelKey_key" ON "ChatRoom"("restaurantId", "channelKey");
