-- Allow fractional session TTL hours (e.g. 0.5 = 30 minutes).
ALTER TABLE "QrCode" ALTER COLUMN "sessionTtlHours" SET DATA TYPE DOUBLE PRECISION;
