/** Public assets under `/icons/paymentMethodIcons/`. Similar methods share one icon. */
const ICON_BASE = "/icons/paymentMethodIcons";

const FILES = {
  swish: "Swish Logo Primary PNG.png",
  visa: "visa-svgrepo-com.svg",
  mastercard: "mastercard-full-svgrepo-com.svg",
  amex: "amex-3-svgrepo-com.svg",
  applePay: "apple-pay-svgrepo-com.svg",
  googlePay: "google-pay-svgrepo-com.svg",
  samsungPay: "samsung-pay-svgrepo-com.svg",
  klarna: "klarna-svgrepo-com.svg",
  stripe: "stripe-svgrepo-com.svg",
  card: "credit-card-pay-money-svgrepo-com.svg",
  cash: "cash-svgrepo-com.svg",
  gift: "gift-card-svgrepo-com.svg",
  invoice: "invoice-yikai-line-svgrepo-com.svg",
  bank: "bank-svgrepo-com.svg",
  bankgiro: "Bg.jpg",
  plusgiro: "plusgiroIcon.jpeg"
} as const;

const METHOD_ICON_FILE: Record<string, string> = {
  swish: FILES.swish,
  swishAtVenue: FILES.swish,
  visa: FILES.visa,
  mastercard: FILES.mastercard,
  amex: FILES.amex,
  applePay: FILES.applePay,
  applePayTerminal: FILES.applePay,
  googlePay: FILES.googlePay,
  googlePayTerminal: FILES.googlePay,
  samsungPay: FILES.samsungPay,
  samsungPayTerminal: FILES.samsungPay,
  klarnaPayNow: FILES.klarna,
  klarnaPayLater: FILES.klarna,
  klarnaInstallments: FILES.klarna,
  card: FILES.stripe,
  cardTerminal: FILES.card,
  cash: FILES.cash,
  giftCards: FILES.gift,
  invoice: FILES.invoice,
  eInvoice: FILES.invoice,
  bankTransfer: FILES.bank,
  bankgiro: FILES.bankgiro,
  plusgiro: FILES.plusgiro,
  payAtVenue: FILES.cash
};

export function paymentMethodIconSrc(methodKey: string): string | null {
  const file = METHOD_ICON_FILE[methodKey];
  if (!file) return null;
  return `${ICON_BASE}/${encodeURIComponent(file).replace(/%2F/gi, "/")}`;
}
