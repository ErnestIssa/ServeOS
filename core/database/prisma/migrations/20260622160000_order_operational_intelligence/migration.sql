-- Operational intelligence: tenant order policies, recovery + compensation logs.

ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "orderEnginePolicy" JSONB;

CREATE TABLE IF NOT EXISTS "OrderRecoveryLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderRecoveryLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrderCompensationLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "beforeState" JSONB,
    "afterState" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "OrderCompensationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrderRecoveryLog_orderId_createdAt_idx" ON "OrderRecoveryLog"("orderId", "createdAt");
CREATE INDEX IF NOT EXISTS "OrderRecoveryLog_restaurantId_createdAt_idx" ON "OrderRecoveryLog"("restaurantId", "createdAt");
CREATE INDEX IF NOT EXISTS "OrderCompensationLog_orderId_createdAt_idx" ON "OrderCompensationLog"("orderId", "createdAt");
CREATE INDEX IF NOT EXISTS "OrderCompensationLog_restaurantId_status_idx" ON "OrderCompensationLog"("restaurantId", "status");

ALTER TABLE "OrderRecoveryLog" ADD CONSTRAINT "OrderRecoveryLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderCompensationLog" ADD CONSTRAINT "OrderCompensationLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
