-- OCL: reservation-scoped chat rooms
ALTER TYPE "ChatRoomType" ADD VALUE IF NOT EXISTS 'RESERVATION';

ALTER TABLE "ChatRoom" ADD COLUMN IF NOT EXISTS "reservationId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "ChatRoom_reservationId_key" ON "ChatRoom"("reservationId");

ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "CustomerReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
