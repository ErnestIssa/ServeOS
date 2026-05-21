-- AlterTable
ALTER TABLE "ChatRoom" ADD COLUMN "lastMessageAt" TIMESTAMP(3),
ADD COLUMN "lastMessagePreview" TEXT,
ADD COLUMN "lastMessageSenderRole" TEXT,
ADD COLUMN "customerLastReadAt" TIMESTAMP(3),
ADD COLUMN "restaurantLastReadAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN "deliveredToVenueAt" TIMESTAMP(3);
