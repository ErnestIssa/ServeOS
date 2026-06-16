-- CreateEnum
CREATE TYPE "StaffAuditAction" AS ENUM (
  'INVITE_SENT',
  'INVITE_CANCELLED',
  'INVITE_ACCEPTED',
  'MEMBERSHIP_APPROVED',
  'MEMBERSHIP_REJECTED',
  'MEMBERSHIP_SUSPENDED',
  'MEMBERSHIP_ACTIVATED',
  'MEMBERSHIP_REMOVED',
  'PERMISSIONS_UPDATED',
  'SESSIONS_REVOKED',
  'PASSWORD_RESET_REQUESTED'
);

-- CreateTable
CREATE TABLE "StaffAuditLog" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "targetUserId" TEXT,
  "targetMembershipId" TEXT,
  "action" "StaffAuditAction" NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StaffAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffAuditLog_restaurantId_createdAt_idx" ON "StaffAuditLog"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffAuditLog_targetUserId_idx" ON "StaffAuditLog"("targetUserId");

-- CreateIndex
CREATE INDEX "StaffAuditLog_targetMembershipId_idx" ON "StaffAuditLog"("targetMembershipId");

-- AddForeignKey
ALTER TABLE "StaffAuditLog" ADD CONSTRAINT "StaffAuditLog_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAuditLog" ADD CONSTRAINT "StaffAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAuditLog" ADD CONSTRAINT "StaffAuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
