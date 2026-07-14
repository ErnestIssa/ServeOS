-- Menu item guest-facing copy + menu surface hero cover
ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "ingredients" TEXT;
ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "specialNotes" TEXT;
ALTER TABLE "Menu" ADD COLUMN IF NOT EXISTS "coverMediaKey" TEXT;
