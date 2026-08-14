import type { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  applyStripeAccountToVenueAccount,
  createStripeAccountLink,
  createStripeConnectAccount,
  retrieveStripeConnectAccount
} from "./stripeConnectAdapter.js";
import {
  emptyCapabilities,
  methodsUnlockedByActiveCapabilities,
  type PaymentConnectionMode,
  type PaymentOnboardingSession,
  type VenuePaymentAccount,
  type VenuePaymentCapability,
  type VenuePaymentPlatformSnapshot
} from "./venuePaymentAccountTypes.js";
import {
  getPaymentProviderEnvReady,
  getVenuePaymentSettings,
  updateVenuePaymentSettings,
  type VenuePaymentSettings
} from "../venue/venuePaymentSettingsService.js";

function nowIso() {
  return new Date().toISOString();
}

function mapRowToAccount(row: {
  id: string;
  restaurantId: string;
  mode: string;
  provider: string;
  providerAccountId: string | null;
  displayName: string | null;
  country: string;
  currency: string;
  onboardingState: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  environment: string;
  capabilities: Prisma.JsonValue | null;
  reasonCode: string | null;
  requiredAction: string | null;
  actionUrl: string | null;
  legacySurface: string | null;
  lastProviderSyncAt: Date | null;
  connectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): VenuePaymentAccount {
  return {
    id: row.id,
    restaurantId: row.restaurantId,
    mode: row.mode as VenuePaymentAccount["mode"],
    provider: row.provider as VenuePaymentAccount["provider"],
    providerAccountId: row.providerAccountId,
    displayName: row.displayName ?? undefined,
    country: row.country,
    currency: row.currency,
    onboardingState: row.onboardingState as VenuePaymentAccount["onboardingState"],
    chargesEnabled: row.chargesEnabled,
    payoutsEnabled: row.payoutsEnabled,
    detailsSubmitted: row.detailsSubmitted,
    environment: (row.environment === "production" ? "production" : "sandbox") as "sandbox" | "production",
    capabilities: Array.isArray(row.capabilities)
      ? (row.capabilities as unknown as VenuePaymentCapability[])
      : emptyCapabilities(),
    reasonCode: row.reasonCode,
    requiredAction: row.requiredAction,
    actionUrl: row.actionUrl,
    lastProviderSyncAt: row.lastProviderSyncAt?.toISOString() ?? null,
    connectedAt: row.connectedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    legacySurface: (row.legacySurface as VenuePaymentAccount["legacySurface"]) ?? null
  };
}

function mapSession(row: {
  id: string;
  restaurantId: string;
  paymentAccountId: string;
  provider: string;
  mode: string;
  status: string;
  providerAccountId: string | null;
  onboardingUrl: string | null;
  returnUrl: string;
  refreshUrl: string;
  reasonCode: string | null;
  requiredAction: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
}): PaymentOnboardingSession {
  return {
    id: row.id,
    restaurantId: row.restaurantId,
    paymentAccountId: row.paymentAccountId,
    provider: row.provider as PaymentOnboardingSession["provider"],
    mode: row.mode as PaymentConnectionMode,
    status: row.status as PaymentOnboardingSession["status"],
    providerAccountId: row.providerAccountId,
    onboardingUrl: row.onboardingUrl,
    returnUrl: row.returnUrl,
    refreshUrl: row.refreshUrl,
    reasonCode: row.reasonCode,
    requiredAction: row.requiredAction,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdBy: row.createdByUserId ?? undefined
  };
}

async function mirrorManagedAccountToLegacySettings(
  prisma: PrismaClient,
  restaurantId: string,
  account: VenuePaymentAccount,
  audit?: { actorUserId?: string; actorRole?: string }
) {
  if (account.provider !== "stripe_connect") return;
  const current = await getVenuePaymentSettings(prisma, restaurantId);
  if (!current.ok) return;

  const connected =
    account.onboardingState === "ACTIVE" ||
    account.onboardingState === "CONNECTED" ||
    account.chargesEnabled;

  await updateVenuePaymentSettings(
    prisma,
    restaurantId,
    {
      providers: {
        stripe: {
          connected,
          accountId: account.providerAccountId ?? undefined,
          connectedAt: account.connectedAt ?? undefined,
          displayName: account.displayName,
          environment: account.environment,
          verificationStatus: connected
            ? "verified"
            : account.onboardingState === "ACTION_REQUIRED"
              ? "pending"
              : "unverified",
          verifiedAt: account.lastProviderSyncAt ?? undefined,
          health: connected ? (account.chargesEnabled ? "healthy" : "degraded") : "unknown"
        },
        swish: current.settings.providers.swish
      },
      providerConnections: {
        ...(current.settings.providerConnections ?? {}),
        stripe: {
          provider: "stripe",
          connected,
          displayName: account.displayName,
          environment: account.environment,
          connectionMode: "SERVEOS_MANAGED",
          publicAccountId: account.providerAccountId ?? undefined,
          hasApiSecret: false,
          hasCertificate: false,
          hasWebhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
          verificationStatus: connected ? "verified" : "pending",
          verifiedAt: account.lastProviderSyncAt ?? null,
          verificationExpiresAt: null,
          failureCode: account.reasonCode ?? null,
          failureReason: null,
          nextRequiredAction: account.requiredAction ?? null,
          health: connected ? (account.chargesEnabled ? "healthy" : "degraded") : "unknown",
          lastHealthCheckAt: account.lastProviderSyncAt ?? null,
          lastHealthyAt: account.chargesEnabled ? account.lastProviderSyncAt ?? null : null,
          connectedAt: account.connectedAt ?? null,
          rotatedAt: null,
          revokedAt: null
        }
      }
    } as Partial<VenuePaymentSettings>,
    {
      ...audit,
      action: "payment.venue_account_synced",
      path: "venuePaymentAccount"
    }
  );
}

export async function getVenuePaymentPlatformSnapshot(
  prisma: PrismaClient,
  restaurantId: string
): Promise<VenuePaymentPlatformSnapshot> {
  const [accounts, sessions] = await Promise.all([
    prisma.venuePaymentAccount.findMany({
      where: { restaurantId },
      orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }]
    }),
    prisma.paymentOnboardingSession.findMany({
      where: {
        restaurantId,
        status: { in: ["CREATED", "REDIRECTED", "RETURNED"] },
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: "desc" },
      take: 1
    })
  ]);

  const mapped = accounts.map(mapRowToAccount);
  const primary =
    mapped.find((a) => a.provider === "stripe_connect") ??
    mapped.find((a) => a.onboardingState === "ACTIVE" || a.onboardingState === "CONNECTED") ??
    mapped[0] ??
    null;
  const activeOnboarding = sessions[0] ? mapSession(sessions[0]) : null;

  let nextAction: VenuePaymentPlatformSnapshot["nextAction"] = {
    type: "CONNECT_PAYMENTS",
    label: "Connect payments",
    reason: "Connect your business to accept cards, Apple Pay, Google Pay and more. Money settles to this venue’s payment account."
  };

  if (activeOnboarding) {
    nextAction = {
      type: "CONTINUE_ONBOARDING",
      label: "Continue payment setup",
      reason: "Finish verification with your payment provider."
    };
  } else if (primary) {
    if (
      primary.onboardingState === "ACTION_REQUIRED" ||
      primary.onboardingState === "IN_PROGRESS" ||
      primary.onboardingState === "UNDER_REVIEW"
    ) {
      nextAction = {
        type: "CONTINUE_ONBOARDING",
        label: "Complete payment setup",
        reason: primary.reasonCode
          ? `Provider requires: ${primary.reasonCode}`
          : "Your payment account still needs verification."
      };
    } else if (primary.onboardingState === "ACTIVE" || primary.onboardingState === "CONNECTED") {
      nextAction = {
        type: "ENABLE_METHODS",
        label: "Choose payment methods",
        reason: "Your payment account is connected. Enable the methods customers should see."
      };
    } else if (primary.onboardingState === "RESTRICTED" || primary.onboardingState === "REJECTED") {
      nextAction = {
        type: "REFRESH_ACCOUNT",
        label: "Fix payment account",
        reason: primary.reasonCode ?? "Your payment account needs attention."
      };
    }
  }

  return {
    primaryAccount: primary,
    accounts: mapped,
    activeOnboarding,
    recommendedMode: "SERVEOS_MANAGED",
    nextAction
  };
}

