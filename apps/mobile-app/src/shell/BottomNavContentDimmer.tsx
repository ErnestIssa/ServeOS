import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Animated, StyleSheet } from "react-native";
import { BOTTOM_NAV_DIMMER_COLORS, BOTTOM_NAV_DIMMER_LOCATIONS } from "./chromeNavDimmerGradient";
import { FLOATING_TAB_BAR_HEIGHT, FLOAT_MARGIN_BOTTOM } from "./navBottomMetrics";

/** Feather upward into scroll content (extends slightly past the pill; tab bar paints above). */
const VIGNETTE_EXTENSION = 228;

/** Extra reach below the pill anchor (safe-area / margin). */
const BELOW_CHROME_PAD = 18;

/**
 * Same stacking rule as `TopNavContentDimmer`: above `scrollLayer` (1), below `FloatingGlassTabBar` (20).
 */
const DIMMER_Z_INDEX = 15;

type Props = {
  scrollY: Animated.Value;
  bottomInset: number;
};

/**
 * Darkens scroll content behind / meeting the floating tab bar — bottom vignette only;
 * chrome stays above this layer in `App.tsx`.
 */
export function BottomNavContentDimmer({ scrollY, bottomInset }: Props) {
  const zoneHeight =
    FLOATING_TAB_BAR_HEIGHT + FLOAT_MARGIN_BOTTOM + bottomInset + BELOW_CHROME_PAD + VIGNETTE_EXTENSION;

  const overlayOpacity = scrollY.interpolate({
    inputRange: [0, 40, 160, 480],
    outputRange: [0.82, 0.9, 0.96, 1],
    extrapolate: "clamp"
  });

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.anchor, { height: zoneHeight, opacity: overlayOpacity }]}
    >
      <LinearGradient
        colors={[...BOTTOM_NAV_DIMMER_COLORS]}
        locations={[...BOTTOM_NAV_DIMMER_LOCATIONS]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: DIMMER_Z_INDEX,
    elevation: 0
  }
});
