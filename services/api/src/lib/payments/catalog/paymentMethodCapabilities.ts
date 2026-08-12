import type { PaymentMethodKey } from "../venue/venuePaymentSettingsService.js";
import { getCatalogEntry, type PaymentAdapterId } from "./paymentMethodCatalog.js";

export type PaymentMethodCapabilityFlags = {
  refunds: boolean;
  reconciliation: boolean;
  payouts: boolean;
  providerLogs: boolean;
  automatedCapture: boolean;
  requiresWebhook: boolean;
  requiresStaffConfirmationDefault: boolean;
};

const BY_ADAPTER: Record<PaymentAdapterId, PaymentMethodCapabilityFlags> = {
  native: {
    refunds: true,
    reconciliation: false,
    payouts: false,
    providerLogs: false,
    automatedCapture: false,
    requiresWebhook: false,
    requiresStaffConfirmationDefault: true
  },
  swish: {
    refunds: true,
    reconciliation: true,
    payouts: true,
    providerLogs: true,
    automatedCapture: true,
    requiresWebhook: true,
    requiresStaffConfirmationDefault: false
  },
  card: {
    refunds: true,
    reconciliation: true,
    payouts: true,
    providerLogs: true,
    automatedCapture: true,
    requiresWebhook: true,
    requiresStaffConfirmationDefault: false
  },
  klarna: {
    refunds: true,
    reconciliation: true,
    payouts: true,
    providerLogs: true,
    automatedCapture: true,
    requiresWebhook: true,
    requiresStaffConfirmationDefault: false
  },
  terminal: {
    refunds: true,
    reconciliation: true,
    payouts: true,
    providerLogs: true,
    automatedCapture: true,
    requiresWebhook: false,
    requiresStaffConfirmationDefault: false
  }
};

export function getMethodCapabilities(key: PaymentMethodKey | string): PaymentMethodCapabilityFlags {
  const entry = getCatalogEntry(key);
  if (!entry) {
    return BY_ADAPTER.native;
  }
  if (key === "cash") {
    return { ...BY_ADAPTER.native, refunds: false };
  }
  return BY_ADAPTER[entry.requiredAdapter];
}
