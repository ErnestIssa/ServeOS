import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

let configured = false;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

export async function ensureChatNotificationPermissions(): Promise<boolean> {
  if (!configured) {
    configured = true;
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("chat", {
        name: "Chat",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default"
      }).catch(() => undefined);
    }
  }
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

export async function notifyIncomingChatMessage(restaurantName: string, preview: string) {
  const ok = await ensureChatNotificationPermissions();
  if (!ok) return;
  const title = restaurantName.trim() || "Restaurant";
  const body = preview.trim().length ? preview.trim() : "New message";
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      ...(Platform.OS === "android" ? { channelId: "chat" } : {})
    },
    trigger: null
  }).catch(() => undefined);
}

export async function setChatBadgeCount(count: number) {
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, count));
  } catch {
    /* non-fatal */
  }
}
