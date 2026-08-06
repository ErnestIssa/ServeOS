import type {
  PaymentHealthStatus,
  PaymentMethodConfig,
  PaymentRefundRow,
  PaymentTxnStatus,
  VenuePaymentSettings
} from "../../../api";

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
  const map: Record<string, string> = {
    card: "Card",
    swish: "Swish",
    applePay: "Apple Pay",
    apple_pay: "Apple Pay",
    googlePay: "Google Pay",
    google_pay: "Google Pay",
    cash: "Cash",
    cardTerminal: "Card terminal",
    invoice: "Invoice",
    giftCards: "Gift card",
    restaurantCredit: "Restaurant credit",
    loyaltyBalance: "Loyalty balance",
    payAtVenue: "Pay at venue"
  };
  return map[key] ?? key;
}

export function defaultMethodConfig(key: string): PaymentMethodConfig {
  return {
    enabled: false,
    provider: key === "swish" ? "swish" : key === "cash" || key === "payAtVenue" ? "manual" : "stripe",
    currencies: ["SEK"],
    capture: "automatic",
    refundsEnabled: true,
    threeDSecure: "automatic",
    minCents: 1000,
    maxCents: 2_000_000
  };
}

export function getMethodConfig(settings: VenuePaymentSettings | null, key: string): PaymentMethodConfig {
  const fromSettings = settings?.methodConfig?.[key];
  const base = defaultMethodConfig(key);
  if (!fromSettings) {
    return { ...base, enabled: Boolean(settings?.methods?.[key]) };
  }
  return { ...base, ...fromSettings, enabled: fromSettings.enabled ?? Boolean(settings?.methods?.[key]) };
}

export const PAY_AT_VENUE_TIMING_OPTIONS = [
  { value: "before_served", label: "Before food is served" },
  { value: "when_ready", label: "When food is ready" },
  { value: "when_bill_requested", label: "When customer requests bill" },
  { value: "after_completed", label: "After order is completed" }
] as const;
