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
    label: "Configure channels",
    description: "Choose which order sources can use this method.",
    required: true
  },
  {
    id: "CONFIGURE_PAYMENT_RULES",
    label: "Confirm payment rules",
    description: "Ensure venue payment rules allow this method where needed.",
    required: false
  },
  {
    id: "ACTIVATE",
    label: "Activate",
    description: "Enable this method for guests and staff.",
    required: true
  }
];

const DIRECT_ADAPTER_STEPS: PaymentSetupStep[] = [
  {
    id: "CONNECT_ADAPTER",
    label: "Connect ServeOS adapter",
    description: "Connect the ServeOS direct integration for this payment rail.",
    required: true
  },
  {
    id: "PROVIDE_CREDENTIALS",
    label: "Provide merchant credentials",
    description: "Store merchant identifiers required by the direct integration.",
    required: true
  },
  {
    id: "VERIFY_CONNECTION",
    label: "Verify connection",
    description: "ServeOS verifies the adapter can reach the payment network.",
    required: true
  },
  {
    id: "CONFIGURE_CHANNELS",
    label: "Configure channels",
    description: "Choose online, pay-at-venue, or business sources for this method.",
    required: true
  },
  {
    id: "CONFIGURE_PAYMENT_RULES",
    label: "Confirm payment rules",
    description: "Align QR and ordering rules with this method.",
    required: false
  },
  {
    id: "TEST_PAYMENT",
    label: "Test payment",
    description: "Run a sandbox or verification payment when available.",
    required: false
  },
  {
    id: "ACTIVATE",
    label: "Activate",
    description: "Enable this method once readiness is READY.",
    required: true
  }
];

export function getSetupStepsForMethod(key: PaymentMethodKey | string): PaymentSetupStep[] {
  const entry = getCatalogEntry(key);
  if (!entry || entry.requiredAdapter === "native") return NATIVE_STEPS;
  return DIRECT_ADAPTER_STEPS;
}

export function getSetupStepsForAdapter(adapter: PaymentAdapterId): PaymentSetupStep[] {
  if (adapter === "native") return NATIVE_STEPS;
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
    ADAPTER_CONNECTION: "Connect the ServeOS payment adapter",
    ADAPTER_CREDENTIALS: "Provide merchant credentials",
    ADAPTER_VERIFICATION: "Verify the adapter connection",
    WEBHOOK_CONFIGURATION: "Configure payment webhooks",
    ORDER_SOURCES: "Select at least one order source",
    CURRENCY_SEK: "Enable SEK (or a supported currency)",
    PAYMENT_RULES: "Align payment rules with this method"
  };
}
