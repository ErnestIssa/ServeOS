-- Enum ADD VALUE must run outside a transaction (Prisma: disable-transaction).
-- Fixes chat hub when 20260511120000 did not apply on hosted Postgres.
-- prisma-migrate:disable-transaction

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    INNER JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ChatMessageType' AND e.enumlabel = 'IMAGE'
  ) THEN
    ALTER TYPE "ChatMessageType" ADD VALUE 'IMAGE';
  END IF;
END $$;
