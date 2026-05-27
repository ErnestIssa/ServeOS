import AsyncStorage from "@react-native-async-storage/async-storage";

export type ProfileStackRoute =
  | { name: "home" }
  | { name: "settings" }
  | { name: "settings_detail"; key: SettingsDetailKey }
  | { name: "help" }
  | { name: "safety" }
  | { name: "section"; title: string; subtitle?: string };

export type SettingsDetailKey =
  | "manage_account"
  | "privacy"
  | "address"
  | "accessibility"
  | "night_mode"
  | "shortcuts"
  | "communication"
  | "navigation"
  | "sounds_voice";

export type AppSettings = {
  privacy: { profileVisibility: "public" | "venues" | "private"; shareAnalytics: boolean };
  accessibility: { reduceMotion: boolean; boldText: boolean };
  nightMode: "system" | "light" | "dark";
  shortcuts: { enabled: boolean };
  communication: { email: boolean; push: boolean; sms: boolean };
  navigation: { preferredMaps: "apple" | "google" | "waze" };
  soundsVoice: { messageSounds: boolean; voiceGuidance: boolean };
  safety: { pinEnabled: boolean; tripCheck: boolean };
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  privacy: { profileVisibility: "venues", shareAnalytics: true },
  accessibility: { reduceMotion: false, boldText: false },
  nightMode: "system",
  shortcuts: { enabled: true },
  communication: { email: true, push: true, sms: false },
  navigation: { preferredMaps: "google" },
  soundsVoice: { messageSounds: true, voiceGuidance: false },
  safety: { pinEnabled: false, tripCheck: true }
};

const KEY_THEME = "serveos.customer.theme";
const KEY_PUSH = "serveos.customer.pref_push";
const KEY_LOCATION = "serveos.customer.pref_location";
const KEY_APP_SETTINGS = "serveos.customer.appSettings";

export type DeviceTheme = "light" | "dark";

export async function loadDeviceTheme(): Promise<DeviceTheme> {
  const v = await AsyncStorage.getItem(KEY_THEME);
  return v === "dark" ? "dark" : "light";
}

export async function saveDeviceTheme(theme: DeviceTheme): Promise<void> {
  await AsyncStorage.setItem(KEY_THEME, theme);
}

export async function loadProfileQuickPrefs(): Promise<{ push: boolean; location: boolean }> {
  const [push, loc] = await Promise.all([AsyncStorage.getItem(KEY_PUSH), AsyncStorage.getItem(KEY_LOCATION)]);
  return {
    push: push !== "0",
    location: loc !== "0"
  };
}

export async function saveProfilePush(on: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY_PUSH, on ? "1" : "0");
}

export async function saveProfileLocation(on: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY_LOCATION, on ? "1" : "0");
}

export async function loadAppSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY_APP_SETTINGS);
    if (!raw) return { ...DEFAULT_APP_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_APP_SETTINGS,
      ...parsed,
      privacy: { ...DEFAULT_APP_SETTINGS.privacy, ...parsed.privacy },
      accessibility: { ...DEFAULT_APP_SETTINGS.accessibility, ...parsed.accessibility },
      shortcuts: { ...DEFAULT_APP_SETTINGS.shortcuts, ...parsed.shortcuts },
      communication: { ...DEFAULT_APP_SETTINGS.communication, ...parsed.communication },
      navigation: { ...DEFAULT_APP_SETTINGS.navigation, ...parsed.navigation },
      soundsVoice: { ...DEFAULT_APP_SETTINGS.soundsVoice, ...parsed.soundsVoice },
      safety: { ...DEFAULT_APP_SETTINGS.safety, ...parsed.safety }
    };
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(KEY_APP_SETTINGS, JSON.stringify(settings));
}
