import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Animated, StyleSheet } from "react-native";
import { topNavDimmerGradient } from "./chromeNavDimmerGradient";
import { FLOATING_TOP_BAR_HEIGHT, FLOATING_TOP_GAP } from "./FloatingTopBar";

/** Match BottomNavContentDimmer — soft fade into page content without climbing higher. */
const VIGNETTE_EXTENSION = 96;

type Props = {
  scrollY: Animated.Value;
  topInset: number;
};

/**
 * Darkens scroll content behind the floating top bar — top vignette paired with BottomNavContentDimmer.
 */
export function TopNavContentDimmer({ scrollY, topInset }: Props) {
  const zoneHeight = topInset + FLOATING_TOP_GAP + FLOATING_TOP_BAR_HEIGHT + VIGNETTE_EXTENSION;

  const overlayOpacity = scrollY.interpolate({
    inputRange: [0, 40, 160, 480],
    outputRange: [0.56, 0.68, 0.86, 0.97],
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
    zIndex: 12,
    elevation: 0
  }
});
