import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Animated, StyleSheet } from "react-native";
import { BOTTOM_NAV_DIMMER_COLORS, BOTTOM_NAV_DIMMER_LOCATIONS } from "./chromeNavDimmerGradient";
import { FLOATING_TAB_BAR_HEIGHT, FLOAT_MARGIN_BOTTOM } from "./navBottomMetrics";

/** Extra fade above the pill so the transition feels gradual, not a hard line. */
const VIGNETTE_EXTENSION = 96;

type Props = {
  scrollY: Animated.Value;
  bottomInset: number;
};

/**
 * Darkens scroll content that sits behind / meets the floating tab bar — a bottom vignette
 * whose strength increases as the user scrolls (content “settles” into the chrome).
 */
export function BottomNavContentDimmer({ scrollY, bottomInset }: Props) {
  const zoneHeight =
    FLOATING_TAB_BAR_HEIGHT + FLOAT_MARGIN_BOTTOM + bottomInset + VIGNETTE_EXTENSION;

  const overlayOpacity = scrollY.interpolate({
    inputRange: [0, 40, 160, 480],
    outputRange: [0.56, 0.68, 0.86, 0.97],
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
    zIndex: 12,
    elevation: 0
  }
});
