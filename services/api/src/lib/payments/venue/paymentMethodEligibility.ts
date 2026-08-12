import { getCatalogEntry, CATALOG_METHOD_KEYS } from "../catalog/paymentMethodCatalog.js";
import type { PaymentProviderEnvReady, PaymentOrderSource, VenuePaymentSettings } from "./venuePaymentSettingsService.js";
import { evaluatePaymentMethodReadiness } from "./paymentMethodReadiness.js";
import {
  mapOrderSourceToPreferenceContext,
  resolvePaymentPreferencePolicy,
  type PaymentPreferenceContext
} from "./paymentPreferencePolicy.js";
import { resolveAdapterConnection } from "../providers/providerCapabilityResolver.js";

export type PaymentEligibilityReasonCode =
  | "OK"
  | "NOT_IN_CATALOG"
  | "NOT_SUPPORTED"
  | "NOT_ENABLED"
  | "NOT_READY"
  | "PROVIDER_UNHEALTHY"
  | "SOURCE_NOT_ALLOWED"
  | "CURRENCY_MISMATCH"
  | "AMOUNT_TOO_LOW"
  | "AMOUNT_TOO_HIGH"
  | "METHOD_DISABLED_FOR_NEW"
  | "FORGED_METHOD";

export type PaymentMethodEligibility = {
  methodId: string;
  eligible: boolean;
  reasonCode: PaymentEligibilityReasonCode;
  reasonMessage: string;
  priority: number;
  recommended: boolean;
  readinessStatus: string;
};

export type ResolveEligiblePaymentMethodsInput = {
  restaurantId: string;
  orderId?: string;
  source: PaymentOrderSource | PaymentPreferenceContext;
  amountCents: number;
  currency: string;
  customerContext?: { country?: string };
  paymentContext?: { allowPayAtVenue?: boolean; allowOnline?: boolean };
  /** Reject any method not in this allow-list when provided by a client (anti-forgery). */
  requestedMethodIds?: string[];
};

function asOrderSource(source: ResolveEligiblePaymentMethodsInput["source"]): PaymentOrderSource {
  if (source === "QR_ORDER") return "qr_orders";
  if (source === "IN_APP") return "in_app";
  if (source === "WALK_IN") return "walk_ins";
  if (source === "STAFF_CREATED") return "staff_created";
  if (source === "DELIVERY") return "delivery";
  if (source === "CATERING") return "catering";
  if (source === "B2B") return "b2b";
  return source;
}

/**
 * Single backend authority for checkout eligibility.
 * Frontends must render this list — never invent payable methods client-side.
 */
