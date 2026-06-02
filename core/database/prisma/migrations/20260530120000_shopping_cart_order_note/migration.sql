-- Persist kitchen / order note on the server cart (single source of truth for mobile sheet).
ALTER TABLE "ShoppingCart" ADD COLUMN "orderNote" TEXT;
