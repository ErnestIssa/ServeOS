/** Integer minor-unit money helpers — never use floats for payment math. */

export type MoneyMinor = {
  amountMinor: number;
  currency: string;
};

export function assertMoneyMinor(value: unknown, currency = "SEK"): MoneyMinor {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw Object.assign(new Error("invalid_money_minor"), {
      statusCode: 400,
      code: "invalid_money_minor"
    });
  }
  const cur = String(currency || "SEK").toUpperCase();
  if (!/^[A-Z]{3}$/.test(cur)) {
    throw Object.assign(new Error("invalid_currency"), { statusCode: 400, code: "invalid_currency" });
  }
  return { amountMinor: value, currency: cur };
}

export function addMoney(a: MoneyMinor, b: MoneyMinor): MoneyMinor {
  if (a.currency !== b.currency) {
    throw Object.assign(new Error("currency_mismatch"), { statusCode: 400, code: "currency_mismatch" });
  }
  return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency };
}

export function subtractMoney(a: MoneyMinor, b: MoneyMinor): MoneyMinor {
  if (a.currency !== b.currency) {
    throw Object.assign(new Error("currency_mismatch"), { statusCode: 400, code: "currency_mismatch" });
  }
  if (b.amountMinor > a.amountMinor) {
    throw Object.assign(new Error("insufficient_money"), { statusCode: 400, code: "insufficient_money" });
  }
  return { amountMinor: a.amountMinor - b.amountMinor, currency: a.currency };
}

/** Refund safety: sum(refunds) must never exceed captured. */
export function assertRefundWithinCaptured(capturedMinor: number, priorRefundsMinor: number, refundMinor: number) {
  assertMoneyMinor(capturedMinor);
  assertMoneyMinor(priorRefundsMinor);
  assertMoneyMinor(refundMinor);
  if (priorRefundsMinor + refundMinor > capturedMinor) {
    throw Object.assign(new Error("refund_exceeds_captured"), {
      statusCode: 409,
      code: "refund_exceeds_captured"
    });
  }
}
