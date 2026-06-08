import type { AllowedCountry } from "@serveos/core-shared/signup-wizard";

const COUNTRY_META: Record<AllowedCountry, { flag: string; dial: string }> = {
  Sweden: { flag: "🇸🇪", dial: "+46" },
  Norway: { flag: "🇳🇴", dial: "+47" },
  Denmark: { flag: "🇩🇰", dial: "+45" },
  Finland: { flag: "🇫🇮", dial: "+358" }
};

export function countryPickerLabel(country: AllowedCountry): string {
  const meta = COUNTRY_META[country];
  return `${meta.flag} ${country} · ${meta.dial}`;
}
