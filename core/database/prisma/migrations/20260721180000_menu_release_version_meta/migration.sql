-- Menu release management: persist publish reports and change summaries on versions.
ALTER TABLE "MenuVersion" ADD COLUMN IF NOT EXISTS "changeSummary" JSONB;
ALTER TABLE "MenuVersion" ADD COLUMN IF NOT EXISTS "publishReport" JSONB;
ALTER TABLE "MenuVersion" ADD COLUMN IF NOT EXISTS "releaseNotes" TEXT;
