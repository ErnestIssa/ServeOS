-- Customer + registered venue call lines for chat "Call" action.
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "customerCallLine" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "registeredPhone" TEXT;
