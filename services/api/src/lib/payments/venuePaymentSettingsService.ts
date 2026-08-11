import type { Prisma, PrismaClient } from "@prisma/client";
import type { OrderingPaymentMode } from "@prisma/client";

export type PaymentProviderState = {
  connected: boolean;
  accountId?: string;
  merchantId?: string;
  connectedAt?: string;
  displayName?: string;
  environment?: "sandbox" | "production";
};

export type PaymentMethodKey =
  | "card"
  | "visa"
  | "mastercard"
  | "amex"
  | "swish"
  | "applePay"
  | "googlePay"
  | "samsungPay"
  | "klarnaPayNow"
  | "klarnaPayLater"
  | "klarnaInstallments"
  | "cash"
  | "cardTerminal"
  | "swishAtVenue"
  | "applePayTerminal"
  | "googlePayTerminal"
  | "samsungPayTerminal"
  | "giftCards"
  | "invoice"
  | "eInvoice"
  | "bankTransfer"
  | "bankgiro"
  | "plusgiro"
  | "restaurantCredit"
  | "loyaltyBalance"
  | "payAtVenue";

export type PaymentOrderSource =
  | "qr_orders"
  | "in_app"
  | "walk_ins"
  | "staff_created"
  | "reservations"
  | "delivery"
  | "catering"
  | "b2b";

export type PaymentSettlementMode =
  | "automatic"
  | "staff_confirmed"
  | "provider_verified"
  | "manual_reference";

export type PaymentReconciliationMode = "none" | "required" | "provider_match";
export type PaymentRefundPolicy = "standard" | "manager_only" | "disabled" | "provider_only";
export type PaymentCancellationPolicy = "allow" | "manager_only" | "block_if_paid";
export type PaymentStaffRole = "owner" | "manager" | "staff";

export type PaymentMethodConfig = {
  methodType: string;
  enabled: boolean;
  displayName: string;
  instructionsStaff: string;
  instructionsCustomer: string;
  supportedOrderSources: PaymentOrderSource[];
  currencies: string[];
  minCents: number | null;
  maxCents: number | null;
  allowedRoles: PaymentStaffRole[];
  requiresStaffConfirmation: boolean;
  requiresReference: boolean;
  settlementMode: PaymentSettlementMode;
  reconciliationMode: PaymentReconciliationMode;
  refundPolicy: PaymentRefundPolicy;
  cancellationPolicy: PaymentCancellationPolicy;
  availabilityRules: {
    always: boolean;
    openHoursOnly: boolean;
    scheduleNote: string;
  };
  provider?: "stripe" | "swish" | "terminal" | "manual" | "none";
  capture: "automatic" | "manual";
  refundsEnabled: boolean;
  threeDSecure: "automatic" | "always" | "never";
  isDefault: boolean;
  priority: number;
  version: number;
  updatedAt: string | null;
};

export type PayAtVenueTiming =
  | "before_served"
  | "when_ready"
  | "when_bill_requested"
  | "after_completed";

export type VenuePaymentAuditEntry = {
  id: string;
  at: string;
  actorUserId?: string;
  actorRole?: string;
  action: string;
  path: string;
  oldValue?: unknown;
  newValue?: unknown;
};

