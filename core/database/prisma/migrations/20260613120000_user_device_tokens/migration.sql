-- CreateTable
CREATE TABLE "UserDeviceToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT,
    "deviceName" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserDeviceToken_token_key" ON "UserDeviceToken"("token");

-- CreateIndex
CREATE INDEX "UserDeviceToken_userId_revokedAt_idx" ON "UserDeviceToken"("userId", "revokedAt");

-- AddForeignKey
ALTER TABLE "UserDeviceToken" ADD CONSTRAINT "UserDeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