export async function startServeosManagedOnboarding(
  prisma: PrismaClient,
  restaurantId: string,
  input: {
    returnUrl: string;
    refreshUrl: string;
    country?: string;
    email?: string;
  },
  audit?: { actorUserId?: string; actorRole?: string }
) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true }
  });
  if (!restaurant) return { ok: false as const, error: "restaurant_not_found" };

  let account = await prisma.venuePaymentAccount.findFirst({
    where: { restaurantId, provider: "stripe_connect", isPrimary: true }
  });

  if (!account) {
    account = await prisma.venuePaymentAccount.create({
      data: {
        restaurantId,
        mode: "SERVEOS_MANAGED",
        provider: "stripe_connect",
        displayName: restaurant.name,
        country: (input.country || "SE").toUpperCase(),
        currency: "SEK",
        onboardingState: "NOT_STARTED",
        environment: process.env.STRIPE_SECRET_KEY?.trim() ? "production" : "sandbox",
        capabilities: emptyCapabilities() as unknown as Prisma.InputJsonValue,
        isPrimary: true,
        requiredAction: "START_ONBOARDING"
      }
    });
  }

  let providerAccountId = account.providerAccountId;
  if (!providerAccountId) {
    const created = await createStripeConnectAccount({
      restaurantId,
      email: input.email,
      country: account.country
    });
    if (!created.ok) {
      return { ok: false as const, error: "provider_error", message: created.message };
    }
    providerAccountId = created.accountId;
    account = await prisma.venuePaymentAccount.update({
      where: { id: account.id },
      data: {
        providerAccountId,
        onboardingState: "IN_PROGRESS",
        environment: created.sandbox ? "sandbox" : "production",
        updatedAt: new Date()
      }
    });
  }

  const link = await createStripeAccountLink({
    accountId: providerAccountId!,
    returnUrl: input.returnUrl,
    refreshUrl: input.refreshUrl
  });
  if (!link.ok) {
    return { ok: false as const, error: "provider_error", message: link.message };
  }

  const session = await prisma.paymentOnboardingSession.create({
    data: {
      id: `pos_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      restaurantId,
      paymentAccountId: account.id,
      provider: "stripe_connect",
      mode: "SERVEOS_MANAGED",
      status: "REDIRECTED",
      providerAccountId,
      onboardingUrl: link.url,
      returnUrl: input.returnUrl,
      refreshUrl: input.refreshUrl,
      expiresAt: new Date(link.expiresAt),
      createdByUserId: audit?.actorUserId,
      requiredAction: "COMPLETE_PROVIDER_ONBOARDING"
    }
  });

  await prisma.venuePaymentAccount.update({
    where: { id: account.id },
    data: {
      onboardingState: "IN_PROGRESS",
      actionUrl: link.url,
      requiredAction: "COMPLETE_PROVIDER_ONBOARDING",
      updatedAt: new Date()
    }
  });

  const snapshot = await getVenuePaymentPlatformSnapshot(prisma, restaurantId);
  return {
    ok: true as const,
    onboardingUrl: link.url,
    session: mapSession(session),
    account: mapRowToAccount(
      (await prisma.venuePaymentAccount.findUniqueOrThrow({ where: { id: account.id } })) as Parameters<
        typeof mapRowToAccount
      >[0]
    ),
    platform: snapshot,
    sandbox: link.sandbox
  };
}

export async function syncVenuePaymentAccountFromProvider(
  prisma: PrismaClient,
  restaurantId: string,
  paymentAccountId?: string,
  audit?: { actorUserId?: string; actorRole?: string }
) {
  const accountRow = paymentAccountId
    ? await prisma.venuePaymentAccount.findFirst({ where: { id: paymentAccountId, restaurantId } })
    : await prisma.venuePaymentAccount.findFirst({
        where: { restaurantId, provider: "stripe_connect", isPrimary: true }
      });
  if (!accountRow) return { ok: false as const, error: "account_not_found" };
  if (!accountRow.providerAccountId) {
    return { ok: false as const, error: "provider_account_missing", message: "Start Connect payments first." };
  }

  const retrieved = await retrieveStripeConnectAccount(accountRow.providerAccountId);
  if (!retrieved.ok) {
    return { ok: false as const, error: "provider_error", message: retrieved.message };
  }

  let domain = mapRowToAccount(accountRow);
  domain = applyStripeAccountToVenueAccount(domain, retrieved.account, retrieved.sandbox);

  const updated = await prisma.venuePaymentAccount.update({
    where: { id: accountRow.id },
    data: {
      providerAccountId: domain.providerAccountId,
      displayName: domain.displayName,
      country: domain.country,
      currency: domain.currency,
      onboardingState: domain.onboardingState,
      chargesEnabled: domain.chargesEnabled,
      payoutsEnabled: domain.payoutsEnabled,
      detailsSubmitted: domain.detailsSubmitted,
      environment: domain.environment,
      capabilities: domain.capabilities as unknown as Prisma.InputJsonValue,
      reasonCode: domain.reasonCode,
      requiredAction: domain.requiredAction,
      actionUrl: domain.actionUrl,
      lastProviderSyncAt: domain.lastProviderSyncAt ? new Date(domain.lastProviderSyncAt) : new Date(),
      connectedAt: domain.connectedAt ? new Date(domain.connectedAt) : null,
      updatedAt: new Date()
    }
  });

  // Mark latest onboarding session completed when account is usable.
  if (domain.onboardingState === "ACTIVE" || domain.onboardingState === "CONNECTED") {
    await prisma.paymentOnboardingSession.updateMany({
      where: {
        restaurantId,
        paymentAccountId: accountRow.id,
        status: { in: ["CREATED", "REDIRECTED", "RETURNED"] }
      },
      data: { status: "COMPLETED", updatedAt: new Date() }
    });
  } else {
    await prisma.paymentOnboardingSession.updateMany({
      where: {
        restaurantId,
        paymentAccountId: accountRow.id,
        status: { in: ["CREATED", "REDIRECTED"] }
      },
      data: { status: "RETURNED", updatedAt: new Date() }
    });
  }

  const mapped = mapRowToAccount(updated);
  await mirrorManagedAccountToLegacySettings(prisma, restaurantId, mapped, audit);

  return {
    ok: true as const,
    account: mapped,
    platform: await getVenuePaymentPlatformSnapshot(prisma, restaurantId),
    envReady: getPaymentProviderEnvReady()
  };
}

export async function refreshServeosManagedOnboardingLink(
  prisma: PrismaClient,
  restaurantId: string,
  input: { returnUrl: string; refreshUrl: string },
  audit?: { actorUserId?: string; actorRole?: string }
) {
  const account = await prisma.venuePaymentAccount.findFirst({
    where: { restaurantId, provider: "stripe_connect", isPrimary: true }
  });
  if (!account?.providerAccountId) {
    return startServeosManagedOnboarding(prisma, restaurantId, input, audit);
  }
  const link = await createStripeAccountLink({
    accountId: account.providerAccountId,
    returnUrl: input.returnUrl,
    refreshUrl: input.refreshUrl
  });
  if (!link.ok) return { ok: false as const, error: "provider_error", message: link.message };

  const session = await prisma.paymentOnboardingSession.create({
    data: {
      id: `pos_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      restaurantId,
      paymentAccountId: account.id,
      provider: "stripe_connect",
      mode: "SERVEOS_MANAGED",
      status: "REDIRECTED",
      providerAccountId: account.providerAccountId,
      onboardingUrl: link.url,
      returnUrl: input.returnUrl,
      refreshUrl: input.refreshUrl,
      expiresAt: new Date(link.expiresAt),
      createdByUserId: audit?.actorUserId,
      requiredAction: "COMPLETE_PROVIDER_ONBOARDING"
    }
  });

  await prisma.venuePaymentAccount.update({
    where: { id: account.id },
    data: { actionUrl: link.url, requiredAction: "COMPLETE_PROVIDER_ONBOARDING", updatedAt: new Date() }
  });

  return {
    ok: true as const,
    onboardingUrl: link.url,
    session: mapSession(session),
    platform: await getVenuePaymentPlatformSnapshot(prisma, restaurantId),
    sandbox: link.sandbox
  };
}

export { methodsUnlockedByActiveCapabilities, nowIso };
