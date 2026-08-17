-- ChatRoomType TABLE
DO $$ BEGIN
  ALTER TYPE "ChatRoomType" ADD VALUE 'TABLE';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ChatRoomLifecycle
DO $$ BEGIN
  CREATE TYPE "ChatRoomLifecycle" AS ENUM ('OPEN', 'RESOLVED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "ChatRoom" ADD COLUMN IF NOT EXISTS "sourceSessionId" TEXT;
ALTER TABLE "ChatRoom" ADD COLUMN IF NOT EXISTS "tableId" TEXT;
ALTER TABLE "ChatRoom" ADD COLUMN IF NOT EXISTS "tableLabel" TEXT;
ALTER TABLE "ChatRoom" ADD COLUMN IF NOT EXISTS "lifecycle" "ChatRoomLifecycle" NOT NULL DEFAULT 'OPEN';
ALTER TABLE "ChatRoom" ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3);

-- Legacy rooms have null tableId; allow many nulls via partial unique.
DROP INDEX IF EXISTS "ChatRoom_restaurantId_tableId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "ChatRoom_restaurantId_tableId_key"
  ON "ChatRoom"("restaurantId", "tableId")
  WHERE "tableId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "ChatRoom_restaurantId_lifecycle_idx" ON "ChatRoom"("restaurantId", "lifecycle");
CREATE INDEX IF NOT EXISTS "ChatRoom_sourceSessionId_idx" ON "ChatRoom"("sourceSessionId");

ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "clientMessageId" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "sourceEventId" TEXT;

-- Drop any non-partial uniques, then keep one row per non-null key.
DROP INDEX IF EXISTS "ChatMessage_chatRoomId_clientMessageId_key";
DELETE FROM "ChatMessage" a
USING "ChatMessage" b
WHERE a."clientMessageId" IS NOT NULL
  AND a."chatRoomId" = b."chatRoomId"
  AND a."clientMessageId" = b."clientMessageId"
  AND a."createdAt" > b."createdAt";
CREATE UNIQUE INDEX IF NOT EXISTS "ChatMessage_chatRoomId_clientMessageId_key"
  ON "ChatMessage"("chatRoomId", "clientMessageId")
  WHERE "clientMessageId" IS NOT NULL;

DROP INDEX IF EXISTS "ChatMessage_chatRoomId_sourceEventId_key";
DELETE FROM "ChatMessage" a
USING "ChatMessage" b
WHERE a."sourceEventId" IS NOT NULL
  AND a."chatRoomId" = b."chatRoomId"
  AND a."sourceEventId" = b."sourceEventId"
  AND a."createdAt" > b."createdAt";
CREATE UNIQUE INDEX IF NOT EXISTS "ChatMessage_chatRoomId_sourceEventId_key"
  ON "ChatMessage"("chatRoomId", "sourceEventId")
  WHERE "sourceEventId" IS NOT NULL;

ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "eventId" TEXT;
DROP INDEX IF EXISTS "Notification_userId_eventId_key";
DELETE FROM "Notification" a
USING "Notification" b
WHERE a."eventId" IS NOT NULL
  AND a."userId" = b."userId"
  AND a."eventId" = b."eventId"
  AND a."createdAt" > b."createdAt";
CREATE UNIQUE INDEX IF NOT EXISTS "Notification_userId_eventId_key"
  ON "Notification"("userId", "eventId")
  WHERE "eventId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Notification_eventId_idx" ON "Notification"("eventId");

CREATE TABLE IF NOT EXISTS "ProcessedDomainEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "restaurantId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "projection" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedDomainEvent_pkey" PRIMARY KEY ("id","projection")
);

CREATE INDEX IF NOT EXISTS "ProcessedDomainEvent_restaurantId_processedAt_idx" ON "ProcessedDomainEvent"("restaurantId", "processedAt");
CREATE INDEX IF NOT EXISTS "ProcessedDomainEvent_type_processedAt_idx" ON "ProcessedDomainEvent"("type", "processedAt");
