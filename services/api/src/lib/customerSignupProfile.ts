import type { Prisma } from "@prisma/client";
import { resolveCurrencyCode, type SupportedCurrencyCode } from "@serveos/core-shared/currency";

export const PREFERRED_RESTAURANT_KEY = "preferredRestaurantId";
export const ACTIVE_EXPERIENCE_MODE_KEY = "activeExperienceMode";
export type ActiveExperienceMode = "CUSTOMER" | "WORKSPACE";
export const CUSTOMER_PREFERENCES_KEY = "customerAppSettings";
export const CUSTOMER_AVATAR_KEY = "avatarUri";
export const CUSTOMER_QUICK_PREFS_KEY = "customerQuickPrefs";

export type CustomerQuickPrefs = {
  push: boolean;
  location: boolean;
};

export type CustomerAppSettings = {
  /** Display currency — amounts in DB remain cents; default Swedish krona. */
  currency: SupportedCurrencyCode;
  privacy: { profileVisibility: "public" | "venues" | "private"; shareAnalytics: boolean };
  accessibility: { reduceMotion: boolean; boldText: boolean };
  nightMode: "system" | "light" | "dark";
  shortcuts: { enabled: boolean };
  communication: { email: boolean; push: boolean; sms: boolean };
  navigation: { preferredMaps: "apple" | "google" | "waze" };
  soundsVoice: { messageSounds: boolean; voiceGuidance: boolean };
  safety: { pinEnabled: boolean; tripCheck: boolean };
};

export const DEFAULT_CUSTOMER_APP_SETTINGS: CustomerAppSettings = {
  currency: "SEK",
  privacy: { profileVisibility: "venues", shareAnalytics: true },
  accessibility: { reduceMotion: false, boldText: false },
  nightMode: "system",
  shortcuts: { enabled: true },
  communication: { email: true, push: true, sms: false },
  navigation: { preferredMaps: "google" },
  soundsVoice: { messageSounds: true, voiceGuidance: false },
  safety: { pinEnabled: false, tripCheck: true }
};

function profileRecord(signupProfile: unknown): Record<string, unknown> {
  if (!signupProfile || typeof signupProfile !== "object" || Array.isArray(signupProfile)) return {};
  return { ...(signupProfile as Record<string, unknown>) };
}

export function readPreferredRestaurantIdFromProfile(signupProfile: unknown): string | null {
  const v = profileRecord(signupProfile)[PREFERRED_RESTAURANT_KEY];
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

export function readActiveExperienceModeFromProfile(signupProfile: unknown): ActiveExperienceMode | null {
  const v = profileRecord(signupProfile)[ACTIVE_EXPERIENCE_MODE_KEY];
  if (v === "CUSTOMER" || v === "WORKSPACE") return v;
  return null;
}

export function mergeActiveExperienceIntoProfile(
  current: unknown,
  input: { mode: ActiveExperienceMode; restaurantId?: string | null }
): Prisma.InputJsonValue {
  const base = profileRecord(current);
  base[ACTIVE_EXPERIENCE_MODE_KEY] = input.mode;
  if (input.mode === "WORKSPACE" && input.restaurantId?.trim()) {
    base[PREFERRED_RESTAURANT_KEY] = input.restaurantId.trim();
  }
  return base as Prisma.InputJsonValue;
}

export function mergePreferredRestaurantIntoProfile(
  current: unknown,
  restaurantId: string
): Prisma.InputJsonValue {
  const base = profileRecord(current);
  base[PREFERRED_RESTAURANT_KEY] = restaurantId.trim();
  return base as Prisma.InputJsonValue;
}

export function readAvatarUriFromProfile(signupProfile: unknown): string | null {
  const v = profileRecord(signupProfile)[CUSTOMER_AVATAR_KEY];
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

export function mergeAvatarIntoProfile(current: unknown, avatarUri: string | null): Prisma.InputJsonValue {
  const base = profileRecord(current);
  const t = (avatarUri ?? "").trim();
  if (t) base[CUSTOMER_AVATAR_KEY] = t;
  else delete base[CUSTOMER_AVATAR_KEY];
  return base as Prisma.InputJsonValue;
}

export function readQuickPrefsFromProfile(signupProfile: unknown): CustomerQuickPrefs {
  const raw = profileRecord(signupProfile)[CUSTOMER_QUICK_PREFS_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { push: true, location: true };
  }
  const o = raw as Record<string, unknown>;
  return {
    push: o.push !== false,
    location: o.location !== false
  };
}

export function mergeQuickPrefsIntoProfile(
  current: unknown,
  prefs: CustomerQuickPrefs
): Prisma.InputJsonValue {
  const base = profileRecord(current);
  base[CUSTOMER_QUICK_PREFS_KEY] = {
    push: !!prefs.push,
    location: !!prefs.location
  };
  return base as Prisma.InputJsonValue;
}

export function readAppSettingsFromProfile(signupProfile: unknown): CustomerAppSettings {
  const raw = profileRecord(signupProfile)[CUSTOMER_PREFERENCES_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_CUSTOMER_APP_SETTINGS };
  }
  const parsed = raw as Partial<CustomerAppSettings>;
  return {
    ...DEFAULT_CUSTOMER_APP_SETTINGS,
    ...parsed,
    currency: resolveCurrencyCode(parsed.currency ?? DEFAULT_CUSTOMER_APP_SETTINGS.currency),
    privacy: { ...DEFAULT_CUSTOMER_APP_SETTINGS.privacy, ...parsed.privacy },
    accessibility: { ...DEFAULT_CUSTOMER_APP_SETTINGS.accessibility, ...parsed.accessibility },
    shortcuts: { ...DEFAULT_CUSTOMER_APP_SETTINGS.shortcuts, ...parsed.shortcuts },
    communication: { ...DEFAULT_CUSTOMER_APP_SETTINGS.communication, ...parsed.communication },
    navigation: { ...DEFAULT_CUSTOMER_APP_SETTINGS.navigation, ...parsed.navigation },
    soundsVoice: { ...DEFAULT_CUSTOMER_APP_SETTINGS.soundsVoice, ...parsed.soundsVoice },
    safety: { ...DEFAULT_CUSTOMER_APP_SETTINGS.safety, ...parsed.safety }
  };
}

export function mergeAppSettingsIntoProfile(
  current: unknown,
  settings: CustomerAppSettings
): Prisma.InputJsonValue {
  const base = profileRecord(current);
  base[CUSTOMER_PREFERENCES_KEY] = settings;
  return base as Prisma.InputJsonValue;
}
