/** Currencies allowed for ServeOS venue guest payments. */
export type ServeosCurrencyOption = {
  code: string;
  label: string;
  hint: string;
  isDefault?: boolean;
};

/** SEK default, major globals, and Nordic currencies only. */
export const SERVEOS_CURRENCY_OPTIONS: ServeosCurrencyOption[] = [
  { code: "SEK", label: "SEK (kr)", hint: "Swedish krona — ServeOS default", isDefault: true },
  { code: "EUR", label: "EUR (€)", hint: "Euro" },
  { code: "USD", label: "USD ($)", hint: "US dollar" },
  { code: "GBP", label: "GBP (£)", hint: "Pound sterling" },
  { code: "NOK", label: "NOK (kr)", hint: "Norwegian krone" },
  { code: "DKK", label: "DKK (kr)", hint: "Danish krone" },
  { code: "ISK", label: "ISK (kr)", hint: "Icelandic króna" }
];

export const SERVEOS_CURRENCY_CODES = new Set(SERVEOS_CURRENCY_OPTIONS.map((c) => c.code));

export function sanitizeServeosCurrencies(codes: string[] | null | undefined): string[] {
  const cleaned = (codes ?? [])
    .map((c) => c.trim().toUpperCase())
    .filter((c) => SERVEOS_CURRENCY_CODES.has(c));
  return cleaned.length ? Array.from(new Set(cleaned)) : ["SEK"];
}

export function serveosCurrencyLabel(code: string) {
  return SERVEOS_CURRENCY_OPTIONS.find((c) => c.code === code)?.label ?? code;
}
