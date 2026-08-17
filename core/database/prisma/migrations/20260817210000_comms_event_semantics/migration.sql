-- Occurrence UUID vs business idempotency, session-scoped table rooms, protected staff channels.

ALTER TABLE "ChatRoom" ADD COLUMN IF NOT EXISTS "isSystemChannel" BOOLEAN NOT NULL DEFAULT false;
UPDATE "ChatRoom"
SET "isSystemChannel" = true
WHERE type = 'STAFF' AND "channelKey" IS NOT NULL;

-- Table rooms are per QR session, not per physical table forever.
DROP INDEX IF EXISTS "ChatRoom_restaurantId_tableId_key";

-- If two OPEN TABLE rooms share restaurant+table without a session, keep the newest and resolve the rest.
UPDATE "ChatRoom" AS older
SET lifecycle = 'RESOLVED',
    "resolvedAt" = COALESCE(older."resolvedAt", NOW())
WHERE older.type = 'TABLE'
  AND older.lifecycle = 'OPEN'
  AND older."sourceSessionId" IS NULL
  AND EXISTS (
    SELECT 1 FROM "ChatRoom" AS newer
    WHERE newer.type = 'TABLE'
      AND newer."restaurantId" = older."restaurantId"
      AND newer."tableId" IS NOT DISTINCT FROM older."tableId"
      AND newer.id <> older.id
      AND COALESCE(newer."lastMessageAt", newer."createdAt") > COALESCE(older."lastMessageAt", older."createdAt")
  );

CREATE UNIQUE INDEX IF NOT EXISTS "ChatRoom_table_session_key"
  ON "ChatRoom"("restaurantId", "tableId", "sourceSessionId")
  WHERE type = 'TABLE' AND "tableId" IS NOT NULL AND "sourceSessionId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "ChatRoom_restaurantId_tableId_idx"
  ON "ChatRoom"("restaurantId", "tableId");

ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
DROP INDEX IF EXISTS "Notification_userId_idempotencyKey_key";
DELETE FROM "Notification" a
USING "Notification" b
WHERE a."idempotencyKey" IS NOT NULL
  AND a."userId" = b."userId"
  AND a."idempotencyKey" = b."idempotencyKey"
  AND a."createdAt" > b."createdAt";
CREATE UNIQUE INDEX IF NOT EXISTS "Notification_userId_idempotencyKey_key"
  ON "Notification"("userId", "idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;

ALTER TABLE "ProcessedDomainEvent" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "ProcessedDomainEvent" ADD COLUMN IF NOT EXISTS "schemaVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ProcessedDomainEvent" ADD COLUMN IF NOT EXISTS "aggregateVersion" INTEGER;
ALTER TABLE "ProcessedDomainEvent" ADD COLUMN IF NOT EXISTS "correlationId" TEXT;
ALTER TABLE "ProcessedDomainEvent" ADD COLUMN IF NOT EXISTS "causationId" TEXT;

DROP INDEX IF EXISTS "ProcessedDomainEvent_idempotencyKey_projection_key";
DELETE FROM "ProcessedDomainEvent" a
USING "ProcessedDomainEvent" b
WHERE a."idempotencyKey" IS NOT NULL
  AND a."idempotencyKey" = b."idempotencyKey"
  AND a.projection = b.projection
  AND a."processedAt" > b."processedAt";
CREATE UNIQUE INDEX IF NOT EXISTS "ProcessedDomainEvent_idempotencyKey_projection_key"
  ON "ProcessedDomainEvent"("idempotencyKey", "projection")
  WHERE "idempotencyKey" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "ProcessedDomainEvent_correlationId_idx"
  ON "ProcessedDomainEvent"("correlationId");
