-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN "paymentSettings" JSONB;

-- AlterTable
ALTER TABLE "Menu" ADD COLUMN "scheduledPublishAt" TIMESTAMP(3),
ADD COLUMN "availabilityWindows" JSONB;

-- CreateTable
CREATE TABLE "SessionCart" (
    "id" TEXT NOT NULL,
    "orderingSessionId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "orderNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionCart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionCartLine" (
    "id" TEXT NOT NULL,
    "sessionCartId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "modifierOptionIds" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "SessionCartLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionCart_orderingSessionId_key" ON "SessionCart"("orderingSessionId");

-- CreateIndex
CREATE INDEX "SessionCart_restaurantId_idx" ON "SessionCart"("restaurantId");

-- CreateIndex
CREATE INDEX "SessionCartLine_sessionCartId_idx" ON "SessionCartLine"("sessionCartId");

-- AddForeignKey
ALTER TABLE "SessionCart" ADD CONSTRAINT "SessionCart_orderingSessionId_fkey" FOREIGN KEY ("orderingSessionId") REFERENCES "OrderingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionCart" ADD CONSTRAINT "SessionCart_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionCartLine" ADD CONSTRAINT "SessionCartLine_sessionCartId_fkey" FOREIGN KEY ("sessionCartId") REFERENCES "SessionCart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionCartLine" ADD CONSTRAINT "SessionCartLine_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
