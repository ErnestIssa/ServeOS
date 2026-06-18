-- Soft-delete membership lifecycle: REMOVED status + removedAt timestamp
ALTER TYPE "MembershipStatus" ADD VALUE IF NOT EXISTS 'REMOVED';

ALTER TABLE "Membership" ADD COLUMN IF NOT EXISTS "removedAt" TIMESTAMP(3);

ALTER TYPE "StaffAuditAction" ADD VALUE IF NOT EXISTS 'MEMBERSHIP_RESTORED';
