import type { PaymentAdapterId } from "../catalog/paymentMethodCatalog.js";
import type { PaymentMethodKey } from "../venue/venuePaymentSettingsService.js";

export type DirectAdapterId = PaymentAdapterId;

export type DirectAdapterDefinition = {
  id: DirectAdapterId;
  label: string;
  /** Compatibility key used in VenuePaymentSettings.providers / UI. */
  connectionSurface: "stripe" | "swish" | "terminals" | "native";
  description: string;
  unlocksMethods: PaymentMethodKey[];
  requiresEnv: Array<"stripe" | "swish" | "webhook">;
};

export const DIRECT_ADAPTER_REGISTRY: DirectAdapterDefinition[] = [
  {
    id: "card",
    label: "Card rails (ServeOS direct)",
    connectionSurface: "stripe",
    description: "Direct card acquiring path for Visa, Mastercard, Amex, wallets, and generic card.",
    unlocksMethods: [
      "card",
      "visa",
      "mastercard",
      "amex",
      "applePay",
      "googlePay",
      "samsungPay"
    ],
    requiresEnv: ["stripe", "webhook"]
  },
  {
    id: "swish",
    label: "Swish (ServeOS direct)",
    connectionSurface: "swish",
    description: "Direct Swish integration for online and pay-at-venue settlement.",
    unlocksMethods: ["swish", "swishAtVenue"],
    requiresEnv: ["swish", "webhook"]
  },
  {
    id: "klarna",
    label: "Klarna (ServeOS direct)",
    connectionSurface: "stripe",
    description: "Direct Klarna BNPL path (pay now / later / installments).",
    unlocksMethods: ["klarnaPayNow", "klarnaPayLater", "klarnaInstallments"],
    requiresEnv: ["stripe", "webhook"]
  },
  {
    id: "terminal",
    label: "Card terminals (ServeOS direct)",
    connectionSurface: "terminals",
    description: "In-person terminal and wallet-at-terminal settlement.",
    unlocksMethods: [
      "cardTerminal",
      "applePayTerminal",
      "googlePayTerminal",
      "samsungPayTerminal"
    ],
    requiresEnv: ["stripe"]
  },
  {
    id: "native",
    label: "Native / manual",
    connectionSurface: "native",
    description: "Cash, gift, invoice, and bank methods with no external adapter.",
    unlocksMethods: [
      "cash",
      "giftCards",
      "invoice",
      "eInvoice",
      "bankTransfer",
      "bankgiro",
      "plusgiro",
      "restaurantCredit",
      "loyaltyBalance"
    ],
    requiresEnv: []
  }
];

export function getAdapterDefinition(id: DirectAdapterId): DirectAdapterDefinition | undefined {
  return DIRECT_ADAPTER_REGISTRY.find((a) => a.id === id);
}

export function getAdapterForConnectionSurface(
  surface: "stripe" | "swish" | "terminals" | "native"
): DirectAdapterDefinition[] {
  return DIRECT_ADAPTER_REGISTRY.filter((a) => a.connectionSurface === surface);
}
