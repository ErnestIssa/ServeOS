-- CreateTable
CREATE TABLE "CommunicationSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "emailPrefs" JSONB NOT NULL,
    "inAppPrefs" JSONB NOT NULL,
    "lastSource" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationPreferenceAudit" (
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "category" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationPreferenceAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationSubscriber_email_key" ON "CommunicationSubscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationSubscriber_userId_key" ON "CommunicationSubscriber"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationSubscriber_tokenHash_key" ON "CommunicationSubscriber"("tokenHash");

-- CreateIndex
CREATE INDEX "CommunicationSubscriber_userId_idx" ON "CommunicationSubscriber"("userId");

-- CreateIndex
CREATE INDEX "CommunicationPreferenceAudit_subscriberId_createdAt_idx" ON "CommunicationPreferenceAudit"("subscriberId", "createdAt");

-- AddForeignKey
ALTER TABLE "CommunicationSubscriber" ADD CONSTRAINT "CommunicationSubscriber_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationPreferenceAudit" ADD CONSTRAINT "CommunicationPreferenceAudit_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "CommunicationSubscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
