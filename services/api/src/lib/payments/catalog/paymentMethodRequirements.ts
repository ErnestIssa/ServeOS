import type { PaymentMethodKey } from "../venue/venuePaymentSettingsService.js";
import { getCatalogEntry, type PaymentAdapterId } from "./paymentMethodCatalog.js";

export type PaymentSetupStepId =
  | "CONNECT_ADAPTER"
  | "PROVIDE_CREDENTIALS"
  | "VERIFY_CONNECTION"
  | "CONFIGURE_CHANNELS"
  | "CONFIGURE_PAYMENT_RULES"
  | "TEST_PAYMENT"
  | "ACTIVATE";

export type PaymentSetupStep = {
  id: PaymentSetupStepId;
  label: string;
  description: string;
  required: boolean;
};

const NATIVE_STEPS: PaymentSetupStep[] = [
  {
    id: "CONFIGURE_CHANNELS",
    label: "Choose where it appears",
    description: "Select the order sources that can offer this method.",
    required: true
  },
  {
    id: "ACTIVATE",
    label: "Enable",
    description: "Turn this method on for guests and staff.",
    required: true
  }
];

/** ServeOS-managed (Connect): account already verified — only business choices remain. */
const MANAGED_ADAPTER_STEPS: PaymentSetupStep[] = [
  {
    id: "CONFIGURE_CHANNELS",
    label: "Choose where it appears",
    description: "Select the order sources that can offer this method.",
    required: true
  },
  {
    id: "ACTIVATE",
    label: "Enable",
    description: "Turn this method on once channels are set.",
    required: true
  }
];

const DIRECT_ADAPTER_STEPS: PaymentSetupStep[] = [
  {
    id: "CONNECT_ADAPTER",
    label: "Connect provider",
    description: "Link your own provider account for this payment method.",
    required: true
  },
  {
    id: "PROVIDE_CREDENTIALS",
    label: "Enter credentials",
    description: "Add the merchant ID and secrets required by your provider.",
    required: true
  },
  {
    id: "VERIFY_CONNECTION",
    label: "Verify connection",
    description: "Confirm ServeOS can reach the provider with these credentials.",
    required: true
  },
  {
    id: "CONFIGURE_CHANNELS",
    label: "Choose where it appears",
    description: "Select the order sources that can offer this method.",
    required: true
  },
  {
    id: "ACTIVATE",
    label: "Enable",
    description: "Turn this method on once verification succeeds.",
    required: true
  }
];

export type PaymentSetupConnectionSurface = "managed" | "direct" | "native";

export function getSetupStepsForMethod(
  key: PaymentMethodKey | string,
  surface: PaymentSetupConnectionSurface = "direct"
): PaymentSetupStep[] {
  const entry = getCatalogEntry(key);
  if (!entry || entry.requiredAdapter === "native" || surface === "native") return NATIVE_STEPS;
  if (surface === "managed") return MANAGED_ADAPTER_STEPS;
  return DIRECT_ADAPTER_STEPS;
}

export function getSetupStepsForAdapter(
  adapter: PaymentAdapterId,
  surface: PaymentSetupConnectionSurface = "direct"
): PaymentSetupStep[] {
  if (adapter === "native" || surface === "native") return NATIVE_STEPS;
  if (surface === "managed") return MANAGED_ADAPTER_STEPS;
  return DIRECT_ADAPTER_STEPS;
}

export type PaymentRequirementId =
  | "ADAPTER_CONNECTION"
  | "ADAPTER_CREDENTIALS"
  | "ADAPTER_VERIFICATION"
  | "WEBHOOK_CONFIGURATION"
  | "ORDER_SOURCES"
  | "CURRENCY_SEK"
  | "PAYMENT_RULES";

export function getRequirementLabels(): Record<PaymentRequirementId, string> {
  return {
    ADAPTER_CONNECTION: "Connect payments for this venue",
    ADAPTER_CREDENTIALS: "Enter provider credentials",
    ADAPTER_VERIFICATION: "Finish provider verification",
    WEBHOOK_CONFIGURATION: "Payment webhooks not ready on the platform",
    ORDER_SOURCES: "Choose at least one place this method can be used",
    CURRENCY_SEK: "Enable SEK (or a supported currency)",
    PAYMENT_RULES: "Align payment rules with this method"
  };
}
