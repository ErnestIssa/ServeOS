import type {
  PaymentHealthStatus,
  PaymentMethodConfig,
  PaymentOrderSource,
  PaymentRefundRow,
  PaymentStaffRole,
  PaymentTxnStatus,
  VenuePaymentSettings
} from "../../../api";
import { PAYMENT_METHOD_CATALOG } from "./paymentMethodCatalog";

export function formatSekFromCents(cents: number, currency = "SEK") {
  const value = (cents ?? 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0
    }).format(value);
  } catch {
    return `${Math.round(value).toLocaleString()} ${currency}`;
  }
}

export function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function maskAccountId(id?: string | null) {
  if (!id) return "—";
  const clean = id.trim();
  if (clean.length <= 4) return `•••• ${clean}`;
  return `•••• ${clean.slice(-4)}`;
}

export function healthLabel(status: PaymentHealthStatus) {
  switch (status) {
    case "operational":
      return "Operational";
    case "degraded":
      return "Degraded";
    case "disabled":
      return "Disabled";
    default:
      return "Unknown";
  }
}

export function healthTone(status: PaymentHealthStatus): "success" | "warning" | "danger" | "muted" {
  if (status === "operational") return "success";
  if (status === "degraded") return "warning";
  if (status === "disabled") return "danger";
  return "muted";
}

export function txnStatusLabel(status: PaymentTxnStatus) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function txnStatusClass(status: PaymentTxnStatus) {
  if (status === "captured" || status === "authorized") return "is-success";
  if (status === "pending") return "is-pending";
  if (status === "failed" || status === "cancelled" || status === "charged_back") return "is-danger";
  if (status === "disputed" || status === "partially_refunded") return "is-warning";
  if (status === "refunded") return "is-muted";
  return "";
}

export function refundStatusLabel(status: PaymentRefundRow["status"]) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function methodLabel(key: string) {
  const fromCatalog = PAYMENT_METHOD_CATALOG.find((m) => m.key === key)?.label;
  if (fromCatalog) return fromCatalog;
  const map: Record<string, string> = {
    apple_pay: "Apple Pay",
    google_pay: "Google Pay",
    restaurantCredit: "Restaurant credit",
    loyaltyBalance: "Loyalty balance",
    payAtVenue: "Pay at venue"
  };
  return map[key] ?? key;
}

export const ORDER_SOURCE_LABELS: Record<PaymentOrderSource, string> = {
  qr_orders: "QR orders",
  in_app: "In-app",
  walk_ins: "Walk-ins",
  staff_created: "Staff-created",
  reservations: "Reservations",
  delivery: "Delivery",
  catering: "Catering",
  b2b: "B2B"
};

export const GROUP_LABELS = {
  online: "Online / app",
  venue: "Pay at venue",
  business: "Business"
} as const;

function sourcesForKey(key: string): PaymentOrderSource[] {
  const entry = PAYMENT_METHOD_CATALOG.find((m) => m.key === key);
  if (!entry) return ["qr_orders", "in_app"];
  if (entry.group === "online") return ["qr_orders", "in_app", "delivery"];
  if (entry.group === "venue") return ["qr_orders", "walk_ins", "staff_created", "reservations"];
  return ["catering", "b2b", "staff_created"];
}

