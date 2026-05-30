import { Platform } from "react-native";

/**
 * Universal floating top/bottom nav glass — same blur, tint, and scoop on every tab.
 * Used by `TopNavContentDimmer`, `BottomNavContentDimmer`, and kept in sync with tab bar chrome.
 */
export const NAV_GLASS_SCOOP_RADIUS = 24;

export const NAV_GLASS_DIMMER_Z_INDEX = 15;

export const NAV_GLASS_BLUR_INTENSITY = Platform.OS === "ios" ? 30 : 30;

export function navGlassAndroidFill(isDark: boolean): string {
  return isDark ? "rgba(11,18,32,0.52)" : "rgba(248,250,252,0.52)";
}

export function navGlassGradientFeather(isDark: boolean): {
  top: [string, string];
  bottom: [string, string];
} {
  return {
    top: isDark
      ? ["rgba(11,18,32,0.20)", "rgba(11,18,32,0.00)"]
      : ["rgba(248,250,252,0.20)", "rgba(248,250,252,0.00)"],
    bottom: isDark
      ? ["rgba(11,18,32,0.00)", "rgba(11,18,32,0.22)"]
      : ["rgba(248,250,252,0.00)", "rgba(248,250,252,0.22)"]
  };
}

export function navGlassBlurTint(isDark: boolean): "dark" | "light" {
  return isDark ? "dark" : "light";
}
