-- Venue payment accounts (platform / Stripe Connect) + hosted onboarding sessions
CREATE TABLE IF NOT EXISTS "VenuePaymentAccount" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT,
    "displayName" TEXT,
    "country" TEXT NOT NULL DEFAULT 'SE',
    "currency" TEXT NOT NULL DEFAULT 'SEK',
    "onboardingState" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "chargesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "detailsSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "environment" TEXT NOT NULL DEFAULT 'sandbox',
    "capabilities" JSONB,
    "reasonCode" TEXT,
    "requiredAction" TEXT,
    "actionUrl" TEXT,
    "legacySurface" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "lastProviderSyncAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenuePaymentAccount_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "VenuePaymentAccount_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PaymentOnboardingSession" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "paymentAccountId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "providerAccountId" TEXT,
    "onboardingUrl" TEXT,
    "returnUrl" TEXT NOT NULL,
    "refreshUrl" TEXT NOT NULL,
    "reasonCode" TEXT,
    "requiredAction" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentOnboardingSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PaymentOnboardingSession_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaymentOnboardingSession_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "VenuePaymentAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "VenuePaymentAccount_restaurantId_isPrimary_idx" ON "VenuePaymentAccount"("restaurantId", "isPrimary");
CREATE INDEX IF NOT EXISTS "VenuePaymentAccount_provider_providerAccountId_idx" ON "VenuePaymentAccount"("provider", "providerAccountId");

-- Partial unique: one provider account id per venue when set
CREATE UNIQUE INDEX IF NOT EXISTS "VenuePaymentAccount_restaurantId_provider_providerAccountId_key"
  ON "VenuePaymentAccount"("restaurantId", "provider", "providerAccountId")
  WHERE "providerAccountId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "PaymentOnboardingSession_restaurantId_status_idx" ON "PaymentOnboardingSession"("restaurantId", "status");
CREATE INDEX IF NOT EXISTS "PaymentOnboardingSession_paymentAccountId_idx" ON "PaymentOnboardingSession"("paymentAccountId");
CREATE INDEX IF NOT EXISTS "PaymentOnboardingSession_expiresAt_idx" ON "PaymentOnboardingSession"("expiresAt");
