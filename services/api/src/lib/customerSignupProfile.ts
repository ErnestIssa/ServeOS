import type { Prisma } from "@prisma/client";

export const PREFERRED_RESTAURANT_KEY = "preferredRestaurantId";
export const CUSTOMER_PREFERENCES_KEY = "customerAppSettings";
export const CUSTOMER_AVATAR_KEY = "avatarUri";
export const CUSTOMER_QUICK_PREFS_KEY = "customerQuickPrefs";

export type CustomerQuickPrefs = {
  push: boolean;
  location: boolean;
};

export type CustomerAppSettings = {
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
