/**
 * Venue payment account domain — platform / PSP partner model.
 *
 * Preferred path: SERVEOS_MANAGED (Stripe Connect hosted onboarding).
 * Advanced: BRING_YOUR_OWN_PROVIDER (direct credentials).
 * Manual: cash / invoice / external (no acquiring).
 *
 * Persisted under Restaurant.paymentSettings for now; service layer is the SSOT
 * so this can move to Prisma VenuePaymentAccount without rewriting callers.
 */

export type PaymentConnectionMode =
  | "SERVEOS_MANAGED"
  | "BRING_YOUR_OWN_PROVIDER"
  | "MANUAL_EXTERNAL";

export type PaymentPlatformProviderId = "stripe_connect" | "swedbank_pay" | "direct_stripe" | "direct_swish" | "native";

export type VenuePaymentAccountOnboardingState =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "ACTION_REQUIRED"
  | "UNDER_REVIEW"
  | "CONNECTED"
  | "ACTIVE"
  | "RESTRICTED"
  | "DISABLED"
  | "REJECTED"
  | "DISCONNECTED";

export type PaymentCapabilityId =
  | "card_payments"
  | "transfers"
  | "apple_pay"
  | "google_pay"
  | "klarna"
  | "swish"
  | "terminal";

export type PaymentCapabilityStatus =
  | "inactive"
  | "pending"
  | "active"
  | "unavailable"
  | "action_required";

export type VenuePaymentCapability = {
  id: PaymentCapabilityId;
  label: string;
  providerStatus: PaymentCapabilityStatus;
  normalizedStatus: PaymentCapabilityStatus;
  /** Catalog method keys unlocked when this capability is active. */
  unlocksMethods: string[];
  enabledByVenue: boolean;
  lastVerifiedAt: string | null;
  limitations?: string[];
};

export type PaymentOnboardingSession = {
  id: string;
  restaurantId: string;
  paymentAccountId: string;
  provider: PaymentPlatformProviderId;
  mode: PaymentConnectionMode;
  status: "CREATED" | "REDIRECTED" | "RETURNED" | "COMPLETED" | "EXPIRED" | "FAILED";
  providerAccountId?: string | null;
  onboardingUrl?: string | null;
  returnUrl: string;
  refreshUrl: string;
  reasonCode?: string | null;
  requiredAction?: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
};

export type VenuePaymentAccount = {
  id: string;
  restaurantId: string;
  mode: PaymentConnectionMode;
  provider: PaymentPlatformProviderId;
  /** Stripe connected account id (acct_…) or equivalent. */
  providerAccountId?: string | null;
  displayName?: string;
  country: string;
  currency: string;
  onboardingState: VenuePaymentAccountOnboardingState;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  environment: "sandbox" | "production";
  capabilities: VenuePaymentCapability[];
  reasonCode?: string | null;
  requiredAction?: string | null;
  actionUrl?: string | null;
  lastProviderSyncAt?: string | null;
  connectedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Link to legacy providerConnections surface when BYO. */
  legacySurface?: "stripe" | "swish" | "terminals" | null;
};

export type VenuePaymentPlatformSnapshot = {
  primaryAccount: VenuePaymentAccount | null;
  accounts: VenuePaymentAccount[];
  activeOnboarding: PaymentOnboardingSession | null;
  recommendedMode: PaymentConnectionMode;
  nextAction: {
    type:
      | "CONNECT_PAYMENTS"
      | "CONTINUE_ONBOARDING"
      | "REFRESH_ACCOUNT"
      | "ENABLE_METHODS"
      | "NONE";
    label: string;
    reason?: string;
  };
};

export const CAPABILITY_CATALOG: Record<
  PaymentCapabilityId,
  { label: string; unlocksMethods: string[] }
> = {
  card_payments: {
    label: "Cards",
    unlocksMethods: ["card", "visa", "mastercard", "amex"]
  },
  transfers: {
    label: "Payouts",
    unlocksMethods: []
  },
  apple_pay: {
    label: "Apple Pay",
    unlocksMethods: ["applePay", "applePayTerminal"]
  },
  google_pay: {
    label: "Google Pay",
    unlocksMethods: ["googlePay", "googlePayTerminal"]
  },
  klarna: {
    label: "Klarna",
    unlocksMethods: ["klarnaPayNow", "klarnaPayLater", "klarnaInstallments"]
  },
  swish: {
    label: "Swish",
    unlocksMethods: ["swish", "swishAtVenue"]
  },
  terminal: {
    label: "Card terminals",
    unlocksMethods: ["cardTerminal", "applePayTerminal", "googlePayTerminal", "samsungPayTerminal"]
  }
};

export function emptyCapabilities(): VenuePaymentCapability[] {
  return (Object.keys(CAPABILITY_CATALOG) as PaymentCapabilityId[]).map((id) => ({
    id,
    label: CAPABILITY_CATALOG[id].label,
    providerStatus: "inactive",
    normalizedStatus: "inactive",
    unlocksMethods: [...CAPABILITY_CATALOG[id].unlocksMethods],
    enabledByVenue: false,
    lastVerifiedAt: null
  }));
}

export function methodsUnlockedByActiveCapabilities(
  account: VenuePaymentAccount | null | undefined
): Set<string> {
  const unlocked = new Set<string>();
  if (!account) return unlocked;
  for (const cap of account.capabilities ?? []) {
    if (cap.normalizedStatus !== "active" && cap.providerStatus !== "active") continue;
    for (const key of cap.unlocksMethods) unlocked.add(key);
  }
  return unlocked;
}
