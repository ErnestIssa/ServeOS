-- Order engine production guarantees: optimistic locking, outbox, idempotency, payment refs.

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;

CREATE TYPE "OrderOutboxStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

CREATE TABLE IF NOT EXISTS "OrderEventOutbox" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "status" "OrderOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    CONSTRAINT "OrderEventOutbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrderIdempotencyKey" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "restaurantId" TEXT,
    "orderId" TEXT,
    "requestHash" TEXT,
    "response" JSONB,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrderIdempotencyKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrderPaymentReference" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SEK',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrderPaymentReference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrderEventOutbox_orderId_sequence_key" ON "OrderEventOutbox"("orderId", "sequence");
CREATE INDEX IF NOT EXISTS "OrderEventOutbox_status_createdAt_idx" ON "OrderEventOutbox"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "OrderEventOutbox_orderId_sequence_idx" ON "OrderEventOutbox"("orderId", "sequence");

CREATE UNIQUE INDEX IF NOT EXISTS "OrderIdempotencyKey_scope_key_key" ON "OrderIdempotencyKey"("scope", "key");
CREATE INDEX IF NOT EXISTS "OrderIdempotencyKey_expiresAt_idx" ON "OrderIdempotencyKey"("expiresAt");

CREATE UNIQUE INDEX IF NOT EXISTS "OrderPaymentReference_provider_externalId_key" ON "OrderPaymentReference"("provider", "externalId");
CREATE INDEX IF NOT EXISTS "OrderPaymentReference_orderId_idx" ON "OrderPaymentReference"("orderId");

ALTER TABLE "OrderEventOutbox" ADD CONSTRAINT "OrderEventOutbox_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderPaymentReference" ADD CONSTRAINT "OrderPaymentReference_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
