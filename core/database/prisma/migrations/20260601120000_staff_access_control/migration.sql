-- Staff invitation, membership approval, and granular permissions (backend SOT).

CREATE TYPE "MembershipStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'REJECTED');
CREATE TYPE "StaffInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'CANCELLED', 'EXPIRED');

ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "accessPolicy" JSONB;

ALTER TABLE "Membership" ADD COLUMN IF NOT EXISTS "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Membership" ADD COLUMN IF NOT EXISTS "permissions" JSONB;
ALTER TABLE "Membership" ADD COLUMN IF NOT EXISTS "invitedByUserId" TEXT;
ALTER TABLE "Membership" ADD COLUMN IF NOT EXISTS "approvedByUserId" TEXT;
ALTER TABLE "Membership" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "Membership" ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3);
ALTER TABLE "Membership" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3);
ALTER TABLE "Membership" ADD COLUMN IF NOT EXISTS "staffInvitationId" TEXT;
ALTER TABLE "Membership" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "Membership_staffInvitationId_key" ON "Membership"("staffInvitationId");
CREATE INDEX IF NOT EXISTS "Membership_restaurantId_status_idx" ON "Membership"("restaurantId", "status");

CREATE TABLE IF NOT EXISTS "StaffInvitation" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "intendedRole" "Role" NOT NULL,
    "permissions" JSONB NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "StaffInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "acceptedByUserId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StaffInvitation_tokenHash_key" ON "StaffInvitation"("tokenHash");
CREATE INDEX IF NOT EXISTS "StaffInvitation_restaurantId_status_idx" ON "StaffInvitation"("restaurantId", "status");
CREATE INDEX IF NOT EXISTS "StaffInvitation_email_idx" ON "StaffInvitation"("email");

ALTER TABLE "StaffInvitation" ADD CONSTRAINT "StaffInvitation_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_staffInvitationId_fkey"
  FOREIGN KEY ("staffInvitationId") REFERENCES "StaffInvitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
