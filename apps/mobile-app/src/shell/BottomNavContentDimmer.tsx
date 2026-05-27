import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Animated, Platform, StyleSheet, View } from "react-native";
import { FLOATING_TAB_BAR_HEIGHT, FLOAT_MARGIN_BOTTOM } from "./navBottomMetrics";
import { useAppTheme } from "../theme/AppThemeContext";

/**
 * Same stacking rule as `TopNavContentDimmer`: above `scrollLayer` (1), below `FloatingGlassTabBar` (20).
 */
const DIMMER_Z_INDEX = 15;

/** Horizontal radius for the upward-scoop at the top corners of the glass. */
const SCOOP_RADIUS = 24;

type Props = {
  scrollY: Animated.Value;
  bottomInset: number;
};

/**
 * Glass overlay that sits exactly under the floating tab bar.
 * It blocks taps on content beneath (tab bar itself remains interactive above it).
 */
export function BottomNavContentDimmer({ scrollY, bottomInset }: Props) {
  const { isDark } = useAppTheme();

  const zoneHeight = FLOATING_TAB_BAR_HEIGHT + FLOAT_MARGIN_BOTTOM + bottomInset;

  const glassOpacity = scrollY.interpolate({
    inputRange: [0, 40, 160, 480],
    outputRange: [0, 0.62, 0.88, 1],
    extrapolate: "clamp"
  });

  const tint = isDark ? "dark" : "light";
  const androidBg = isDark ? "rgba(11,18,32,0.52)" : "rgba(248,250,252,0.52)";

  return (
    <Animated.View
      pointerEvents="auto"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.anchor, { height: zoneHeight + SCOOP_RADIUS, opacity: glassOpacity }]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.glassClip,
          {
            height: zoneHeight,
            borderTopLeftRadius: SCOOP_RADIUS,
            borderTopRightRadius: SCOOP_RADIUS
          }
        ]}
      >
        {Platform.OS === "ios" ? (
          <BlurView intensity={30} tint={tint} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: androidBg }]} />
        )}

        {/* Feather: transparent at top edge -> denser toward bottom edge for depth. */}
        <LinearGradient
          colors={
            isDark
              ? ["rgba(11,18,32,0.00)", "rgba(11,18,32,0.22)"]
              : ["rgba(248,250,252,0.00)", "rgba(248,250,252,0.22)"]
          }
          locations={[0, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </View>
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
  },
  glassClip: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden"
  }
});
