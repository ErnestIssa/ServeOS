export type PaymentMethodGroup = "online" | "venue" | "business";

export type PaymentMethodCatalogEntry = {
  key: string;
  label: string;
  group: PaymentMethodGroup;
  family: string;
  hint: string;
  /** Maps to ServeOS acquiring family (wallet rides on card rails, etc.). */
  rails: "card" | "swish" | "klarna" | "cash" | "invoice" | "bank" | "gift" | "external" | "terminal";
};

/** Full Swedish venue catalog — enable only what each restaurant supports. */
export const PAYMENT_METHOD_CATALOG: PaymentMethodCatalogEntry[] = [
  // Online / in-app
  { key: "swish", label: "Swish", group: "online", family: "Swish", hint: "Mobile number payment", rails: "swish" },
  { key: "visa", label: "Visa", group: "online", family: "Card", hint: "Card network", rails: "card" },
  { key: "mastercard", label: "Mastercard", group: "online", family: "Card", hint: "Card network", rails: "card" },
  { key: "amex", label: "American Express", group: "online", family: "Card", hint: "Card network", rails: "card" },
  { key: "applePay", label: "Apple Pay", group: "online", family: "Wallet", hint: "Rides on card rails", rails: "card" },
  { key: "googlePay", label: "Google Pay", group: "online", family: "Wallet", hint: "Rides on card rails", rails: "card" },
  { key: "samsungPay", label: "Samsung Pay", group: "online", family: "Wallet", hint: "Rides on card rails", rails: "card" },
  { key: "klarnaPayNow", label: "Klarna — Pay now", group: "online", family: "Klarna", hint: "BNPL pay now", rails: "klarna" },
  { key: "klarnaPayLater", label: "Klarna — Pay later", group: "online", family: "Klarna", hint: "BNPL pay later", rails: "klarna" },
  {
    key: "klarnaInstallments",
    label: "Klarna — Installments",
    group: "online",
    family: "Klarna",
    hint: "BNPL installments",
    rails: "klarna"
  },
  {
    key: "card",
    label: "Card via payment provider",
    group: "online",
    family: "Card",
    hint: "Generic card checkout",
    rails: "card"
  },

  // Pay at venue
  { key: "cardTerminal", label: "Card terminal", group: "venue", family: "Terminal", hint: "In-person card", rails: "terminal" },
  { key: "cash", label: "Cash", group: "venue", family: "Cash", hint: "Manual settlement", rails: "cash" },
  { key: "swishAtVenue", label: "Swish", group: "venue", family: "Swish", hint: "Pay at counter / table", rails: "swish" },
  {
    key: "applePayTerminal",
    label: "Apple Pay at terminal",
    group: "venue",
    family: "Wallet",
    hint: "Wallet on terminal rails",
    rails: "terminal"
  },
  {
    key: "googlePayTerminal",
    label: "Google Pay at terminal",
    group: "venue",
    family: "Wallet",
    hint: "Wallet on terminal rails",
    rails: "terminal"
  },
  {
    key: "samsungPayTerminal",
    label: "Samsung Pay at terminal",
    group: "venue",
    family: "Wallet",
    hint: "Wallet on terminal rails",
    rails: "terminal"
  },
  { key: "giftCards", label: "Gift card", group: "venue", family: "Store credit", hint: "Redeem gift balance", rails: "gift" },

  // Business / special
  { key: "invoice", label: "Invoice", group: "business", family: "Invoice", hint: "B2B / catering", rails: "invoice" },
  { key: "eInvoice", label: "E-invoice", group: "business", family: "Invoice", hint: "Electronic invoice", rails: "invoice" },
  {
    key: "bankTransfer",
    label: "Bank transfer",
    group: "business",
    family: "Bank",
    hint: "Credit transfer",
    rails: "bank"
  },
  { key: "bankgiro", label: "Bankgiro", group: "business", family: "Bank", hint: "Swedish Bankgiro", rails: "bank" },
  { key: "plusgiro", label: "PlusGiro", group: "business", family: "Bank", hint: "Swedish PlusGiro", rails: "bank" }
];

export const ONLINE_PAYMENT_METHODS = PAYMENT_METHOD_CATALOG.filter((m) => m.group === "online");
export const VENUE_PAYMENT_METHODS = PAYMENT_METHOD_CATALOG.filter((m) => m.group === "venue");
export const BUSINESS_PAYMENT_METHODS = PAYMENT_METHOD_CATALOG.filter((m) => m.group === "business");

/** Stable family order as defined in the catalog (first appearance). */
export const PAYMENT_METHOD_FAMILY_ORDER = Array.from(
  new Set(PAYMENT_METHOD_CATALOG.map((m) => m.family))
);

/** Button labels for family chips in the Methods list toolbar. */
export const PAYMENT_METHOD_FAMILY_LABELS: Record<string, string> = {
  Card: "Cards",
  Wallet: "Digital wallets",
  Swish: "Swish",
  Klarna: "Klarna",
  Terminal: "Terminal",
  Cash: "Cash",
  "Store credit": "Store credit",
  Invoice: "Invoice",
  Bank: "Bank"
};

export type PaymentMethodFamilyFilter = "all" | string;

export function paymentMethodFamilyLabel(family: string) {
  return PAYMENT_METHOD_FAMILY_LABELS[family] ?? family;
}

export function catalogMethodLabel(key: string) {
  return PAYMENT_METHOD_CATALOG.find((m) => m.key === key)?.label ?? null;
}
