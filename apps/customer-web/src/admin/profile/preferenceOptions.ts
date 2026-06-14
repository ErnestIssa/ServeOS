import type { PickOption } from "./ProfilePickDropdown";

const FALLBACK_TIMEZONES = [
  "Europe/Stockholm",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Helsinki",
  "Europe/Oslo",
  "Europe/Copenhagen",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Toronto",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC"
];

function formatTimezoneLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: tz,
      timeZoneName: "shortOffset"
    }).formatToParts(new Date());
    const offset = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    const region = tz.includes("/") ? tz.split("/").slice(1).join(", ").replace(/_/g, " ") : tz;
    return offset ? `${region} · ${offset}` : region;
  } catch {
    return tz.replace(/_/g, " ");
  }
}

function buildTimezoneOptions(): PickOption[] {
  const zones =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : FALLBACK_TIMEZONES;
  return zones.map((value) => ({ value, label: formatTimezoneLabel(value) }));
}

export const LANGUAGE_OPTIONS: PickOption[] = [
  { value: "en", label: "English" },
  { value: "sv", label: "Svenska" }
];

export const DATE_FORMAT_OPTIONS: PickOption[] = [
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD", hint: "2026-06-10" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY", hint: "10/06/2026" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY", hint: "06/10/2026" }
];

export const TIME_FORMAT_OPTIONS = [
  { value: "12h" as const, label: "12-hour" },
  { value: "24h" as const, label: "24-hour" }
];

export const THEME_OPTIONS = [
  { value: "system" as const, label: "System" },
  { value: "light" as const, label: "Light" },
  { value: "dark" as const, label: "Dark" }
];

export const TIMEZONE_OPTIONS = buildTimezoneOptions();
