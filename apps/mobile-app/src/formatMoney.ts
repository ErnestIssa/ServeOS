import { formatMoneyCents, type SupportedCurrencyCode } from "@serveos/core-shared";

export function formatDisplayMoney(cents: number, currency?: SupportedCurrencyCode | null): string {
  return formatMoneyCents(cents, { currency });
}
