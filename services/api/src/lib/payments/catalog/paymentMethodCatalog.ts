import type { PaymentMethodKey } from "../venue/venuePaymentSettingsService.js";

export type PaymentMethodGroup = "online" | "venue" | "business";
export type PaymentInstrument =
  | "CARD"
  | "MOBILE_WALLET"
  | "SWISH"
  | "KLARNA"
  | "CASH"
  | "TERMINAL"
  | "GIFT"
  | "INVOICE"
  | "BANK"
  | "ACCOUNT"
  | "EXTERNAL";

export type PaymentAdapterId = "card" | "swish" | "klarna" | "terminal" | "native";
export type PaymentCatalogChannel = "ONLINE" | "PAY_AT_VENUE" | "BUSINESS";

export type ServeOSPaymentCatalogEntry = {
  key: PaymentMethodKey;
  label: string;
  group: PaymentMethodGroup;
  family: string;
  hint: string;
  instrument: PaymentInstrument;
  channels: PaymentCatalogChannel[];
  rails: "card" | "swish" | "klarna" | "cash" | "invoice" | "bank" | "gift" | "external" | "terminal";
  supportedByServeOS: true;
  integrationMode: "direct";
  requiredAdapter: PaymentAdapterId;
  lifecycleVersion: number;
};

/** ServeOS product catalog — venues select from this list only. */
export const SERVEOS_PAYMENT_CATALOG_VERSION = 2;

