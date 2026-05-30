-- Customer reservation draft persistence (mobile Book tab).
CREATE TABLE "CustomerReservationDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "screenId" TEXT NOT NULL DEFAULT 'landing',
    "draft" JSONB NOT NULL,
    "confirmationCode" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerReservationDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerReservationDraft_userId_restaurantId_key" ON "CustomerReservationDraft"("userId", "restaurantId");

CREATE INDEX "CustomerReservationDraft_restaurantId_idx" ON "CustomerReservationDraft"("restaurantId");

ALTER TABLE "CustomerReservationDraft" ADD CONSTRAINT "CustomerReservationDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerReservationDraft" ADD CONSTRAINT "CustomerReservationDraft_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
