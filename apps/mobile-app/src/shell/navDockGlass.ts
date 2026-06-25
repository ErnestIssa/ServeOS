import type { BlurTint } from "expo-blur";
import { StyleSheet } from "react-native";

/** Hairline dock rim — barely-visible brand purple (not white frost). */
const NAV_DOCK_SHELL_BORDER = "rgba(124, 58, 237, 0.17)";
/** Dock capsule border — 3× device hairline. */
export const NAV_DOCK_SHELL_BORDER_WIDTH = StyleSheet.hairlineWidth * 3;

export type NavDockGlassTokens = {
  /** Base fill — very low opacity (liquid glass, not frosted plastic). */
  shellBg: string;
  shellBorder: string;
  /** Top edge specular line. */
  shellEdgeHighlight: string;
  /** Top-to-bottom refraction gradient (highlight → transparent). */
  shellRefractionTop: [string, string, string];
  /** Bottom edge depth gradient. */
  shellRefractionBottom: [string, string];
  /** Center pool simulating light bend. */
  shellInnerGlow: string;
  /** Diagonal specular streak. */
  specularStreak: [string, string, string];
  pillBg: string;
  pillBorder: string;
  pillRefractionTop: [string, string, string];
  pillInnerGlow: string;
  pillGlowColor: string;
  /** iOS-style control track (theme toggle). */
  controlBg: string;
  controlBorder: string;
  controlRefractionTop: [string, string, string];
  noiseOpacity: number;
  blurIntensity: number;
  blurIntensityPill: number;
  blurIntensityControl: number;
  blurTint: BlurTint;
  shadowColor: string;
  shadowOpacity: number;
};

/** Liquid glass tokens — smoked dark / airy light, shared by dock + controls. */
export function navDockGlassTokens(isDark: boolean): NavDockGlassTokens {
  if (isDark) {
    return {
      shellBg: "rgba(10,10,10,0.07)",
      shellBorder: NAV_DOCK_SHELL_BORDER,
      shellEdgeHighlight: "rgba(124, 58, 237, 0.12)",
      shellRefractionTop: ["rgba(255,255,255,0.18)", "rgba(255,255,255,0.04)", "rgba(255,255,255,0)"],
      shellRefractionBottom: ["rgba(255,255,255,0)", "rgba(0,0,0,0.24)"],
      shellInnerGlow: "rgba(255,255,255,0.06)",
      specularStreak: ["rgba(255,255,255,0)", "rgba(255,255,255,0.12)", "rgba(255,255,255,0)"],
      pillBg: "rgba(255,255,255,0.1)",
      pillBorder: "rgba(255,255,255,0.16)",
      pillRefractionTop: ["rgba(255,255,255,0.26)", "rgba(255,255,255,0.06)", "rgba(255,255,255,0)"],
      pillInnerGlow: "rgba(255,255,255,0.1)",
      pillGlowColor: "rgba(167,139,250,0.35)",
      controlBg: "rgba(255,255,255,0.06)",
      controlBorder: "rgba(255,255,255,0.12)",
      controlRefractionTop: ["rgba(255,255,255,0.2)", "rgba(255,255,255,0.05)", "rgba(255,255,255,0)"],
      noiseOpacity: 0.045,
      blurIntensity: 38,
      blurIntensityPill: 44,
      blurIntensityControl: 42,
      blurTint: "dark",
      shadowColor: "#000000",
      shadowOpacity: 0.42
    };
  }
  return {
    shellBg: "rgba(255,255,255,0.07)",
    shellBorder: NAV_DOCK_SHELL_BORDER,
    shellEdgeHighlight: "rgba(124, 58, 237, 0.14)",
    shellRefractionTop: ["rgba(255,255,255,0.42)", "rgba(255,255,255,0.1)", "rgba(255,255,255,0)"],
    shellRefractionBottom: ["rgba(255,255,255,0)", "rgba(15,23,42,0.08)"],
    shellInnerGlow: "rgba(255,255,255,0.14)",
    specularStreak: ["rgba(255,255,255,0)", "rgba(255,255,255,0.28)", "rgba(255,255,255,0)"],
    pillBg: "rgba(255,255,255,0.14)",
    pillBorder: "rgba(255,255,255,0.22)",
    pillRefractionTop: ["rgba(255,255,255,0.5)", "rgba(255,255,255,0.12)", "rgba(255,255,255,0)"],
    pillInnerGlow: "rgba(255,255,255,0.18)",
    pillGlowColor: "rgba(139,92,246,0.22)",
    controlBg: "rgba(255,255,255,0.1)",
    controlBorder: "rgba(255,255,255,0.2)",
    controlRefractionTop: ["rgba(255,255,255,0.45)", "rgba(255,255,255,0.1)", "rgba(255,255,255,0)"],
    noiseOpacity: 0.035,
    blurIntensity: 36,
    blurIntensityPill: 42,
    blurIntensityControl: 40,
    blurTint: "light",
    shadowColor: "#0f172a",
    shadowOpacity: 0.2
  };
}
