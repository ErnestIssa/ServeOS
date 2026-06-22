-- Order Identity extensions + Order Ownership domain

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deviceId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "reservationId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "internalIdSchema" TEXT NOT NULL DEFAULT 'cuid';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "gs1Identifier" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "receiptSearchHash" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "federationId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Order_gs1Identifier_key" ON "Order"("gs1Identifier") WHERE "gs1Identifier" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Order_federationId_key" ON "Order"("federationId") WHERE "federationId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Order_receiptSearchHash_idx" ON "Order"("receiptSearchHash");
CREATE INDEX IF NOT EXISTS "Order_reservationId_idx" ON "Order"("reservationId");
CREATE INDEX IF NOT EXISTS "Order_deviceId_idx" ON "Order"("deviceId");

CREATE TABLE IF NOT EXISTS "OrderOwnershipRecord" (
    "orderId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "accountableRestaurantId" TEXT NOT NULL,
    "ownershipType" TEXT NOT NULL,
    "customerUserId" TEXT,
    "guestKey" TEXT,
    "createdByUserId" TEXT,
    "createdByContext" "OrderCreatedContext" NOT NULL,
    "assignedStaffUserId" TEXT,
    "tableLabel" TEXT,
    "reservationId" TEXT,
    "deviceId" TEXT,
    "source" "OrderSource" NOT NULL,
    "sourceSessionId" TEXT,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderOwnershipRecord_pkey" PRIMARY KEY ("orderId")
);

CREATE TABLE IF NOT EXISTS "OrderPartnerIdentity" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "externalOrderId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderPartnerIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrderPartnerIdentity_partnerId_externalOrderId_key"
    ON "OrderPartnerIdentity"("partnerId", "externalOrderId");
CREATE INDEX IF NOT EXISTS "OrderPartnerIdentity_orderId_idx" ON "OrderPartnerIdentity"("orderId");
CREATE INDEX IF NOT EXISTS "OrderPartnerIdentity_restaurantId_partnerId_idx"
    ON "OrderPartnerIdentity"("restaurantId", "partnerId");

ALTER TABLE "OrderOwnershipRecord" ADD CONSTRAINT "OrderOwnershipRecord_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderPartnerIdentity" ADD CONSTRAINT "OrderPartnerIdentity_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "OrderOwnershipRecord_restaurantId_idx" ON "OrderOwnershipRecord"("restaurantId");
CREATE INDEX IF NOT EXISTS "OrderOwnershipRecord_customerUserId_idx" ON "OrderOwnershipRecord"("customerUserId");
CREATE INDEX IF NOT EXISTS "OrderOwnershipRecord_guestKey_idx" ON "OrderOwnershipRecord"("guestKey");
CREATE INDEX IF NOT EXISTS "OrderOwnershipRecord_assignedStaffUserId_idx" ON "OrderOwnershipRecord"("assignedStaffUserId");