export function defaultMethodConfig(key: string): PaymentMethodConfig {
  const entry = PAYMENT_METHOD_CATALOG.find((m) => m.key === key);
  const stripeKeys = new Set([
    "card",
    "visa",
    "mastercard",
    "amex",
    "applePay",
    "googlePay",
    "samsungPay",
    "klarnaPayNow",
    "klarnaPayLater",
    "klarnaInstallments"
  ]);
  const swishKeys = new Set(["swish", "swishAtVenue"]);
  const terminalKeys = new Set([
    "cardTerminal",
    "applePayTerminal",
    "googlePayTerminal",
    "samsungPayTerminal"
  ]);

  let provider: PaymentMethodConfig["provider"] = "manual";
  if (stripeKeys.has(key)) provider = "stripe";
  else if (swishKeys.has(key)) provider = "swish";
  else if (terminalKeys.has(key)) provider = "terminal";

  const venueLike = entry?.group === "venue" || key === "cash";
  const base: PaymentMethodConfig = {
    methodType: key,
    enabled: key === "cash" || key === "payAtVenue",
    displayName: methodLabel(key),
    instructionsStaff: "",
    instructionsCustomer: "",
    supportedOrderSources: sourcesForKey(key),
    currencies: ["SEK"],
    minCents: key === "cash" ? null : 1000,
    maxCents: key === "cash" ? null : 2_000_000,
    allowedRoles: (entry?.group === "business"
      ? ["owner", "manager"]
      : ["owner", "manager", "staff"]) as PaymentStaffRole[],
    requiresStaffConfirmation: Boolean(venueLike || entry?.group === "business"),
    requiresReference: Boolean(
      swishKeys.has(key) || entry?.group === "business" || key === "giftCards"
    ),
    settlementMode: venueLike
      ? swishKeys.has(key)
        ? "provider_verified"
        : "staff_confirmed"
      : "automatic",
    reconciliationMode: venueLike || entry?.group === "business" ? "required" : "provider_match",
    refundPolicy: key === "cash" ? "manager_only" : "standard",
    cancellationPolicy: "allow",
    availabilityRules: { always: true, openHoursOnly: false, scheduleNote: "" },
    provider,
    capture: "automatic",
    refundsEnabled: key !== "cash",
    threeDSecure: terminalKeys.has(key) || key === "cash" ? "never" : "automatic",
    isDefault: key === "cash",
    priority: 100,
    version: 1,
    updatedAt: null
  };

  if (key === "cash") {
    base.instructionsStaff =
      "Record amount tendered. ServeOS calculates change — never trust a client-side change amount.";
  }
  if (key === "swish" || key === "swishAtVenue") {
    base.instructionsStaff = "Verify Swish via provider/reference before marking paid.";
    base.instructionsCustomer = "Complete Swish in your bank app. Saying you paid is not enough.";
  }
  if (key === "payAtVenue") {
    base.instructionsCustomer =
      "Selecting pay at venue does not mark your order paid. Pay when the venue collects.";
  }

  return base;
}

export function getMethodConfig(settings: VenuePaymentSettings | null, key: string): PaymentMethodConfig {
  const base = defaultMethodConfig(key);
  const fromSettings = settings?.methodConfig?.[key];
  const enabled = fromSettings?.enabled ?? Boolean(settings?.methods?.[key] ?? base.enabled);
  if (!fromSettings) {
    return {
      ...base,
      enabled,
      isDefault: settings?.defaultPaymentMethodKey === key || base.isDefault
    };
  }
  return {
    ...base,
    ...fromSettings,
    enabled,
    displayName: fromSettings.displayName || base.displayName,
    instructionsStaff: fromSettings.instructionsStaff ?? base.instructionsStaff,
    instructionsCustomer: fromSettings.instructionsCustomer ?? base.instructionsCustomer,
    supportedOrderSources: fromSettings.supportedOrderSources ?? base.supportedOrderSources,
    currencies: fromSettings.currencies?.length ? fromSettings.currencies : base.currencies,
    allowedRoles: fromSettings.allowedRoles ?? base.allowedRoles,
    availabilityRules: {
      ...base.availabilityRules!,
      ...(fromSettings.availabilityRules ?? {})
    },
    isDefault: settings?.defaultPaymentMethodKey === key || Boolean(fromSettings.isDefault),
    version: fromSettings.version ?? base.version,
    updatedAt: fromSettings.updatedAt ?? null
  };
}

export const PAY_AT_VENUE_TIMING_OPTIONS = [
  { value: "before_served", label: "Before food is served" },
  { value: "when_ready", label: "When order is ready" },
  { value: "when_bill_requested", label: "When bill is requested" },
  { value: "after_completed", label: "After dining is completed" }
] as const;
