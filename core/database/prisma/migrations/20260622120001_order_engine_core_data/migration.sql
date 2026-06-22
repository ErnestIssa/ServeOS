-- Step 2: migrate data, extend Order, and create audit/event tables.

UPDATE "Order" SET status = 'CREATED' WHERE status = 'PENDING';
UPDATE "Order" SET status = 'ACCEPTED' WHERE status = 'CONFIRMED';

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "displaySeq" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "source" "OrderSource" NOT NULL DEFAULT 'QR_ORDER';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentStatus" "OrderPaymentStatus" NOT NULL DEFAULT 'UNPAID';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "serviceFeeCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customerName" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customerPhone" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customerEmail" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tableLabel" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "assignedStaffUserId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pricingLockedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "kitchenStartedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'CREATED';

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "restaurantId" ORDER BY "createdAt" ASC) AS seq
  FROM "Order"
)
UPDATE "Order" o SET "displaySeq" = numbered.seq
FROM numbered WHERE o.id = numbered.id AND o."displaySeq" IS NULL;

CREATE TABLE IF NOT EXISTS "OrderStatusHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "actorUserId" TEXT,
    "actorSource" "OrderActorSource" NOT NULL DEFAULT 'SYSTEM',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrderAuditLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorSource" "OrderActorSource" NOT NULL DEFAULT 'SYSTEM',
    "action" TEXT NOT NULL,
    "beforeState" JSONB,
    "afterState" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrderDomainEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderDomainEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Order_restaurantId_status_idx" ON "Order"("restaurantId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "Order_restaurantId_displaySeq_key" ON "Order"("restaurantId", "displaySeq");
CREATE INDEX IF NOT EXISTS "OrderStatusHistory_orderId_createdAt_idx" ON "OrderStatusHistory"("orderId", "createdAt");
CREATE INDEX IF NOT EXISTS "OrderAuditLog_orderId_createdAt_idx" ON "OrderAuditLog"("orderId", "createdAt");
CREATE INDEX IF NOT EXISTS "OrderAuditLog_restaurantId_createdAt_idx" ON "OrderAuditLog"("restaurantId", "createdAt");
CREATE INDEX IF NOT EXISTS "OrderDomainEvent_orderId_createdAt_idx" ON "OrderDomainEvent"("orderId", "createdAt");
CREATE INDEX IF NOT EXISTS "OrderDomainEvent_restaurantId_createdAt_idx" ON "OrderDomainEvent"("restaurantId", "createdAt");
CREATE INDEX IF NOT EXISTS "OrderDomainEvent_type_createdAt_idx" ON "OrderDomainEvent"("type", "createdAt");

DO $$ BEGIN
  ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OrderAuditLog" ADD CONSTRAINT "OrderAuditLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OrderDomainEvent" ADD CONSTRAINT "OrderDomainEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
