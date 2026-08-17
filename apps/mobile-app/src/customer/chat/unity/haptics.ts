import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const enabled = Platform.OS !== "web";

function run(fn: () => Promise<void>) {
  if (!enabled) return;
  void fn().catch(() => {});
}

export type HapticKind = "selection" | "light" | "medium" | "success" | "warning" | "error" | "none";

export function triggerHaptic(kind: HapticKind = "light") {
  if (kind === "none" || !enabled) return;
  setTimeout(() => {
    switch (kind) {
      case "selection":
        run(() => Haptics.selectionAsync());
        break;
      case "light":
        run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
        break;
      case "medium":
        run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
        break;
      case "success":
        run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
        break;
      case "warning":
        run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
        break;
      case "error":
        run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
        break;
      default:
        break;
    }
  }, 0);
}

export function hapticSelection() {
  triggerHaptic("selection");
}

export function hapticLight() {
  triggerHaptic("light");
}

export function hapticMedium() {
  triggerHaptic("medium");
}

export function hapticSuccess() {
  triggerHaptic("success");
}
