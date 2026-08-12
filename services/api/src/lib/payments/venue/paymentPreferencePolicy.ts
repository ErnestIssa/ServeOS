import type { PaymentOrderSource, VenuePaymentSettings } from "../venue/venuePaymentSettingsService.js";

export type PaymentPreferenceContext =
  | "QR_ORDER"
  | "IN_APP"
  | "WALK_IN"
  | "STAFF_CREATED"
  | "DELIVERY"
  | "CATERING"
  | "B2B";

export type PaymentPreferencePolicy = {
  preferredMethodKey: string | null;
  fallbackMethodKeys: string[];
  preferPayAtVenue: boolean;
  preferOnline: boolean;
};

const CONTEXT_DEFAULTS: Record<PaymentPreferenceContext, PaymentPreferencePolicy> = {
  QR_ORDER: {
    preferredMethodKey: "cash",
    fallbackMethodKeys: ["cardTerminal", "swishAtVenue", "swish", "card"],
    preferPayAtVenue: true,
    preferOnline: false
  },
  IN_APP: {
    preferredMethodKey: "swish",
    fallbackMethodKeys: ["card", "applePay", "googlePay"],
    preferPayAtVenue: false,
    preferOnline: true
  },
  WALK_IN: {
    preferredMethodKey: "cardTerminal",
    fallbackMethodKeys: ["cash", "swishAtVenue"],
    preferPayAtVenue: true,
    preferOnline: false
  },
  STAFF_CREATED: {
    preferredMethodKey: "cardTerminal",
    fallbackMethodKeys: ["cash", "swishAtVenue"],
    preferPayAtVenue: true,
    preferOnline: false
  },
  DELIVERY: {
    preferredMethodKey: "card",
    fallbackMethodKeys: ["swish", "applePay", "googlePay"],
    preferPayAtVenue: false,
    preferOnline: true
  },
  CATERING: {
    preferredMethodKey: "invoice",
    fallbackMethodKeys: ["bankTransfer", "bankgiro", "card"],
    preferPayAtVenue: false,
    preferOnline: false
  },
  B2B: {
    preferredMethodKey: "invoice",
    fallbackMethodKeys: ["eInvoice", "bankgiro", "plusgiro"],
    preferPayAtVenue: false,
    preferOnline: false
  }
};

export function mapOrderSourceToPreferenceContext(source: PaymentOrderSource): PaymentPreferenceContext {
  switch (source) {
    case "qr_orders":
      return "QR_ORDER";
    case "in_app":
      return "IN_APP";
    case "walk_ins":
      return "WALK_IN";
    case "staff_created":
      return "STAFF_CREATED";
    case "delivery":
      return "DELIVERY";
    case "catering":
      return "CATERING";
    case "b2b":
      return "B2B";
    case "reservations":
      return "WALK_IN";
    default:
      return "QR_ORDER";
  }
}

export function resolvePaymentPreferencePolicy(
  settings: VenuePaymentSettings,
  context: PaymentPreferenceContext
): PaymentPreferencePolicy {
  const base = { ...CONTEXT_DEFAULTS[context], fallbackMethodKeys: [...CONTEXT_DEFAULTS[context].fallbackMethodKeys] };
  const stored = settings.preferencePolicies?.[context];
  if (!stored) {
    // Fall back to global default when it fits the context preferred family.
    if (settings.defaultPaymentMethodKey) {
      return { ...base, preferredMethodKey: settings.defaultPaymentMethodKey };
    }
    return base;
  }
  return {
    preferredMethodKey: stored.preferredMethodKey ?? base.preferredMethodKey,
    fallbackMethodKeys: stored.fallbackMethodKeys?.length ? stored.fallbackMethodKeys : base.fallbackMethodKeys,
    preferPayAtVenue: stored.preferPayAtVenue ?? base.preferPayAtVenue,
    preferOnline: stored.preferOnline ?? base.preferOnline
  };
}
