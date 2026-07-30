-- Restaurant logo and ServeOS branding are always shown on guest QR experiences.
UPDATE "QrCode" SET "showRestaurantLogo" = true, "showServeosBranding" = true;
ALTER TABLE "QrCode" ALTER COLUMN "showServeosBranding" SET DEFAULT true;
