import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { registerDevicePushToken } from "./notificationsApi";

/** Register the native FCM/APNs device token with the ServeOS API (backend-driven push). */
export async function syncDevicePushTokenWithBackend(authToken: string): Promise<void> {
  const jwt = authToken.trim();
  if (!jwt) return;

  try {
    const current = await Notifications.getPermissionsAsync();
    if (!current.granted) {
      const requested = await Notifications.requestPermissionsAsync();
      if (!requested.granted) return;
    }

    const device = await Notifications.getDevicePushTokenAsync();
    const token = typeof device.data === "string" ? device.data.trim() : "";
    if (!token) return;

    await registerDevicePushToken(jwt, {
      token,
      platform: Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : Platform.OS,
      deviceName: Platform.OS
    });
  } catch {
    /* Expo Go / simulator may not expose native push tokens — non-fatal */
  }
}
