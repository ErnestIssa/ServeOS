import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Animated, StyleSheet } from "react-native";
import { topNavDimmerGradient } from "./chromeNavDimmerGradient";
import { FLOATING_TOP_BAR_HEIGHT, FLOATING_TOP_GAP, FLOATING_TOP_NUDGE } from "./FloatingTopBar";

/** Feather below the chrome so scroll content fades smoothly (not a hard edge). */
const VIGNETTE_EXTENSION = 236;

/** Scroll-content dim continues under the floating capsule before the long feather. */
const BELOW_NAV_BLEED = 52;

/**
 * Must stay below `FloatingTopBar` anchor z-index (30) and above `scrollLayer` (1) so the nav stays crisp.
 */
const DIMMER_Z_INDEX = 15;

type Props = {
  scrollY: Animated.Value;
  topInset: number;
};

/**
 * Darkens scroll content behind the floating top bar — top vignette paired with BottomNavContentDimmer.
 */
export function TopNavContentDimmer({ scrollY, topInset }: Props) {
  /** Bottom of floating capsule (negative FLOATING_TOP_NUDGE pulls chrome into the safe area). */
  const capsuleBottom = topInset + FLOATING_TOP_GAP + FLOATING_TOP_BAR_HEIGHT + FLOATING_TOP_NUDGE;
  const zoneHeight = Math.max(220, capsuleBottom + BELOW_NAV_BLEED + VIGNETTE_EXTENSION);

  const overlayOpacity = scrollY.interpolate({
    inputRange: [0, 40, 160, 480],
    outputRange: [0.82, 0.90, 0.96, 1],
    extrapolate: "clamp"
  });

  const { colors, locations } = topNavDimmerGradient();

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.anchor, { height: zoneHeight, opacity: overlayOpacity }]}
    >
      <LinearGradient
        colors={[...colors]}
        locations={[...locations]}
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
    top: 0,
    zIndex: DIMMER_Z_INDEX,
    elevation: 0
  }
});
