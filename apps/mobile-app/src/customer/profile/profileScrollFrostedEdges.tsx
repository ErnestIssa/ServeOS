import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Animated, Platform, StyleSheet, View } from "react-native";
import { FLOATING_TAB_BAR_HEIGHT, FLOATING_TAB_BAR_MARGIN_SIDE } from "../../shell/navBottomMetrics";

/**
 * Visible glass height — lower half of the home tab bar chrome (80px → 40px)
 * plus a little room for the top scoop curve.
 */
export const FROSTED_SCROLL_EDGE_BELOW =
  Math.ceil(FLOATING_TAB_BAR_HEIGHT / 2) + 12;

/** Matches `FloatingGlassTabBar` collapsed shell radius (28). */
const BOTTOM_SHELL_RADIUS = 28;

/** Top cap: outward (convex) lip curving into the list below the back row. */
const TOP_LIP_RADIUS = 36;
const TOP_LIP_INSET = 10;

type Rgb = { r: number; g: number; b: number };

function parseHexColor(hex: string): Rgb {
  const raw = hex.replace("#", "").trim();
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw.slice(0, 6);
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16)
  };
}

function rgba(rgb: Rgb, a: number) {
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;
}

function buildScrimGradient(edge: "top" | "bottom", baseHex: string) {
  const rgb = parseHexColor(baseHex);
  const alphas =
    edge === "top"
      ? [0.995, 0.98, 0.94, 0.82, 0.62, 0.38, 0.18, 0.06, 0]
      : [0, 0.04, 0.12, 0.28, 0.5, 0.74, 0.9, 0.97, 0.995];
  const locations =
    edge === "top"
      ? [0, 0.08, 0.2, 0.38, 0.55, 0.7, 0.84, 0.94, 1]
      : [0, 0.18, 0.34, 0.5, 0.66, 0.8, 0.9, 0.96, 1];
  return {
    colors: alphas.map((a) => rgba(rgb, a)) as [string, string, ...string[]],
    locations: locations as [number, number, ...number[]]
  };
}

function buildGlassSheen(edge: "top" | "bottom", isDark: boolean) {
  const frost = isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.42)";
  const mid = isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.14)";
  if (edge === "top") {
    return {
      colors: [frost, mid, "rgba(255,255,255,0)", "rgba(255,255,255,0)"] as [string, string, ...string[]],
      locations: [0, 0.2, 0.55, 1] as [number, number, ...number[]]
    };
  }
  return {
    colors: ["rgba(255,255,255,0)", "rgba(255,255,255,0)", mid, frost] as [string, string, ...string[]],
    locations: [0, 0.62, 0.86, 1] as [number, number, ...number[]]
  };
}

export function FrostedTopChrome(props: {
  opacity: Animated.Value;
  baseHex: string;
  isDark: boolean;
  topChromeHeight: number;
  anchor?: "stack" | "scroll";
}) {
  const chromeH = Math.max(48, props.topChromeHeight);
  const scrim = buildScrimGradient("top", props.baseHex);
  const sheen = buildGlassSheen("top", props.isDark);
  const anchor = props.anchor ?? "scroll";

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.topChrome,
        {
          top: anchor === "stack" ? 0 : -chromeH,
          height: chromeH,
          opacity: props.opacity
        }
      ]}
    >
      <BlurView
        intensity={Platform.OS === "ios" ? 68 : 50}
        tint={props.isDark ? "dark" : "light"}
        style={StyleSheet.absoluteFill}
        {...(Platform.OS === "android"
          ? ({ experimentalBlurMethod: "dimezisBlurView" } as const)
          : {})}
      />
      <LinearGradient colors={scrim.colors} locations={scrim.locations} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={sheen.colors} locations={sheen.locations} style={StyleSheet.absoluteFill} />
      <View
        style={[
          styles.topLip,
          {
            borderBottomLeftRadius: TOP_LIP_RADIUS,
            borderBottomRightRadius: TOP_LIP_RADIUS,
            borderColor: props.isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.45)"
          }
        ]}
      />
      <View
        style={[
          styles.chromeHairline,
          styles.hairlineBottom,
          {
            left: TOP_LIP_INSET,
            right: TOP_LIP_INSET,
            backgroundColor: props.isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.55)"
          }
        ]}
      />
    </Animated.View>
  );
}

/**
 * Bottom glass = lower half of the home `FloatingGlassTabBar` shell:
 * same side insets, 28px bottom corners, upward scoop on the top edge
 * (flat centre, sides curve up into the list) — one piece, no extra layers.
 */
