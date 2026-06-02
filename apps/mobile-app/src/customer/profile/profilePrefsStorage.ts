import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchCustomerPreferences, patchCustomerPreferences } from "../customerAppApi";

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

/** Server SST with local cache fallback (control centre + settings). */
export async function loadAppSettingsForCustomer(authToken?: string | null): Promise<AppSettings> {
  const tok = authToken?.trim();
  if (tok) {
    try {
      const res = await fetchCustomerPreferences(tok);
      if (res.ok) {
        await saveAppSettings(res.appSettings);
        await saveProfilePush(res.quickPrefs.push);
        await saveProfileLocation(res.quickPrefs.location);
        if (res.appSettings.nightMode === "dark") await saveDeviceTheme("dark");
        else if (res.appSettings.nightMode === "light") await saveDeviceTheme("light");
        return res.appSettings;
      }
    } catch {
      /* local fallback */
    }
  }
  return loadAppSettings();
}

export async function saveAppSettingsForCustomer(
  settings: AppSettings,
  authToken?: string | null
): Promise<void> {
  await saveAppSettings(settings);
  const tok = authToken?.trim();
  if (!tok) return;
  void patchCustomerPreferences(tok, { appSettings: settings }).catch(() => {});
}

export async function loadProfileQuickPrefsForCustomer(
  authToken?: string | null
): Promise<{ push: boolean; location: boolean }> {
  const tok = authToken?.trim();
  if (tok) {
    try {
      const res = await fetchCustomerPreferences(tok);
      if (res.ok) {
        await saveProfilePush(res.quickPrefs.push);
        await saveProfileLocation(res.quickPrefs.location);
        return res.quickPrefs;
      }
    } catch {
      /* local */
    }
  }
  return loadProfileQuickPrefs();
}

export async function saveProfilePushForCustomer(on: boolean, authToken?: string | null): Promise<void> {
  await saveProfilePush(on);
  const tok = authToken?.trim();
  if (!tok) return;
  const q = await loadProfileQuickPrefsForCustomer(tok);
  void patchCustomerPreferences(tok, { quickPrefs: { ...q, push: on } }).catch(() => {});
}

export async function saveProfileLocationForCustomer(
  on: boolean,
  authToken?: string | null
): Promise<void> {
  await saveProfileLocation(on);
  const tok = authToken?.trim();
  if (!tok) return;
  const q = await loadProfileQuickPrefsForCustomer(tok);
  void patchCustomerPreferences(tok, { quickPrefs: { ...q, location: on } }).catch(() => {});
}

export async function saveProfileAvatarForCustomer(
  uri: string | null,
  authToken?: string | null
): Promise<void> {
  const tok = authToken?.trim();
  if (!tok) return;
  void patchCustomerPreferences(tok, { avatarUri: uri }).catch(() => {});
}
