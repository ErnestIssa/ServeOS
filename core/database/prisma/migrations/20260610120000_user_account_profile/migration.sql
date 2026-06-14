-- CreateEnum
CREATE TYPE "SecurityActivityType" AS ENUM (
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'PASSWORD_CHANGED',
  'EMAIL_CHANGE_REQUESTED',
  'EMAIL_CHANGED',
  'TWO_FA_ENABLED',
  'TWO_FA_DISABLED',
  'SESSION_REVOKED',
  'SESSIONS_REVOKED_ALL',
  'OWNERSHIP_TRANSFER_REQUESTED',
  'ACCOUNT_CLOSURE_REQUESTED',
  'PROFILE_UPDATED'
);

-- CreateTable
CREATE TABLE "UserAccountProfile" (
    "userId" TEXT NOT NULL,
    "fullName" TEXT,
    "phone" TEXT,
    "jobTitle" TEXT,
    "profileImageUrl" TEXT,
    "profileImageKey" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAccountProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserAppPreferences" (
    "userId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Stockholm',
    "dateFormat" TEXT NOT NULL DEFAULT 'YYYY-MM-DD',
    "timeFormat" TEXT NOT NULL DEFAULT '24h',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAppPreferences_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenFingerprint" TEXT NOT NULL,
    "deviceName" TEXT,
    "browser" TEXT,
    "ipMasked" TEXT,
    "location" TEXT,
    "userAgent" TEXT,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "SecurityActivityType" NOT NULL,
    "metadata" JSONB,
    "ipMasked" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailChangeRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "newEmail" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "passwordVerifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTwoFactorAuth" (
    "userId" TEXT NOT NULL,
    "secretEnc" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "backupCodesHash" JSONB,
    "lastVerifiedAt" TIMESTAMP(3),
    "enabledAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTwoFactorAuth_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "AccountClosureRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "coolingUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountClosureRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnershipTransferRequest" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "toUserId" TEXT,
    "restaurantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "passwordVerifiedAt" TIMESTAMP(3),
    "twoFaVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnershipTransferRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_tokenFingerprint_key" ON "UserSession"("tokenFingerprint");

-- CreateIndex
CREATE INDEX "UserSession_userId_lastActiveAt_idx" ON "UserSession"("userId", "lastActiveAt");

-- CreateIndex
CREATE INDEX "SecurityActivity_userId_createdAt_idx" ON "SecurityActivity"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailChangeRequest_tokenHash_key" ON "EmailChangeRequest"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailChangeRequest_userId_idx" ON "EmailChangeRequest"("userId");

-- CreateIndex
CREATE INDEX "AccountClosureRequest_userId_status_idx" ON "AccountClosureRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "OwnershipTransferRequest_fromUserId_status_idx" ON "OwnershipTransferRequest"("fromUserId", "status");

-- AddForeignKey
ALTER TABLE "UserAccountProfile" ADD CONSTRAINT "UserAccountProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAppPreferences" ADD CONSTRAINT "UserAppPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityActivity" ADD CONSTRAINT "SecurityActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailChangeRequest" ADD CONSTRAINT "EmailChangeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTwoFactorAuth" ADD CONSTRAINT "UserTwoFactorAuth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountClosureRequest" ADD CONSTRAINT "AccountClosureRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipTransferRequest" ADD CONSTRAINT "OwnershipTransferRequest_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
