import type { Prisma, PrismaClient } from "@prisma/client";
import type { OrderingPaymentMode } from "@prisma/client";

export type PaymentProviderState = {
  connected: boolean;
  accountId?: string;
  merchantId?: string;
  connectedAt?: string;
  displayName?: string;
};

export type VenuePaymentSettings = {
  providers: {
    stripe: PaymentProviderState;
    swish: PaymentProviderState;
  };
  methods: {
    card: boolean;
    swish: boolean;
    applePay: boolean;
    googlePay: boolean;
    cash: boolean;
    invoice: boolean;
    giftCards: boolean;
  };
  rules: {
    payBeforeOrder: boolean;
    payAfterMeal: boolean;
    depositRequired: boolean;
    minOrderCents: number | null;
    maxOrderCents: number | null;
    defaultPaymentMode: OrderingPaymentMode;
  };
  refunds: {
    managerApproval: boolean;
    automaticRefund: boolean;
    manualRefund: boolean;
    refundTimeoutHours: number;
  };
  taxes: {
    vatStandardPercent: number;
    serviceFeePercent: number;
    deliveryFeeCents: number;
    tipsEnabled: boolean;
  };
  bankAccount: {
    linked: boolean;
    lastFour?: string;
    holderName?: string;
  };
};

export type PaymentStats = {
  successful: number;
  pending: number;
  refunded: number;
  failed: number;
  disputed: number;
  connectedProviders: number;
  disconnectedProviders: number;
  lastSyncAt: string | null;
};

const DEFAULT_SETTINGS: VenuePaymentSettings = {
  providers: {
    stripe: { connected: false },
    swish: { connected: false }
  },
  methods: {
    card: false,
    swish: false,
    applePay: false,
    googlePay: false,
    cash: true,
    invoice: false,
    giftCards: false
  },
  rules: {
    payBeforeOrder: true,
    payAfterMeal: false,
    depositRequired: false,
    minOrderCents: null,
    maxOrderCents: null,
    defaultPaymentMode: "PREPAY"
  },
  refunds: {
    managerApproval: true,
    automaticRefund: false,
    manualRefund: true,
    refundTimeoutHours: 24
  },
  taxes: {
    vatStandardPercent: 12,
    serviceFeePercent: 0,
    deliveryFeeCents: 0,
    tipsEnabled: true
  },
  bankAccount: { linked: false }
};

function mergeSettings(raw: unknown): VenuePaymentSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SETTINGS };
  const s = raw as Partial<VenuePaymentSettings>;
  return {
    providers: {
      stripe: { ...DEFAULT_SETTINGS.providers.stripe, ...(s.providers?.stripe ?? {}) },
      swish: { ...DEFAULT_SETTINGS.providers.swish, ...(s.providers?.swish ?? {}) }
    },
    methods: { ...DEFAULT_SETTINGS.methods, ...(s.methods ?? {}) },
    rules: { ...DEFAULT_SETTINGS.rules, ...(s.rules ?? {}) },
    refunds: { ...DEFAULT_SETTINGS.refunds, ...(s.refunds ?? {}) },
    taxes: { ...DEFAULT_SETTINGS.taxes, ...(s.taxes ?? {}) },
    bankAccount: { ...DEFAULT_SETTINGS.bankAccount, ...(s.bankAccount ?? {}) }
  };
}

export async function getVenuePaymentSettings(prisma: PrismaClient, restaurantId: string) {
  const row = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { paymentSettings: true }
  });
  if (!row) return { ok: false as const, error: "restaurant_not_found" };
  return { ok: true as const, settings: mergeSettings(row.paymentSettings) };
}

