-- Release lifecycle: Retired is distinct from Draft / Live / Archived.
ALTER TYPE "MenuStatus" ADD VALUE IF NOT EXISTS 'RETIRED';