function FrostedBottomEdge(props: {
  opacity: Animated.Value;
  baseHex: string;
  isDark: boolean;
}) {
  const androidBg = props.isDark ? "rgba(11,18,32,0.32)" : "rgba(248,250,252,0.32)";
  const dimA = props.isDark ? "rgba(11,18,32,0.00)" : "rgba(248,250,252,0.00)";
  const dimB = props.isDark ? "rgba(11,18,32,0.04)" : "rgba(248,250,252,0.04)";
  const dimC = props.isDark ? "rgba(11,18,32,0.08)" : "rgba(248,250,252,0.08)";
  const dimD = props.isDark ? "rgba(11,18,32,0.12)" : "rgba(248,250,252,0.12)";
  const dimE = props.isDark ? "rgba(11,18,32,0.16)" : "rgba(248,250,252,0.16)";
  const dimF = props.isDark ? "rgba(11,18,32,0.20)" : "rgba(248,250,252,0.20)";
  const dimG = props.isDark ? "rgba(11,18,32,0.24)" : "rgba(248,250,252,0.24)";
  const dimH = props.isDark ? "rgba(11,18,32,0.28)" : "rgba(248,250,252,0.28)";
  const dimI = props.isDark ? "rgba(11,18,32,0.32)" : "rgba(248,250,252,0.32)";

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.bottomAnchor, { opacity: props.opacity }]}
    >
      <View style={styles.bottomGlass}>
        {Platform.OS === "ios" ? (
          <BlurView intensity={64} tint={props.isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: androidBg }]} />
        )}
        {/* Ultra-smooth dim ramp: avoids visible start/end bands. */}
        <LinearGradient
          colors={[dimA, dimB, dimC, dimD, dimE, dimF, dimG, dimH, dimI]}
          locations={[0, 0.12, 0.22, 0.32, 0.44, 0.56, 0.7, 0.84, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </View>
    </Animated.View>
  );
}

type Props = {
  topOpacity: Animated.Value;
  bottomOpacity: Animated.Value;
  baseHex: string;
  isDark: boolean;
  topChromeHeight?: number;
  externalTopChrome?: boolean;
};

export function ProfileScrollFrostedEdges(props: Props) {
  const chromeH = Math.max(0, props.topChromeHeight ?? 0);
  const showTop = chromeH > 0 && !props.externalTopChrome;

  return (
    <>
      {showTop ? (
        <FrostedTopChrome
          opacity={props.topOpacity}
          baseHex={props.baseHex}
          isDark={props.isDark}
          topChromeHeight={chromeH}
        />
      ) : null}
      <FrostedBottomEdge opacity={props.bottomOpacity} baseHex={props.baseHex} isDark={props.isDark} />
    </>
  );
}

const styles = StyleSheet.create({
  topChrome: {
    position: "absolute",
    left: 0,
    right: 0,
    overflow: "hidden",
    zIndex: 4,
    borderBottomLeftRadius: TOP_LIP_RADIUS,
    borderBottomRightRadius: TOP_LIP_RADIUS
  },
  topLip: {
    position: "absolute",
    left: TOP_LIP_INSET,
    right: TOP_LIP_INSET,
    bottom: 0,
    height: TOP_LIP_RADIUS,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    backgroundColor: "transparent"
  },
  bottomAnchor: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: FROSTED_SCROLL_EDGE_BELOW + BOTTOM_SHELL_RADIUS,
    zIndex: 4,
    overflow: "hidden"
  },
  /**
   * Lower half of home tab bar: side margins match `FLOATING_TAB_BAR_MARGIN_SIDE`;
   * bottom corners match shell (28); top corners scoop upward like bottom nav glass.
   */
  bottomGlass: {
    position: "absolute",
    left: FLOATING_TAB_BAR_MARGIN_SIDE,
    right: FLOATING_TAB_BAR_MARGIN_SIDE,
    bottom: 0,
    height: FROSTED_SCROLL_EDGE_BELOW,
    overflow: "hidden",
    borderTopLeftRadius: BOTTOM_SHELL_RADIUS,
    borderTopRightRadius: BOTTOM_SHELL_RADIUS,
    borderBottomLeftRadius: BOTTOM_SHELL_RADIUS,
    borderBottomRightRadius: BOTTOM_SHELL_RADIUS
  },
  chromeHairline: {
    position: "absolute",
    height: StyleSheet.hairlineWidth
  },
  hairlineBottom: { bottom: 0 }
});
