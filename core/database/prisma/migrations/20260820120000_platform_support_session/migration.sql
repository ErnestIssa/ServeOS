-- Platform support widget session (FAB + modal lifecycle)
CREATE TABLE "PlatformSupportSession" (
    "userId" TEXT NOT NULL,
    "fabPinned" BOOLEAN NOT NULL DEFAULT false,
    "modalOpen" BOOLEAN NOT NULL DEFAULT false,
    "hasActiveThread" BOOLEAN NOT NULL DEFAULT false,
    "openedVia" TEXT,
    "lastSupportActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastPlatformActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSupportSession_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "PlatformSupportSession" ADD CONSTRAINT "PlatformSupportSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
