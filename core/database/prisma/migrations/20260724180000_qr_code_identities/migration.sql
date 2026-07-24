-- Permanent QR identities (printed URL → resolve → temporary ordering session).

CREATE TYPE "QrCodeType" AS ENUM ('TABLE', 'MENU', 'TAKEAWAY', 'STAFF', 'MARKETING', 'FEEDBACK');
CREATE TYPE "QrCodeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ROTATED');
CREATE TYPE "QrExperience" AS ENUM ('ORDERING', 'MENU_BROWSE', 'FEEDBACK', 'PROMOTION', 'RESERVATION');

CREATE TABLE "QrCode" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "publicCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "QrCodeType" NOT NULL,
    "status" "QrCodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "experience" "QrExperience" NOT NULL DEFAULT 'ORDERING',
    "locationLabel" TEXT,
    "areaLabel" TEXT,
    "tableLabel" TEXT,
    "tableId" TEXT,
    "seatCount" INTEGER,
    "paymentMode" "OrderingPaymentMode" NOT NULL DEFAULT 'PAY_AT_VENUE',
    "menuId" TEXT,
    "allowOrdering" BOOLEAN NOT NULL DEFAULT true,
    "headline" TEXT DEFAULT 'Scan to order',
    "showRestaurantLogo" BOOLEAN NOT NULL DEFAULT true,
    "showServeosBranding" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "scanCount" INTEGER NOT NULL DEFAULT 0,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "replacesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QrCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QrCode_publicCode_key" ON "QrCode"("publicCode");
CREATE INDEX "QrCode_restaurantId_status_idx" ON "QrCode"("restaurantId", "status");
CREATE INDEX "QrCode_restaurantId_type_idx" ON "QrCode"("restaurantId", "type");
CREATE INDEX "QrCode_restaurantId_lastUsedAt_idx" ON "QrCode"("restaurantId", "lastUsedAt");
CREATE INDEX "QrCode_menuId_idx" ON "QrCode"("menuId");

ALTER TABLE "QrCode" ADD CONSTRAINT "QrCode_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QrCode" ADD CONSTRAINT "QrCode_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderingSession" ADD COLUMN "qrCodeId" TEXT;
ALTER TABLE "OrderingSession" ADD COLUMN "menuId" TEXT;
ALTER TABLE "OrderingSession" ADD COLUMN "allowOrdering" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "OrderingSession_qrCodeId_idx" ON "OrderingSession"("qrCodeId");
ALTER TABLE "OrderingSession" ADD CONSTRAINT "OrderingSession_qrCodeId_fkey" FOREIGN KEY ("qrCodeId") REFERENCES "QrCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Order" ADD COLUMN "qrCodeId" TEXT;
CREATE INDEX "Order_qrCodeId_idx" ON "Order"("qrCodeId");
ALTER TABLE "Order" ADD CONSTRAINT "Order_qrCodeId_fkey" FOREIGN KEY ("qrCodeId") REFERENCES "QrCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
