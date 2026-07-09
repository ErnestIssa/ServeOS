import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle
} from "react-native-reanimated";
import { useAppTheme } from "../theme/AppThemeContext";

/** Below floating dock (22), above expand sheet (18). */
export const NAV_BOTTOM_SCRIM_Z_INDEX = 20;

/** Layer A — ambient depth field reaches ~52% of viewport height. */
export const NAV_BOTTOM_AMBIENT_HEIGHT_RATIO = 0.52;
/** Layer B — local contrast reinforcement in the lower ~16% (kept shorter so dock clears scrim). */
export const NAV_BOTTOM_LOCAL_HEIGHT_RATIO = 0.16;

type GradientStops = {
  colors: readonly [string, string, string, string, string, string, string];
  locations: readonly [number, number, number, number, number, number, number];
};

/**
 * Long-range atmospheric field — ultra-soft multi-stop fade with no perceptible edge.
 * Cool slate depth in light mode (no white/gray haze).
 */
export function navBottomAmbientStops(isDark: boolean): GradientStops {
  if (isDark) {
    return {
      colors: [
        "rgba(0,0,0,0)",
        "rgba(0,0,0,0)",
        "rgba(0,0,0,0.02)",
        "rgba(0,0,0,0.045)",
        "rgba(0,0,0,0.07)",
        "rgba(0,0,0,0.095)",
        "rgba(0,0,0,0.11)"
      ],
      locations: [0, 0.12, 0.28, 0.44, 0.6, 0.78, 1]
    };
  }
  return {
    colors: [
      "rgba(12,18,28,0)",
      "rgba(12,18,28,0)",
      "rgba(12,18,28,0.01)",
      "rgba(12,18,28,0.022)",
      "rgba(12,18,28,0.036)",
      "rgba(12,18,28,0.048)",
      "rgba(12,18,28,0.058)"
    ],
    locations: [0, 0.14, 0.3, 0.46, 0.62, 0.8, 1]
  };
}

/** Layer B — barely-there reinforcement near the dock (never defines nav shape). */
export function navBottomLocalStops(isDark: boolean): GradientStops {
  if (isDark) {
    return {
      colors: [
        "rgba(0,0,0,0)",
        "rgba(0,0,0,0)",
        "rgba(0,0,0,0.018)",
        "rgba(0,0,0,0.04)",
        "rgba(0,0,0,0.065)",
        "rgba(0,0,0,0.085)",
        "rgba(0,0,0,0.1)"
      ],
      locations: [0, 0.16, 0.34, 0.52, 0.7, 0.86, 1]
    };
  }
  return {
    colors: [
      "rgba(12,18,28,0)",
      "rgba(12,18,28,0)",
      "rgba(12,18,28,0.008)",
      "rgba(12,18,28,0.018)",
      "rgba(12,18,28,0.03)",
      "rgba(12,18,28,0.042)",
      "rgba(12,18,28,0.052)"
    ],
    locations: [0, 0.18, 0.36, 0.54, 0.72, 0.88, 1]
  };
}

type Props = {
  /** 1 = idle; 0 = scrolling — drives barely-visible local intensity only. */
  bottomNavFocusSV: SharedValue<number>;
};

/**
 * Two-layer ambient depth conditioning behind the glass dock.
 * Layer A: long-range field (~50% screen) — fixed, no visible boundary.
 * Layer B: local reinforcement — subtle scroll-linked opacity only.
 */
export function NavBottomScrim({ bottomNavFocusSV }: Props) {
  const { isDark } = useAppTheme();
  const { height: screenH } = useWindowDimensions();

  const ambientStops = React.useMemo(() => navBottomAmbientStops(isDark), [isDark]);
  const localStops = React.useMemo(() => navBottomLocalStops(isDark), [isDark]);

  const fieldHeight = Math.max(280, Math.round(screenH * NAV_BOTTOM_AMBIENT_HEIGHT_RATIO));
  const localHeight = Math.max(120, Math.round(screenH * NAV_BOTTOM_LOCAL_HEIGHT_RATIO));

  const localLayerStyle = useAnimatedStyle(() => {
    const focus = bottomNavFocusSV.value;
    const opacity = interpolate(focus, [0, 1], [1, 0.82], Extrapolation.CLAMP);
    return { opacity };
  });

  const fieldLayerStyle = useAnimatedStyle(() => {
    const focus = bottomNavFocusSV.value;
    const opacity = interpolate(focus, [0, 1], [1, 0.94], Extrapolation.CLAMP);
    return { opacity };
  });

  return (
    <View
      pointerEvents="none"
      style={styles.anchor}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[styles.layer, { height: fieldHeight }, fieldLayerStyle]}>
        <LinearGradient
          colors={[...ambientStops.colors]}
          locations={[...ambientStops.locations]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </Animated.View>

      <Animated.View style={[styles.layer, { height: localHeight }, localLayerStyle]}>
        <LinearGradient
          colors={[...localStops.colors]}
          locations={[...localStops.locations]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: NAV_BOTTOM_SCRIM_Z_INDEX,
    elevation: 0
  },
  layer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0
  }
});