export function resolveEligiblePaymentMethods(
  settings: VenuePaymentSettings,
  envReady: PaymentProviderEnvReady,
  input: ResolveEligiblePaymentMethodsInput
): PaymentMethodEligibility[] {
  const orderSource = asOrderSource(input.source);
  const preferenceContext =
    typeof input.source === "string" && /^[A-Z0-9_]+$/.test(input.source)
      ? (input.source as PaymentPreferenceContext)
      : mapOrderSourceToPreferenceContext(orderSource);
  const prefs = resolvePaymentPreferencePolicy(settings, preferenceContext);
  const currency = (input.currency || "SEK").toUpperCase();
  const results: PaymentMethodEligibility[] = [];

  const catalogKeys = [...CATALOG_METHOD_KEYS];
  for (const methodId of catalogKeys) {
    const entry = getCatalogEntry(methodId);
    const config = settings.methodConfig?.[methodId as keyof typeof settings.methodConfig];
    const readiness = evaluatePaymentMethodReadiness(settings, envReady, methodId);
    const enabled = Boolean(config?.enabled ?? settings.methods[methodId as keyof typeof settings.methods]);
    const adapter = entry ? resolveAdapterConnection(settings, envReady, entry.requiredAdapter) : null;

    let eligible = true;
    let reasonCode: PaymentEligibilityReasonCode = "OK";
    let reasonMessage = "Eligible for this order context.";

    if (!entry) {
      eligible = false;
      reasonCode = "NOT_IN_CATALOG";
      reasonMessage = "Method is not in the ServeOS catalog.";
    } else if (!entry.supportedByServeOS) {
      eligible = false;
      reasonCode = "NOT_SUPPORTED";
      reasonMessage = "ServeOS does not support this method.";
    } else if (!enabled) {
      eligible = false;
      reasonCode = "NOT_ENABLED";
      reasonMessage = "Method is not enabled for this venue.";
    } else if (readiness.status === "DISABLED") {
      eligible = false;
      reasonCode = "METHOD_DISABLED_FOR_NEW";
      reasonMessage = "Method is disabled for new payment attempts.";
    } else if (
      readiness.status === "FAILED" ||
      readiness.status === "ERROR" ||
      readiness.status === "REVOKED"
    ) {
      eligible = false;
      reasonCode = "PROVIDER_UNHEALTHY";
      reasonMessage = readiness.reason;
    } else if (
      readiness.status !== "ENABLED" &&
      readiness.status !== "DEGRADED" &&
      readiness.status !== "PENDING_VERIFICATION"
    ) {
      eligible = false;
      reasonCode = "NOT_READY";
      reasonMessage = readiness.reason;
    } else if (adapter && entry.requiredAdapter !== "native" && adapter.connected === false) {
      eligible = false;
      reasonCode = "PROVIDER_UNHEALTHY";
      reasonMessage = "Required adapter is not connected.";
    } else if (adapter && (adapter.health === "unavailable" || adapter.verificationStatus === "revoked")) {
      eligible = false;
      reasonCode = "PROVIDER_UNHEALTHY";
      reasonMessage = "Provider is unavailable for new payment attempts.";
    } else if (config?.supportedOrderSources?.length && !config.supportedOrderSources.includes(orderSource)) {
      eligible = false;
      reasonCode = "SOURCE_NOT_ALLOWED";
      reasonMessage = `Not allowed for ${orderSource.replace(/_/g, " ")}.`;
    } else if (config?.currencies?.length && !config.currencies.map((c) => c.toUpperCase()).includes(currency)) {
      eligible = false;
      reasonCode = "CURRENCY_MISMATCH";
      reasonMessage = `Currency ${currency} is not supported for this method.`;
    } else if (config?.minCents != null && input.amountCents < config.minCents) {
      eligible = false;
      reasonCode = "AMOUNT_TOO_LOW";
      reasonMessage = `Amount below minimum (${config.minCents} cents).`;
    } else if (config?.maxCents != null && input.amountCents > config.maxCents) {
      eligible = false;
      reasonCode = "AMOUNT_TOO_HIGH";
      reasonMessage = `Amount above maximum (${config.maxCents} cents).`;
    } else if (readiness.status === "DEGRADED" || adapter?.health === "degraded") {
      reasonMessage = "Method is degraded — prefer a healthy fallback when possible.";
    }

    if (input.paymentContext?.allowPayAtVenue === false && entry?.group === "venue") {
      eligible = false;
      reasonCode = "SOURCE_NOT_ALLOWED";
      reasonMessage = "Pay-at-venue methods are not allowed for this payment context.";
    }
    if (input.paymentContext?.allowOnline === false && entry?.group === "online") {
      eligible = false;
      reasonCode = "SOURCE_NOT_ALLOWED";
      reasonMessage = "Online methods are not allowed for this payment context.";
    }

    const priority = config?.priority ?? 100;
    const recommended =
      eligible &&
      (methodId === prefs.preferredMethodKey || prefs.fallbackMethodKeys[0] === methodId);

    results.push({
      methodId,
      eligible,
      reasonCode,
      reasonMessage,
      priority,
      recommended: recommended && eligible,
      readinessStatus: readiness.status
    });
  }

  for (const claimed of input.requestedMethodIds ?? []) {
    if (!catalogKeys.includes(claimed as (typeof catalogKeys)[number]) && !getCatalogEntry(claimed)) {
      results.push({
        methodId: claimed,
        eligible: false,
        reasonCode: "FORGED_METHOD",
        reasonMessage: "Payment method is not recognized by ServeOS.",
        priority: 9999,
        recommended: false,
        readinessStatus: "ERROR"
      });
    }
  }

  results.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
    return a.priority - b.priority || a.methodId.localeCompare(b.methodId);
  });

  return results;
}

export function assertMethodEligibleForCharge(
  settings: VenuePaymentSettings,
  envReady: PaymentProviderEnvReady,
  input: ResolveEligiblePaymentMethodsInput & { methodId: string }
): { ok: true; eligibility: PaymentMethodEligibility } | { ok: false; eligibility: PaymentMethodEligibility } {
  const list = resolveEligiblePaymentMethods(settings, envReady, {
    ...input,
    requestedMethodIds: [input.methodId]
  });
  const row = list.find((r) => r.methodId === input.methodId) ?? {
    methodId: input.methodId,
    eligible: false,
    reasonCode: "FORGED_METHOD" as const,
    reasonMessage: "Unknown payment method.",
    priority: 9999,
    recommended: false,
    readinessStatus: "ERROR"
  };
  return row.eligible ? { ok: true, eligibility: row } : { ok: false, eligibility: row };
}
