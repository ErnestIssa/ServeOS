import type { ThemeColors } from "./AppThemeContext";

/** Mutable legacy palette — updated when app theme changes so `import { R }` stays in sync. */
export const R = {
  bg: "#FFFFFF",
  bgSubtle: "#F3F4F6",
  bgElevated: "#F9FAFB",
  text: "#111111",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  navIconIdle: "#475569",
  navLabelIdle: "#475569",
  border: "#E5E7EB",
  borderStrong: "#D1D5DB",
  accentBlue: "#3B82F6",
  accentPurple: "#8B5CF6",
  ordersNavPurple: "#6D28D9",
  ordersNavPurpleBright: "#7C3AED",
  success: "#10B981",
  danger: "#EF4444",
  shadow: "rgba(17, 24, 39, 0.06)",
  space: { xs: 8, sm: 16, md: 24, lg: 32 },
  radius: { card: 20, tile: 16, input: 14, pill: 999 },
  type: { hero: 32, title: 20, body: 16, label: 13, caption: 12 }
} as {
  bg: string;
  bgSubtle: string;
  bgElevated: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  navIconIdle: string;
  navLabelIdle: string;
  border: string;
  borderStrong: string;
  accentBlue: string;
  accentPurple: string;
  ordersNavPurple: string;
  ordersNavPurpleBright: string;
  success: string;
  danger: string;
  shadow: string;
  space: { xs: number; sm: number; md: number; lg: number };
  radius: { card: number; tile: number; input: number; pill: number };
  type: { hero: number; title: number; body: number; label: number; caption: number };
};

export function syncLegacyTheme(colors: ThemeColors): void {
  Object.assign(R, {
    bg: colors.bg,
    bgSubtle: colors.bgSubtle,
    bgElevated: colors.bgElevated,
    text: colors.text,
    textSecondary: colors.textSecondary,
    textMuted: colors.textMuted,
    navIconIdle: colors.navIconIdle,
    navLabelIdle: colors.navLabelIdle,
    border: colors.border,
    borderStrong: colors.borderStrong,
    accentBlue: colors.accentBlue,
    accentPurple: colors.accentPurple,
    ordersNavPurple: colors.ordersNavPurple,
    ordersNavPurpleBright: colors.ordersNavPurpleBright,
    success: colors.success,
    danger: colors.danger,
    shadow: colors.shadow,
    space: colors.space,
    radius: colors.radius,
    type: colors.type
  });
}

export function themedCardShell(isDark: boolean, t: ThemeColors) {
  return {
    backgroundColor: isDark ? "rgba(26, 35, 50, 0.94)" : "rgba(255,255,255,0.84)",
    borderColor: isDark ? t.border : "rgba(226,232,240,0.92)"
  };
}

export function themedInputBg(isDark: boolean, t: ThemeColors) {
  return { backgroundColor: isDark ? t.bgElevated : "rgba(255,255,255,0.85)", color: t.text, borderColor: t.border };
}

export function themedPillGhost(isDark: boolean, t: ThemeColors) {
  return {
    backgroundColor: isDark ? "rgba(26, 35, 50, 0.7)" : "rgba(255,255,255,0.65)",
    borderColor: t.border
  };
}
