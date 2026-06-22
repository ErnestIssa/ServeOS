-- Order Identity Rules: atomic tenant counter, session traceability, period-scoped display numbers.

ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "orderIdentityPolicy" JSONB;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "displayPeriodKey" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "sourceSessionId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "sourceSessionType" TEXT;

UPDATE "Order" SET "displayPeriodKey" = 'legacy' WHERE "displayPeriodKey" IS NULL;

CREATE TABLE IF NOT EXISTS "RestaurantOrderCounter" (
    "restaurantId" TEXT NOT NULL,
    "nextSeq" INTEGER NOT NULL DEFAULT 0,
    "periodKey" TEXT NOT NULL DEFAULT 'all',
    "periodStartSeq" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RestaurantOrderCounter_pkey" PRIMARY KEY ("restaurantId")
);

ALTER TABLE "RestaurantOrderCounter" ADD CONSTRAINT "RestaurantOrderCounter_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill counters from existing displaySeq maxima.
INSERT INTO "RestaurantOrderCounter" ("restaurantId", "nextSeq", "periodKey", "periodStartSeq", "updatedAt")
SELECT "restaurantId", COALESCE(MAX("displaySeq"), 0), 'legacy', 0, CURRENT_TIMESTAMP
FROM "Order"
WHERE "displaySeq" IS NOT NULL
GROUP BY "restaurantId"
ON CONFLICT ("restaurantId") DO UPDATE
SET "nextSeq" = GREATEST("RestaurantOrderCounter"."nextSeq", EXCLUDED."nextSeq");

DROP INDEX IF EXISTS "Order_restaurantId_displaySeq_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Order_restaurantId_displayPeriodKey_displaySeq_key"
    ON "Order"("restaurantId", "displayPeriodKey", "displaySeq");

CREATE INDEX IF NOT EXISTS "Order_sourceSessionId_idx" ON "Order"("sourceSessionId");
