import type { PaymentProviderEnvReady, VenuePaymentSettings } from "../venue/venuePaymentSettingsService.js";
import { resolveAdapterConnection } from "../providers/providerCapabilityResolver.js";

export type PaymentFeatureAvailability = "full" | "partial" | "none";

export type PaymentFeatureRequiredAction = {
  type: "OPEN_SETUP" | "CONNECT_ADAPTER" | "VERIFY_CONNECTION" | "OPEN_PAYMENT_METHODS" | "CONFIGURE_WEBHOOKS" | "NONE";
  methodId?: string;
  providerId?: string;
};

export type PaymentFeatureGate = {
  feature: "TRANSACTIONS" | "LOGS" | "REFUNDS" | "RECONCILIATION" | "PAYOUTS" | "METHODS_SETUP";
  available: boolean;
  availability: PaymentFeatureAvailability;
  reasonCode: string;
  reason: string;
  missingRequirements: string[];
  nextAction: string | null;
  requiredAction: PaymentFeatureRequiredAction;
};

export type PaymentFeatureGates = {
  transactions: PaymentFeatureGate;
  logs: PaymentFeatureGate;
  refunds: PaymentFeatureGate;
  reconciliation: PaymentFeatureGate;
  payouts: PaymentFeatureGate;
  methodsSetup: PaymentFeatureGate;
};

function gate(
  feature: PaymentFeatureGate["feature"],
  available: boolean,
  availability: PaymentFeatureAvailability,
  reasonCode: string,
  reason: string,
  missingRequirements: string[] = [],
  requiredAction: PaymentFeatureRequiredAction = { type: "NONE" }
): PaymentFeatureGate {
  return {
    feature,
    available,
    availability,
    reasonCode,
    reason,
    missingRequirements,
    nextAction: requiredAction.type === "NONE" ? null : requiredAction.type,
    requiredAction
  };
}

export function evaluatePaymentFeatureGates(
  settings: VenuePaymentSettings,
  envReady: PaymentProviderEnvReady
): PaymentFeatureGates {
  const card = resolveAdapterConnection(settings, envReady, "card");
  const swish = resolveAdapterConnection(settings, envReady, "swish");
  const anyAdapter = card.connected || swish.connected;
  const anyEnabled = Object.values(settings.methods).some(Boolean);
  const cashOn = Boolean(settings.methods.cash);

  const swishConn = settings.providerConnections?.swish;
  const stripeConn = settings.providerConnections?.stripe;
  const adapterUnhealthy =
    (swishConn?.connected && swishConn.health === "unavailable") ||
    (stripeConn?.connected && stripeConn.health === "unavailable");

  const transactions: PaymentFeatureGate = !anyEnabled
    ? gate(
        "TRANSACTIONS",
        false,
        "none",
        "NO_ENABLED_METHODS",
        "No payment methods are enabled yet. Enable at least one method to view transactions.",
        ["ENABLE_METHOD"],
        { type: "OPEN_PAYMENT_METHODS" }
      )
    : gate(
        "TRANSACTIONS",
        true,
        anyAdapter || cashOn ? "full" : "partial",
        adapterUnhealthy ? "PROVIDER_DEGRADED" : "OK",
        adapterUnhealthy
          ? "Transactions are available, but a connected provider is currently unhealthy."
          : "Transaction timeline is available for enabled methods."
      );

  const logs: PaymentFeatureGate = !anyEnabled
    ? gate(
        "LOGS",
        false,
        "none",
        "NO_ENABLED_METHODS",
        "Payment logs appear after methods are enabled.",
        ["ENABLE_METHOD"],
        { type: "OPEN_PAYMENT_METHODS" }
      )
    : anyAdapter
      ? gate(
          "LOGS",
          true,
          envReady.webhook ? "full" : "partial",
          envReady.webhook ? "OK" : "WEBHOOK_NOT_CONFIGURED",
          envReady.webhook
            ? "Provider and manual payment logs are available."
            : "Manual events are available. Configure webhooks for full provider request logs.",
          envReady.webhook ? [] : ["WEBHOOK_CONFIGURATION"],
          envReady.webhook ? { type: "NONE" } : { type: "CONFIGURE_WEBHOOKS" }
        )
      : gate(
          "LOGS",
          true,
          "partial",
          "PROVIDER_NOT_CONNECTED",
          "Manual cash and staff payment events are available. Connect a ServeOS adapter for provider logs.",
          ["ADAPTER_CONNECTION"],
          { type: "CONNECT_ADAPTER", providerId: "swish" }
        );

  const refunds: PaymentFeatureGate = !anyEnabled
    ? gate(
        "REFUNDS",
        false,
        "none",
        "PROVIDER_NOT_CONNECTED",
        "Connect and verify your payment provider first, then enable a refundable method.",
        ["ENABLE_METHOD"],
        { type: "OPEN_PAYMENT_METHODS" }
      )
    : gate("REFUNDS", true, "full", "OK", "Refund operations are available for eligible payments.");

  const reconciliation: PaymentFeatureGate = !anyAdapter
    ? gate(
        "RECONCILIATION",
        cashOn,
        cashOn ? "partial" : "none",
        "PROVIDER_NOT_CONNECTED",
        cashOn
          ? "Only manual settlement checks are available until a ServeOS adapter is connected."
          : "Reconciliation needs a connected ServeOS payment adapter.",
        ["ADAPTER_CONNECTION"],
        { type: "CONNECT_ADAPTER", providerId: "stripe" }
      )
    : gate("RECONCILIATION", true, "full", "OK", "Provider reconciliation cases are available.");

  const payouts: PaymentFeatureGate = !anyAdapter
    ? gate(
        "PAYOUTS",
        false,
        "none",
        "PROVIDER_NOT_CONNECTED",
        "Payout data is not available until a ServeOS adapter that reports payouts is connected.",
        ["ADAPTER_CONNECTION"],
        { type: "CONNECT_ADAPTER", providerId: "stripe" }
      )
    : !card.envReady && !swish.envReady
      ? gate(
          "PAYOUTS",
          true,
          "partial",
          "VERIFICATION_PENDING",
          "Adapter connected in sandbox. Production payout reporting requires live adapter credentials.",
          ["ADAPTER_VERIFICATION"],
          { type: "VERIFY_CONNECTION", providerId: card.connected ? "stripe" : "swish" }
        )
      : gate("PAYOUTS", true, "full", "OK", "Payout reporting is available for connected adapters.");

  const methodsSetup: PaymentFeatureGate = gate(
    "METHODS_SETUP",
    true,
    "full",
    "OK",
    "Payment method catalog and venue configuration are available."
  );

  return { transactions, logs, refunds, reconciliation, payouts, methodsSetup };
}
