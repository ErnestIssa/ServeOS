-- Order Source Rules domain

ALTER TYPE "OrderSource" ADD VALUE IF NOT EXISTS 'RESERVATION_ORDER';

ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "orderSourcePolicy" JSONB;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "sourceMetadata" JSONB;

CREATE INDEX IF NOT EXISTS "Order_source_idx" ON "Order"("source");
