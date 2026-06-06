/** Platform default — Swedish krona unless a user preference overrides display. */
export const DEFAULT_CURRENCY_CODE = "SEK" as const;
export const DEFAULT_LOCALE = "sv-SE" as const;

export type SupportedCurrencyCode = "SEK" | "USD" | "EUR";

const LOCALE_BY_CURRENCY: Record<SupportedCurrencyCode, string> = {
  SEK: "sv-SE",
  USD: "en-US",
  EUR: "de-DE"
};

export function resolveCurrencyCode(input?: string | null): SupportedCurrencyCode {
  const code = (input ?? DEFAULT_CURRENCY_CODE).trim().toUpperCase();
  if (code === "USD" || code === "EUR" || code === "SEK") return code;
  return DEFAULT_CURRENCY_CODE;
}

export function resolveLocaleForCurrency(currency: SupportedCurrencyCode): string {
  return LOCALE_BY_CURRENCY[currency] ?? DEFAULT_LOCALE;
}

/** Format integer cents using platform/user currency (display only — amounts stay in cents in DB). */
export function formatMoneyCents(
  cents: number,
  options?: { currency?: string | null; locale?: string | null }
): string {
  const currency = resolveCurrencyCode(options?.currency);
  const locale = options?.locale?.trim() || resolveLocaleForCurrency(currency);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(cents / 100);
}

/** Compact amount for OCL/system strings (backend SSOT copy). */
export function formatMoneyCentsPlain(
  cents: number,
  options?: { currency?: string | null; locale?: string | null }
): string {
  return formatMoneyCents(cents, options);
}