export async function updateVenuePaymentSettings(
  prisma: PrismaClient,
  restaurantId: string,
  patch: Partial<VenuePaymentSettings>
) {
  const current = await getVenuePaymentSettings(prisma, restaurantId);
  if (!current.ok) return current;

  const next: VenuePaymentSettings = {
    providers: {
      stripe: { ...current.settings.providers.stripe, ...(patch.providers?.stripe ?? {}) },
      swish: { ...current.settings.providers.swish, ...(patch.providers?.swish ?? {}) }
    },
    methods: { ...current.settings.methods, ...(patch.methods ?? {}) },
    rules: { ...current.settings.rules, ...(patch.rules ?? {}) },
    refunds: { ...current.settings.refunds, ...(patch.refunds ?? {}) },
    taxes: { ...current.settings.taxes, ...(patch.taxes ?? {}) },
    bankAccount: { ...current.settings.bankAccount, ...(patch.bankAccount ?? {}) }
  };

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { paymentSettings: next as unknown as Prisma.InputJsonValue }
  });

  return { ok: true as const, settings: next };
}

export async function connectPaymentProvider(
  prisma: PrismaClient,
  restaurantId: string,
  provider: "stripe" | "swish",
  input: { accountId?: string; merchantId?: string; displayName?: string }
) {
  const current = await getVenuePaymentSettings(prisma, restaurantId);
  if (!current.ok) return current;

  const connectedAt = new Date().toISOString();
  const patch: Partial<VenuePaymentSettings> =
    provider === "stripe"
      ? {
          providers: {
            stripe: {
              connected: true,
              accountId: input.accountId?.trim() || `acct_${restaurantId.slice(0, 8)}`,
              connectedAt,
              displayName: input.displayName?.trim() || "Stripe"
            },
            swish: current.settings.providers.swish
          },
          methods: { ...current.settings.methods, card: true, applePay: true, googlePay: true }
        }
      : {
          providers: {
            stripe: current.settings.providers.stripe,
            swish: {
              connected: true,
              merchantId: input.merchantId?.trim() || `swish_${restaurantId.slice(0, 8)}`,
              connectedAt,
              displayName: input.displayName?.trim() || "Swish"
            }
          },
          methods: { ...current.settings.methods, swish: true }
        };

  return updateVenuePaymentSettings(prisma, restaurantId, patch);
}

export async function disconnectPaymentProvider(
  prisma: PrismaClient,
  restaurantId: string,
  provider: "stripe" | "swish"
) {
  const current = await getVenuePaymentSettings(prisma, restaurantId);
  if (!current.ok) return current;

  const patch: Partial<VenuePaymentSettings> =
    provider === "stripe"
      ? {
          providers: { stripe: { connected: false }, swish: current.settings.providers.swish },
          methods: { ...current.settings.methods, card: false, applePay: false, googlePay: false }
        }
      : {
          providers: { stripe: current.settings.providers.stripe, swish: { connected: false } },
          methods: { ...current.settings.methods, swish: false }
        };

  return updateVenuePaymentSettings(prisma, restaurantId, patch);
}

export async function getVenuePaymentStats(prisma: PrismaClient, restaurantId: string): Promise<PaymentStats> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [paid, pending, refunded, failed, settings, lastRef] = await Promise.all([
    prisma.order.count({ where: { restaurantId, paymentStatus: "PAID" } }),
    prisma.order.count({
      where: { restaurantId, paymentStatus: { in: ["PENDING", "UNPAID"] }, status: "PENDING_PAYMENT" }
    }),
    prisma.order.count({ where: { restaurantId, paymentStatus: { in: ["REFUNDED", "PARTIAL_REFUND"] } } }),
    prisma.order.count({
      where: { restaurantId, paymentStatus: "FAILED", createdAt: { gte: thirtyDaysAgo } }
    }),
    getVenuePaymentSettings(prisma, restaurantId),
    prisma.orderPaymentReference.findFirst({
      where: { restaurantId },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true }
    })
  ]);

  const connected =
    (settings.ok && settings.settings.providers.stripe.connected ? 1 : 0) +
    (settings.ok && settings.settings.providers.swish.connected ? 1 : 0);

  return {
    successful: paid,
    pending,
    refunded,
    failed,
    disputed: 0,
    connectedProviders: connected,
    disconnectedProviders: Math.max(0, 2 - connected),
    lastSyncAt: lastRef?.updatedAt.toISOString() ?? null
  };
}

export function canEditPaymentSettings(role: string, permissions: string[]): boolean {
  const r = role.trim().toUpperCase();
  if (r === "OWNER" || r === "MANAGER") return true;
  return permissions.includes("admin.payment_settings");
}
