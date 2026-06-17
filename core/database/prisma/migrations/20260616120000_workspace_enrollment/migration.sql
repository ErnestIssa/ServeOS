-- CreateTable
CREATE TABLE "CustomerInvitation" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "fullName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "tokenHash" TEXT NOT NULL,
    "status" "StaffInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedByUserId" TEXT,
    "acceptedByUserId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerInvitation_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN "customerInvitationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CustomerInvitation_tokenHash_key" ON "CustomerInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "CustomerInvitation_restaurantId_status_idx" ON "CustomerInvitation"("restaurantId", "status");

-- CreateIndex
CREATE INDEX "CustomerInvitation_email_idx" ON "CustomerInvitation"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_customerInvitationId_key" ON "Membership"("customerInvitationId");

-- AddForeignKey
ALTER TABLE "CustomerInvitation" ADD CONSTRAINT "CustomerInvitation_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_customerInvitationId_fkey" FOREIGN KEY ("customerInvitationId") REFERENCES "CustomerInvitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterEnum
ALTER TYPE "StaffAuditAction" ADD VALUE 'IDENTITY_MERGED';