export type VenuePaymentSettings = {
  providers: {
    stripe: PaymentProviderState;
    swish: PaymentProviderState;
  };
  methods: {
    card: boolean;
    visa: boolean;
    mastercard: boolean;
    amex: boolean;
    swish: boolean;
    applePay: boolean;
    googlePay: boolean;
    samsungPay: boolean;
    klarnaPayNow: boolean;
    klarnaPayLater: boolean;
    klarnaInstallments: boolean;
    cash: boolean;
    cardTerminal: boolean;
    swishAtVenue: boolean;
    applePayTerminal: boolean;
    googlePayTerminal: boolean;
    samsungPayTerminal: boolean;
    giftCards: boolean;
    invoice: boolean;
    eInvoice: boolean;
    bankTransfer: boolean;
    bankgiro: boolean;
    plusgiro: boolean;
    restaurantCredit: boolean;
    loyaltyBalance: boolean;
    payAtVenue: boolean;
  };
  methodConfig: Partial<Record<PaymentMethodKey, PaymentMethodConfig>>;
  /** Venue default settlement method key (SSOT). Selecting “Pay at venue” never marks an order paid. */
  defaultPaymentMethodKey: string | null;
  rules: {
    payBeforeOrder: boolean;
    payAfterMeal: boolean;
    depositRequired: boolean;
    minOrderCents: number | null;
    maxOrderCents: number | null;
    defaultPaymentMode: OrderingPaymentMode;
  };
  payAtVenue: {
    enabled: boolean;
    timing: PayAtVenueTiming;
    channels: {
      qrOrders: boolean;
      walkIns: boolean;
      staffCreated: boolean;
      reservations: boolean;
      delivery: boolean;
    };
    settlementMethods: {
      cash: boolean;
      cardTerminal: boolean;
      swish: boolean;
      other: boolean;
    };
  };
  qrPolicy: {
    defaultPaymentMode: OrderingPaymentMode;
    allowSwitchToApp: boolean;
    requirePaymentBeforePrep: boolean;
    allowUnpaidOrders: boolean;
    autoCloseUnpaidHours: number | null;
    requireStaffConfirmation: boolean;
  };
  splits: {
    enabled: boolean;
    maxSplits: number;
    allowCustomerSelfSplit: boolean;
    allowStaffSplit: boolean;
    allowEqualSplit: boolean;
    allowItemBasedSplit: boolean;
    allowCustomAmount: boolean;
  };
  tips: {
    enabled: boolean;
    suggestedPercents: number[];
    customTip: boolean;
    tipBeforePayment: boolean;
    tipAfterPayment: boolean;
    cashTipsMode: "track_manually" | "ignore";
  };
  failedPayment: {
    remainUnpaid: boolean;
    allowRetry: boolean;
    blockKitchen: boolean;
    allowStaffAcceptUnpaid: boolean;
  };
  refunds: {
    managerApproval: boolean;
    automaticRefund: boolean;
    manualRefund: boolean;
    refundTimeoutHours: number;
  };
  refundLimits: {
    staffMaxCents: number;
    managerMaxCents: number;
    ownerUnlimited: boolean;
  };
  taxes: {
    vatStandardPercent: number;
    serviceFeePercent: number;
    deliveryFeeCents: number;
    tipsEnabled: boolean;
  };
  taxDisplay: {
    managedIn: "restaurant_taxes";
    pricesIncludeTax: boolean;
    calculation: "backend";
  };
  bankAccount: {
    linked: boolean;
    lastFour?: string;
    holderName?: string;
  };
  auditLog: VenuePaymentAuditEntry[];
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

const ONLINE_SOURCES: PaymentOrderSource[] = ["qr_orders", "in_app", "delivery"];
const VENUE_SOURCES: PaymentOrderSource[] = ["qr_orders", "walk_ins", "staff_created", "reservations"];
const BUSINESS_SOURCES: PaymentOrderSource[] = ["catering", "b2b", "staff_created"];

const DEFAULT_METHOD_CONFIG: PaymentMethodConfig = {
  methodType: "card",
  enabled: false,
  displayName: "",
  instructionsStaff: "",
  instructionsCustomer: "",
  supportedOrderSources: [...ONLINE_SOURCES],
  currencies: ["SEK"],
  minCents: 1000,
  maxCents: 2_000_000,
  allowedRoles: ["owner", "manager", "staff"],
  requiresStaffConfirmation: false,
  requiresReference: false,
  settlementMode: "automatic",
  reconciliationMode: "provider_match",
  refundPolicy: "standard",
  cancellationPolicy: "allow",
  availabilityRules: { always: true, openHoursOnly: false, scheduleNote: "" },
  provider: "none",
  capture: "automatic",
  refundsEnabled: true,
  threeDSecure: "automatic",
  isDefault: false,
  priority: 100,
  version: 1,
  updatedAt: null
};

function methodDisplayName(key: PaymentMethodKey): string {
  const map: Partial<Record<PaymentMethodKey, string>> = {
    card: "Card via payment provider",
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "American Express",
    swish: "Swish",
    applePay: "Apple Pay",
    googlePay: "Google Pay",
    samsungPay: "Samsung Pay",
    klarnaPayNow: "Klarna — Pay now",
    klarnaPayLater: "Klarna — Pay later",
    klarnaInstallments: "Klarna — Installments",
    cash: "Cash",
    cardTerminal: "Card terminal",
    swishAtVenue: "Swish",
    applePayTerminal: "Apple Pay at terminal",
    googlePayTerminal: "Google Pay at terminal",
    samsungPayTerminal: "Samsung Pay at terminal",
    giftCards: "Gift card",
    invoice: "Invoice",
    eInvoice: "E-invoice",
    bankTransfer: "Bank transfer",
    bankgiro: "Bankgiro",
    plusgiro: "PlusGiro",
    restaurantCredit: "Restaurant credit",
    loyaltyBalance: "Loyalty balance",
    payAtVenue: "Pay at venue"
  };
  return map[key] ?? key;
}

function defaultMethodConfig(key: PaymentMethodKey): PaymentMethodConfig {
  const base: PaymentMethodConfig = {
    ...DEFAULT_METHOD_CONFIG,
    methodType: key,
    displayName: methodDisplayName(key),
    availabilityRules: { ...DEFAULT_METHOD_CONFIG.availabilityRules }
  };

  const online = new Set<PaymentMethodKey>([
    "card",
    "visa",
    "mastercard",
    "amex",
    "swish",
    "applePay",
    "googlePay",
    "samsungPay",
    "klarnaPayNow",
    "klarnaPayLater",
    "klarnaInstallments"
  ]);
  const venue = new Set<PaymentMethodKey>([
    "cash",
    "cardTerminal",
    "swishAtVenue",
    "applePayTerminal",
    "googlePayTerminal",
    "samsungPayTerminal",
    "giftCards",
    "payAtVenue"
  ]);

  if (online.has(key)) {
    base.supportedOrderSources = [...ONLINE_SOURCES];
  } else if (venue.has(key)) {
    base.supportedOrderSources = [...VENUE_SOURCES];
  } else {
    base.supportedOrderSources = [...BUSINESS_SOURCES];
  }

  switch (key) {
    case "card":
    case "visa":
    case "mastercard":
    case "amex":
    case "applePay":
    case "googlePay":
    case "samsungPay":
    case "klarnaPayNow":
    case "klarnaPayLater":
    case "klarnaInstallments":
      return {
        ...base,
        provider: "stripe",
        settlementMode: "automatic",
        reconciliationMode: "provider_match",
        requiresStaffConfirmation: false,
        requiresReference: false
      };
    case "swish":
      return {
        ...base,
        provider: "swish",
        settlementMode: "provider_verified",
        reconciliationMode: "provider_match",
        requiresReference: true,
        instructionsCustomer: "Complete the Swish payment in your bank app. Saying you paid is not enough."
      };
    case "swishAtVenue":
      return {
        ...base,
        provider: "swish",
        settlementMode: "provider_verified",
        reconciliationMode: "provider_match",
        requiresStaffConfirmation: true,
        requiresReference: true,
        instructionsStaff: "Verify Swish payment via provider/reference before marking the order paid."
      };
    case "cardTerminal":
    case "applePayTerminal":
    case "googlePayTerminal":
    case "samsungPayTerminal":
      return {
        ...base,
        provider: "terminal",
        threeDSecure: "never",
        settlementMode: "staff_confirmed",
        reconciliationMode: "provider_match",
        requiresStaffConfirmation: true,
        instructionsStaff: "Confirm the terminal/provider result. Do not mark paid on customer claim alone."
      };
    case "cash":
      return {
        ...base,
        provider: "manual",
        enabled: true,
        refundsEnabled: false,
        threeDSecure: "never",
        minCents: null,
        maxCents: null,
        settlementMode: "staff_confirmed",
        reconciliationMode: "required",
        refundPolicy: "manager_only",
        requiresStaffConfirmation: true,
        requiresReference: false,
        instructionsStaff: "Record amount tendered. ServeOS calculates change — never trust a client-side change amount."
      };
    case "giftCards":
    case "restaurantCredit":
    case "loyaltyBalance":
      return {
        ...base,
        provider: "manual",
        threeDSecure: "never",
        settlementMode: "provider_verified",
        reconciliationMode: "required",
        requiresStaffConfirmation: true,
        requiresReference: true,
        instructionsStaff: "Validate balance and redemption in ServeOS before completing payment."
      };
    case "payAtVenue":
      return {
        ...base,
        provider: "manual",
        enabled: true,
        threeDSecure: "never",
        settlementMode: "staff_confirmed",
        reconciliationMode: "required",
        requiresStaffConfirmation: true,
        instructionsCustomer: "Selecting pay at venue does not mark your order paid. Pay when the venue collects."
      };
    case "invoice":
    case "eInvoice":
    case "bankTransfer":
    case "bankgiro":
    case "plusgiro":
      return {
        ...base,
        provider: "manual",
        threeDSecure: "never",
        settlementMode: "manual_reference",
        reconciliationMode: "required",
        refundPolicy: "manager_only",
        requiresStaffConfirmation: true,
        requiresReference: true,
        allowedRoles: ["owner", "manager"]
      };
    default:
      return base;
  }
}

const DEFAULT_SETTINGS: VenuePaymentSettings = {
  providers: {
    stripe: { connected: false, environment: "sandbox" },
    swish: { connected: false, environment: "sandbox" }
  },
  methods: {
    card: false,
    visa: false,
    mastercard: false,
    amex: false,
    swish: false,
    applePay: false,
    googlePay: false,
    samsungPay: false,
    klarnaPayNow: false,
    klarnaPayLater: false,
    klarnaInstallments: false,
    cash: true,
    cardTerminal: false,
    swishAtVenue: false,
    applePayTerminal: false,
    googlePayTerminal: false,
    samsungPayTerminal: false,
    giftCards: false,
    invoice: false,
    eInvoice: false,
    bankTransfer: false,
    bankgiro: false,
    plusgiro: false,
    restaurantCredit: false,
    loyaltyBalance: false,
    payAtVenue: true
  },
  methodConfig: {
    card: defaultMethodConfig("card"),
    visa: defaultMethodConfig("visa"),
    mastercard: defaultMethodConfig("mastercard"),
    amex: defaultMethodConfig("amex"),
    swish: defaultMethodConfig("swish"),
    applePay: defaultMethodConfig("applePay"),
    googlePay: defaultMethodConfig("googlePay"),
    samsungPay: defaultMethodConfig("samsungPay"),
    klarnaPayNow: defaultMethodConfig("klarnaPayNow"),
    klarnaPayLater: defaultMethodConfig("klarnaPayLater"),
    klarnaInstallments: defaultMethodConfig("klarnaInstallments"),
    cash: defaultMethodConfig("cash"),
    cardTerminal: defaultMethodConfig("cardTerminal"),
    swishAtVenue: defaultMethodConfig("swishAtVenue"),
    applePayTerminal: defaultMethodConfig("applePayTerminal"),
    googlePayTerminal: defaultMethodConfig("googlePayTerminal"),
    samsungPayTerminal: defaultMethodConfig("samsungPayTerminal"),
    giftCards: defaultMethodConfig("giftCards"),
    invoice: defaultMethodConfig("invoice"),
    eInvoice: defaultMethodConfig("eInvoice"),
    bankTransfer: defaultMethodConfig("bankTransfer"),
    bankgiro: defaultMethodConfig("bankgiro"),
    plusgiro: defaultMethodConfig("plusgiro"),
    restaurantCredit: defaultMethodConfig("restaurantCredit"),
    loyaltyBalance: defaultMethodConfig("loyaltyBalance"),
    payAtVenue: defaultMethodConfig("payAtVenue")
  },
  defaultPaymentMethodKey: "cash",
  rules: {
    payBeforeOrder: true,
    payAfterMeal: false,
    depositRequired: false,
    minOrderCents: null,
    maxOrderCents: null,
    defaultPaymentMode: "PREPAY"
  },
  payAtVenue: {
    enabled: true,
    timing: "when_bill_requested",
    channels: {
      qrOrders: true,
      walkIns: true,
      staffCreated: true,
      reservations: true,
      delivery: false
    },
    settlementMethods: {
      cash: true,
      cardTerminal: true,
      swish: true,
      other: false
    }
  },
  qrPolicy: {
    defaultPaymentMode: "PAY_AT_VENUE",
    allowSwitchToApp: true,
    requirePaymentBeforePrep: false,
    allowUnpaidOrders: true,
    autoCloseUnpaidHours: 4,
    requireStaffConfirmation: false
  },
  splits: {
    enabled: true,
    maxSplits: 10,
    allowCustomerSelfSplit: true,
    allowStaffSplit: true,
    allowEqualSplit: true,
    allowItemBasedSplit: true,
    allowCustomAmount: true
  },
  tips: {
    enabled: true,
    suggestedPercents: [10, 15, 20],
    customTip: true,
    tipBeforePayment: true,
    tipAfterPayment: true,
    cashTipsMode: "track_manually"
  },
  failedPayment: {
    remainUnpaid: true,
    allowRetry: true,
    blockKitchen: true,
    allowStaffAcceptUnpaid: false
  },
  refunds: {
    managerApproval: true,
    automaticRefund: false,
    manualRefund: true,
    refundTimeoutHours: 24
  },
  refundLimits: {
    staffMaxCents: 20_000,
    managerMaxCents: 500_000,
    ownerUnlimited: true
  },
  taxes: {
    vatStandardPercent: 12,
    serviceFeePercent: 0,
    deliveryFeeCents: 0,
    tipsEnabled: true
  },
  taxDisplay: {
    managedIn: "restaurant_taxes",
    pricesIncludeTax: true,
    calculation: "backend"
  },
  bankAccount: { linked: false },
  auditLog: []
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function mergeMethodConfig(raw: unknown): Partial<Record<PaymentMethodKey, PaymentMethodConfig>> {
  const src = asRecord(raw);
  const keys = Object.keys(DEFAULT_SETTINGS.methodConfig) as PaymentMethodKey[];
  const out: Partial<Record<PaymentMethodKey, PaymentMethodConfig>> = {};
  for (const key of keys) {
    const base = defaultMethodConfig(key);
    const patch = asRecord(src[key]);
    const availabilityIn = asRecord(patch.availabilityRules);
    out[key] = {
      ...base,
      ...patch,
      methodType: typeof patch.methodType === "string" ? patch.methodType : key,
      displayName: typeof patch.displayName === "string" ? patch.displayName : base.displayName,
      instructionsStaff:
        typeof patch.instructionsStaff === "string" ? patch.instructionsStaff : base.instructionsStaff,
      instructionsCustomer:
        typeof patch.instructionsCustomer === "string"
          ? patch.instructionsCustomer
          : base.instructionsCustomer,
      supportedOrderSources: Array.isArray(patch.supportedOrderSources)
        ? (patch.supportedOrderSources as PaymentOrderSource[])
        : base.supportedOrderSources,
      currencies: Array.isArray(patch.currencies) ? (patch.currencies as string[]) : base.currencies,
      allowedRoles: Array.isArray(patch.allowedRoles)
        ? (patch.allowedRoles as PaymentStaffRole[])
        : base.allowedRoles,
      availabilityRules: {
        always:
          typeof availabilityIn.always === "boolean" ? availabilityIn.always : base.availabilityRules.always,
        openHoursOnly:
          typeof availabilityIn.openHoursOnly === "boolean"
            ? availabilityIn.openHoursOnly
            : base.availabilityRules.openHoursOnly,
        scheduleNote:
          typeof availabilityIn.scheduleNote === "string"
            ? availabilityIn.scheduleNote
            : base.availabilityRules.scheduleNote
      },
      minCents:
        typeof patch.minCents === "number" || patch.minCents === null
          ? (patch.minCents as number | null)
          : base.minCents,
      maxCents:
        typeof patch.maxCents === "number" || patch.maxCents === null
          ? (patch.maxCents as number | null)
          : base.maxCents,
      version: typeof patch.version === "number" ? patch.version : base.version,
      updatedAt: typeof patch.updatedAt === "string" || patch.updatedAt === null ? (patch.updatedAt as string | null) : base.updatedAt,
      isDefault: typeof patch.isDefault === "boolean" ? patch.isDefault : base.isDefault,
      priority: typeof patch.priority === "number" ? patch.priority : base.priority
    };
  }
  return out;
}

export function mergeSettings(raw: unknown): VenuePaymentSettings {
  if (!raw || typeof raw !== "object") return structuredClone(DEFAULT_SETTINGS);
  const s = raw as Partial<VenuePaymentSettings> & Record<string, unknown>;
  const methodsIn = asRecord(s.methods);
  const tipsEnabled =
    typeof (s.tips as { enabled?: boolean } | undefined)?.enabled === "boolean"
      ? (s.tips as { enabled: boolean }).enabled
      : typeof (s.taxes as { tipsEnabled?: boolean } | undefined)?.tipsEnabled === "boolean"
        ? (s.taxes as { tipsEnabled: boolean }).tipsEnabled
        : DEFAULT_SETTINGS.tips.enabled;

  return {
    providers: {
      stripe: {
        ...DEFAULT_SETTINGS.providers.stripe,
        ...(s.providers?.stripe ?? {})
      },
      swish: {
        ...DEFAULT_SETTINGS.providers.swish,
        ...(s.providers?.swish ?? {})
      }
    },
    methods: {
      ...DEFAULT_SETTINGS.methods,
      ...methodsIn,
      cardTerminal: typeof methodsIn.cardTerminal === "boolean" ? methodsIn.cardTerminal : DEFAULT_SETTINGS.methods.cardTerminal,
      restaurantCredit:
        typeof methodsIn.restaurantCredit === "boolean"
          ? methodsIn.restaurantCredit
          : DEFAULT_SETTINGS.methods.restaurantCredit,
      loyaltyBalance:
        typeof methodsIn.loyaltyBalance === "boolean"
          ? methodsIn.loyaltyBalance
          : DEFAULT_SETTINGS.methods.loyaltyBalance,
      payAtVenue:
        typeof methodsIn.payAtVenue === "boolean" ? methodsIn.payAtVenue : DEFAULT_SETTINGS.methods.payAtVenue
    },
    methodConfig: mergeMethodConfig(s.methodConfig),
    defaultPaymentMethodKey:
      typeof s.defaultPaymentMethodKey === "string" || s.defaultPaymentMethodKey === null
        ? (s.defaultPaymentMethodKey as string | null)
        : DEFAULT_SETTINGS.defaultPaymentMethodKey,
    rules: { ...DEFAULT_SETTINGS.rules, ...(s.rules ?? {}) },
    payAtVenue: {
      ...DEFAULT_SETTINGS.payAtVenue,
      ...(s.payAtVenue ?? {}),
      channels: { ...DEFAULT_SETTINGS.payAtVenue.channels, ...(s.payAtVenue?.channels ?? {}) },
      settlementMethods: {
        ...DEFAULT_SETTINGS.payAtVenue.settlementMethods,
        ...(s.payAtVenue?.settlementMethods ?? {})
      }
    },
    qrPolicy: { ...DEFAULT_SETTINGS.qrPolicy, ...(s.qrPolicy ?? {}) },
    splits: { ...DEFAULT_SETTINGS.splits, ...(s.splits ?? {}) },
    tips: {
      ...DEFAULT_SETTINGS.tips,
      ...(s.tips ?? {}),
      enabled: tipsEnabled,
      suggestedPercents: Array.isArray(s.tips?.suggestedPercents)
        ? s.tips!.suggestedPercents
        : DEFAULT_SETTINGS.tips.suggestedPercents
    },
    failedPayment: { ...DEFAULT_SETTINGS.failedPayment, ...(s.failedPayment ?? {}) },
    refunds: { ...DEFAULT_SETTINGS.refunds, ...(s.refunds ?? {}) },
    refundLimits: { ...DEFAULT_SETTINGS.refundLimits, ...(s.refundLimits ?? {}) },
    taxes: {
      ...DEFAULT_SETTINGS.taxes,
      ...(s.taxes ?? {}),
      tipsEnabled
    },
    taxDisplay: { ...DEFAULT_SETTINGS.taxDisplay, ...(s.taxDisplay ?? {}) },
    bankAccount: { ...DEFAULT_SETTINGS.bankAccount, ...(s.bankAccount ?? {}) },
    auditLog: Array.isArray(s.auditLog) ? s.auditLog.slice(0, 100) : []
  };
}

function appendAudit(
  current: VenuePaymentSettings,
  entry: Omit<VenuePaymentAuditEntry, "id" | "at"> & { id?: string; at?: string }
): VenuePaymentAuditEntry[] {
  const next: VenuePaymentAuditEntry = {
    id: entry.id ?? `aud_${Date.now().toString(36)}`,
    at: entry.at ?? new Date().toISOString(),
    actorUserId: entry.actorUserId,
    actorRole: entry.actorRole,
    action: entry.action,
    path: entry.path,
    oldValue: entry.oldValue,
    newValue: entry.newValue
  };
  return [next, ...current.auditLog].slice(0, 100);
}

export function getPaymentProviderEnvReady() {
  return {
    stripe: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
    swish: Boolean(process.env.SWISH_PAYEE_ALIAS?.trim() || process.env.SWISH_CERT_PATH?.trim()),
    webhook: Boolean(process.env.PAYMENT_WEBHOOK_SECRET?.trim() || process.env.STRIPE_WEBHOOK_SECRET?.trim()),
    demoLedger: process.env.PAYMENT_DEMO_LEDGER !== "false"
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
  patch: Partial<VenuePaymentSettings>,
  audit?: { actorUserId?: string; actorRole?: string; action?: string; path?: string }
) {
  const current = await getVenuePaymentSettings(prisma, restaurantId);
  if (!current.ok) return current;

  const nowIso = new Date().toISOString();
  const nextMethods = { ...current.settings.methods, ...(patch.methods ?? {}) };
  const nextMethodConfig = { ...current.settings.methodConfig };
  let defaultPaymentMethodKey =
    patch.defaultPaymentMethodKey !== undefined
      ? patch.defaultPaymentMethodKey
      : current.settings.defaultPaymentMethodKey;

  if (patch.methodConfig) {
    for (const [rawKey, cfgPatch] of Object.entries(patch.methodConfig)) {
      const key = rawKey as PaymentMethodKey;
      const prev = nextMethodConfig[key] ?? defaultMethodConfig(key);
      const merged: PaymentMethodConfig = {
        ...prev,
        ...cfgPatch,
        availabilityRules: {
          ...prev.availabilityRules,
          ...(cfgPatch.availabilityRules ?? {})
        },
        supportedOrderSources: cfgPatch.supportedOrderSources ?? prev.supportedOrderSources,
        allowedRoles: cfgPatch.allowedRoles ?? prev.allowedRoles,
        currencies: cfgPatch.currencies ?? prev.currencies,
        version: (prev.version ?? 1) + 1,
        updatedAt: nowIso
      };
      nextMethodConfig[key] = merged;
      nextMethods[key] = merged.enabled;
      if (merged.isDefault) {
        defaultPaymentMethodKey = key;
      }
    }
  }

  if (defaultPaymentMethodKey) {
    for (const key of Object.keys(nextMethodConfig) as PaymentMethodKey[]) {
      const cfg = nextMethodConfig[key];
      if (!cfg) continue;
      nextMethodConfig[key] = {
        ...cfg,
        isDefault: key === defaultPaymentMethodKey
      };
    }
  }

  const next = mergeSettings({
    ...current.settings,
    ...patch,
    providers: {
      stripe: { ...current.settings.providers.stripe, ...(patch.providers?.stripe ?? {}) },
      swish: { ...current.settings.providers.swish, ...(patch.providers?.swish ?? {}) }
    },
    methods: nextMethods,
    methodConfig: nextMethodConfig,
    defaultPaymentMethodKey,
    rules: { ...current.settings.rules, ...(patch.rules ?? {}) },
    payAtVenue: {
      ...current.settings.payAtVenue,
      ...(patch.payAtVenue ?? {}),
      channels: {
        ...current.settings.payAtVenue.channels,
        ...(patch.payAtVenue?.channels ?? {})
      },
      settlementMethods: {
        ...current.settings.payAtVenue.settlementMethods,
        ...(patch.payAtVenue?.settlementMethods ?? {})
      }
    },
    qrPolicy: { ...current.settings.qrPolicy, ...(patch.qrPolicy ?? {}) },
    splits: { ...current.settings.splits, ...(patch.splits ?? {}) },
    tips: { ...current.settings.tips, ...(patch.tips ?? {}) },
    failedPayment: { ...current.settings.failedPayment, ...(patch.failedPayment ?? {}) },
    refunds: { ...current.settings.refunds, ...(patch.refunds ?? {}) },
    refundLimits: { ...current.settings.refundLimits, ...(patch.refundLimits ?? {}) },
    taxes: {
      ...current.settings.taxes,
      ...(patch.taxes ?? {}),
      tipsEnabled: patch.tips?.enabled ?? patch.taxes?.tipsEnabled ?? current.settings.taxes.tipsEnabled
    },
    taxDisplay: { ...current.settings.taxDisplay, ...(patch.taxDisplay ?? {}) },
    bankAccount: { ...current.settings.bankAccount, ...(patch.bankAccount ?? {}) },
    auditLog: current.settings.auditLog
  });

  if (patch.tips?.enabled !== undefined) {
    next.taxes.tipsEnabled = patch.tips.enabled;
  }

  const methodKeysPatched = patch.methodConfig ? Object.keys(patch.methodConfig) : [];
  next.auditLog = appendAudit(current.settings, {
    actorUserId: audit?.actorUserId,
    actorRole: audit?.actorRole,
    action: audit?.action ?? (methodKeysPatched.length === 1 ? "payment_method_updated" : "payment_settings_updated"),
    path: audit?.path ?? (methodKeysPatched.length === 1 ? `methods.${methodKeysPatched[0]}` : "settings"),
    oldValue:
      methodKeysPatched.length === 1
        ? current.settings.methodConfig[methodKeysPatched[0] as PaymentMethodKey] ?? null
        : undefined,
    newValue:
      methodKeysPatched.length === 1
        ? next.methodConfig[methodKeysPatched[0] as PaymentMethodKey] ?? Object.keys(patch)
        : Object.keys(patch)
  });

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
  input: { accountId?: string; merchantId?: string; displayName?: string },
  audit?: { actorUserId?: string; actorRole?: string }
) {
  const current = await getVenuePaymentSettings(prisma, restaurantId);
  if (!current.ok) return current;

  const connectedAt = new Date().toISOString();
  const envReady = getPaymentProviderEnvReady();
  const patch: Partial<VenuePaymentSettings> =
    provider === "stripe"
      ? {
          providers: {
            stripe: {
              connected: true,
              accountId: input.accountId?.trim() || `acct_${restaurantId.slice(0, 8)}`,
              connectedAt,
              displayName: input.displayName?.trim() || "Stripe",
              environment: envReady.stripe ? "production" : "sandbox"
            },
            swish: current.settings.providers.swish
          },
          methods: {
            ...current.settings.methods,
            card: true,
            applePay: true,
            googlePay: true
          }
        }
      : {
          providers: {
            stripe: current.settings.providers.stripe,
            swish: {
              connected: true,
              merchantId: input.merchantId?.trim() || `swish_${restaurantId.slice(0, 8)}`,
              connectedAt,
              displayName: input.displayName?.trim() || "Swish",
              environment: envReady.swish ? "production" : "sandbox"
            }
          },
          methods: { ...current.settings.methods, swish: true }
        };

  const result = await updateVenuePaymentSettings(prisma, restaurantId, patch, {
    ...audit,
    action: `provider_connected_${provider}`,
    path: `providers.${provider}`
  });
  if (!result.ok) return result;
  return {
    ...result,
    needsEnv: provider === "stripe" ? !envReady.stripe : !envReady.swish,
    envReady
  };
}

export async function disconnectPaymentProvider(
  prisma: PrismaClient,
  restaurantId: string,
  provider: "stripe" | "swish",
  audit?: { actorUserId?: string; actorRole?: string }
) {
  const current = await getVenuePaymentSettings(prisma, restaurantId);
  if (!current.ok) return current;

  const patch: Partial<VenuePaymentSettings> =
    provider === "stripe"
      ? {
          providers: { stripe: { connected: false, environment: "sandbox" }, swish: current.settings.providers.swish },
          methods: { ...current.settings.methods, card: false, applePay: false, googlePay: false }
        }
      : {
          providers: { stripe: current.settings.providers.stripe, swish: { connected: false, environment: "sandbox" } },
          methods: { ...current.settings.methods, swish: false }
        };

  return updateVenuePaymentSettings(prisma, restaurantId, patch, {
    ...audit,
    action: `provider_disconnected_${provider}`,
    path: `providers.${provider}`
  });
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

export function authorizeRefundAmount(
  settings: VenuePaymentSettings,
  role: string,
  amountCents: number
): { ok: true } | { ok: false; error: "refund_limit_exceeded" } {
  const r = role.trim().toUpperCase();
  if (r === "OWNER" && settings.refundLimits.ownerUnlimited) return { ok: true };
  if (r === "OWNER" || r === "MANAGER") {
    if (amountCents <= settings.refundLimits.managerMaxCents) return { ok: true };
    return { ok: false, error: "refund_limit_exceeded" };
  }
  if (amountCents <= settings.refundLimits.staffMaxCents) return { ok: true };
  return { ok: false, error: "refund_limit_exceeded" };
}
