import React from "react";
import { loadDeviceTheme, saveDeviceTheme, type DeviceTheme } from "../customer/profile/profilePrefsStorage";
import { syncLegacyTheme } from "./syncLegacyTheme";

export type ThemeColors = {
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
  meshTop: string;
  meshBottom: string;
  menuGradient: [string, string, string];
};

export const lightColors: ThemeColors = {
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
  type: { hero: 32, title: 20, body: 16, label: 13, caption: 12 },
  meshTop: "#FAFAFC",
  meshBottom: "#E8EEF4",
  menuGradient: ["#FAFAFC", "#F1F5F9", "#FFFFFF"]
};

export const darkColors: ThemeColors = {
  bg: "#0B1220",
  bgSubtle: "#111827",
  bgElevated: "#1A2332",
  text: "#F8FAFC",
  textSecondary: "#94A3B8",
  textMuted: "#64748B",
  navIconIdle: "#94A3B8",
  navLabelIdle: "#94A3B8",
  border: "#243044",
  borderStrong: "#334155",
  accentBlue: "#60A5FA",
  accentPurple: "#A78BFA",
  ordersNavPurple: "#8B5CF6",
  ordersNavPurpleBright: "#A78BFA",
  success: "#34D399",
  danger: "#F87171",
  shadow: "rgba(0, 0, 0, 0.35)",
  space: { xs: 8, sm: 16, md: 24, lg: 32 },
  radius: { card: 20, tile: 16, input: 14, pill: 999 },
  type: { hero: 32, title: 20, body: 16, label: 13, caption: 12 },
  meshTop: "#0F172A",
  meshBottom: "#020617",
  menuGradient: ["#0F172A", "#111827", "#0B1220"]
};

syncLegacyTheme(lightColors);

type Ctx = {
  scheme: DeviceTheme;
  colors: ThemeColors;
  isDark: boolean;
  ready: boolean;
  setScheme: (s: DeviceTheme) => void;
  toggleScheme: () => void;
};

const AppThemeContext = React.createContext<Ctx | null>(null);

export function AppThemeProvider(props: { children: React.ReactNode }) {
  const [scheme, setSchemeState] = React.useState<DeviceTheme>("light");
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    void loadDeviceTheme().then((t) => {
      setSchemeState(t);
      setReady(true);
    });
  }, []);

  const setScheme = React.useCallback((s: DeviceTheme) => {
    setSchemeState(s);
    void saveDeviceTheme(s);
  }, []);

  const toggleScheme = React.useCallback(() => {
    setSchemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      void saveDeviceTheme(next);
      return next;
    });
  }, []);

  const colors = scheme === "dark" ? darkColors : lightColors;

  React.useEffect(() => {
    syncLegacyTheme(colors);
  }, [colors]);

  const value = React.useMemo(
    () => ({ scheme, colors, isDark: scheme === "dark", ready, setScheme, toggleScheme }),
    [scheme, colors, ready, setScheme, toggleScheme]
  );

  return <AppThemeContext.Provider value={value}>{props.children}</AppThemeContext.Provider>;
}

export function useAppTheme(): Ctx {
  const ctx = React.useContext(AppThemeContext);
  if (!ctx) throw new Error("useAppTheme must be used within AppThemeProvider");
  return ctx;
}