export const SERVEOS_PAYMENT_CATALOG: ServeOSPaymentCatalogEntry[] = [
  {
    key: "swish",
    label: "Swish",
    group: "online",
    family: "Swish",
    hint: "Mobile number payment",
    instrument: "SWISH",
    channels: ["ONLINE"],
    rails: "swish",
    supportedByServeOS: true,
    integrationMode: "direct",
    requiredAdapter: "swish",
    lifecycleVersion: 2
  },
  {
    key: "visa",
    label: "Visa",
    group: "online",
    family: "Card",
    hint: "Card network",
    instrument: "CARD",
    channels: ["ONLINE"],
    rails: "card",
    supportedByServeOS: true,
    integrationMode: "direct",
    requiredAdapter: "card",
    lifecycleVersion: 2
  },
  {
    key: "mastercard",
    label: "Mastercard",
    group: "online",
    family: "Card",
    hint: "Card network",
    instrument: "CARD",
    channels: ["ONLINE"],
    rails: "card",
    supportedByServeOS: true,
    integrationMode: "direct",
    requiredAdapter: "card",
    lifecycleVersion: 2
  },
  {
    key: "amex",
    label: "American Express",
    group: "online",
    family: "Card",
    hint: "Card network",
    instrument: "CARD",
    channels: ["ONLINE"],
    rails: "card",
    supportedByServeOS: true,
    integrationMode: "direct",
    requiredAdapter: "card",
    lifecycleVersion: 2
  },
  {
    key: "applePay",
    label: "Apple Pay",
    group: "online",
    family: "Wallet",
    hint: "Rides on card rails",
    instrument: "MOBILE_WALLET",
    channels: ["ONLINE"],
    rails: "card",
    supportedByServeOS: true,
    integrationMode: "direct",
    requiredAdapter: "card",
    lifecycleVersion: 2
  },
  {
    key: "googlePay",
    label: "Google Pay",
    group: "online",
    family: "Wallet",
    hint: "Rides on card rails",
    instrument: "MOBILE_WALLET",
    channels: ["ONLINE"],
    rails: "card",
    supportedByServeOS: true,
    integrationMode: "direct",
    requiredAdapter: "card",
    lifecycleVersion: 2
  },
  {
    key: "samsungPay",
    label: "Samsung Pay",
    group: "online",
    family: "Wallet",
    hint: "Rides on card rails",
    instrument: "MOBILE_WALLET",
    channels: ["ONLINE"],
    rails: "card",
    supportedByServeOS: true,
    integrationMode: "direct",
    requiredAdapter: "card",
    lifecycleVersion: 2
  },
  {
    key: "klarnaPayNow",
    label: "Klarna — Pay now",
    group: "online",
    family: "Klarna",
    hint: "BNPL pay now",
    instrument: "KLARNA",
    channels: ["ONLINE"],
    rails: "klarna",
    supportedByServeOS: true,
    integrationMode: "direct",
    requiredAdapter: "klarna",
    lifecycleVersion: 2
  },
  {
    key: "klarnaPayLater",
    label: "Klarna — Pay later",
    group: "online",
    family: "Klarna",
    hint: "BNPL pay later",
    instrument: "KLARNA",
    channels: ["ONLINE"],
    rails: "klarna",
    supportedByServeOS: true,
    integrationMode: "direct",
    requiredAdapter: "klarna",
    lifecycleVersion: 2
  },
  {
    key: "klarnaInstallments",
    label: "Klarna — Installments",
    group: "online",
    family: "Klarna",
    hint: "BNPL installments",
    instrument: "KLARNA",
    channels: ["ONLINE"],
    rails: "klarna",
    supportedByServeOS: true,
    integrationMode: "direct",
    requiredAdapter: "klarna",
    lifecycleVersion: 2
  },
  {
    key: "card",
    label: "Card via payment provider",
    group: "online",
    family: "Card",
    hint: "Generic card checkout",
    instrument: "CARD",
    channels: ["ONLINE"],
    rails: "card",
    supportedByServeOS: true,
    integrationMode: "direct",
    requiredAdapter: "card",
    lifecycleVersion: 2
  },
  {
    key: "cardTerminal",
    label: "Card terminal",
    group: "venue",
    family: "Terminal",
    hint: "In-person card",
    instrument: "TERMINAL",
    channels: ["PAY_AT_VENUE"],
    rails: "terminal",
    supportedByServeOS: true,
    integrationMode: "direct",
    requiredAdapter: "terminal",
    lifecycleVersion: 2
  },
  {
    key: "cash",
    label: "Cash",
    group: "venue",
    family: "Cash",
    hint: "Manual settlement",
    instrument: "CASH",
    channels: ["PAY_AT_VENUE"],
    rails: "cash",
    supportedByServeOS: true,
    integrationMode: "direct",
    requiredAdapter: "native",
    lifecycleVersion: 2
  },
  {
    key: "swishAtVenue",
    label: "Swish",
    group: "venue",
    family: "Swish",
    hint: "Pay at counter / table",
    instrument: "SWISH",
    channels: ["PAY_AT_VENUE"],
    rails: "swish",
    supportedByServeOS: true,
    integrationMode: "direct",
    requiredAdapter: "swish",
    lifecycleVersion: 2
  },
  {
    key: "applePayTerminal",
    label: "Apple Pay at terminal",
    group: "venue",
    family: "Wallet",
    hint: "Wallet on terminal rails",
    instrument: "MOBILE_WALLET",
    channels: ["PAY_AT_VENUE"],
    rails: "terminal",
    supportedByServeOS: true,
    integrationMode: "direct",
    requiredAdapter: "terminal",
    lifecycleVersion: 2
  },
  {
    key: "googlePayTerminal",
    label: "Google Pay at terminal",
    group: "venue",
    family: "Wallet",
    hint: "Wallet on terminal rails",
    instrument: "MOBILE_WALLET",
    channels: ["PAY_AT_VENUE"],
    rails: "terminal",
    supportedByServeOS: true,
    integrationMode: "direct",
    requiredAdapter: "terminal",
    lifecycleVersion: 2
  },
  {
    key: "samsungPayTerminal",
    label: "Samsung Pay at terminal",
    group: "venue",
    family: "Wallet",
    hint: "Wallet on terminal rails",
    instrument: "MOBILE_WALLET",
    channels: ["PAY_AT_VENUE"],
    rails: "terminal",
    supportedByServeOS: true,
    integrationMode: "direct",
    requiredAdapter: "terminal",
    lifecycleVersion: 2
  },
  {
    key: "giftCards",
    label: "Gift card",
    group: "venue",
    family: "Store credit",
    hint: "Redeem gift balance",
    instrument: "GIFT",
    channels: ["PAY_AT_VENUE"],
    rails: "gift",
    supportedByServeOS: true,
    integrationMode: "direct",
    requiredAdapter: "native",
    lifecycleVersion: 2
  },
  {
    key: "invoice",
    label: "Invoice",
    group: "business",
    family: "Invoice",
    hint: "B2B / catering",
    instrument: "INVOICE",
    channels: ["BUSINESS"],
    rails: "invoice",
    supportedByServeOS: true,
    integrationMode: "direct",
    requiredAdapter: "native",
    lifecycleVersion: 2
  },
  {
    key: "eInvoice",
    label: "E-invoice",
    group: "business",
    family: "Invoice",
    hint: "Electronic invoice",
    instrument: "INVOICE",
    channels: ["BUSINESS"],
    rails: "invoice",
    supportedByServeOS: true,
    integrationMode: "direct",
    requiredAdapter: "native",
    lifecycleVersion: 2
  },
  {
    key: "bankTransfer",
    label: "Bank transfer",
    group: "business",
    family: "Bank",
    hint: "Credit transfer",
    instrument: "BANK",
    channels: ["BUSINESS"],
    rails: "bank",
    supportedByServeOS: true,
    integrationMode: "direct",
    requiredAdapter: "native",
    lifecycleVersion: 2
  },
  {
    key: "bankgiro",
    label: "Bankgiro",
    group: "business",
    family: "Bank",
    hint: "Swedish Bankgiro",
    instrument: "BANK",
    channels: ["BUSINESS"],
    rails: "bank",
    supportedByServeOS: true,
    integrationMode: "direct",
    requiredAdapter: "native",
    lifecycleVersion: 2
  },
  {
    key: "plusgiro",
    label: "PlusGiro",
    group: "business",
    family: "Bank",
    hint: "Swedish PlusGiro",
    instrument: "BANK",
    channels: ["BUSINESS"],
    rails: "bank",
    supportedByServeOS: true,
    integrationMode: "direct",
    requiredAdapter: "native",
    lifecycleVersion: 2
  }
];

export function getCatalogEntry(key: string): ServeOSPaymentCatalogEntry | undefined {
  return SERVEOS_PAYMENT_CATALOG.find((e) => e.key === key);
}

export function isCatalogMethodKey(key: string): key is PaymentMethodKey {
  return SERVEOS_PAYMENT_CATALOG.some((e) => e.key === key);
}

export const CATALOG_METHOD_KEYS = SERVEOS_PAYMENT_CATALOG.map((e) => e.key);
