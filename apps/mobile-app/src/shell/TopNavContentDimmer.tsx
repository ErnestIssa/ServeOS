import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Animated, Platform, StyleSheet, View } from "react-native";
import { FLOATING_TOP_BAR_HEIGHT, FLOATING_TOP_GAP, FLOATING_TOP_NUDGE } from "./FloatingTopBar";
import { useAppTheme } from "../theme/AppThemeContext";

const DIMMER_Z_INDEX = 15;

/** Horizontal radius of the downward-scoop at the bottom corners of the glass. */
const SCOOP_RADIUS = 24;

type Props = {
  scrollY: Animated.Value;
  topInset: number;
};

/**
 * Glassmorphism top-nav overlay that sits exactly as tall as the floating capsule.
 * Bottom corners curve outward (downward scoop) using an overflow-hidden clip.
 * The area beneath the glass intercepts no touches; the glass itself is pointer-events none.
 */
export function TopNavContentDimmer({ scrollY, topInset }: Props) {
  const { isDark } = useAppTheme();

  /** Exact bottom edge of the floating capsule. */
  const glassHeight = topInset + FLOATING_TOP_GAP + FLOATING_TOP_BAR_HEIGHT + FLOATING_TOP_NUDGE;

  const glassOpacity = scrollY.interpolate({
    inputRange: [0, 32, 120],
    outputRange: [0, 0.6, 1],
    extrapolate: "clamp"
  });

  const tint = isDark ? "dark" : "light";
  const androidBg = isDark ? "rgba(11,18,32,0.52)" : "rgba(248,250,252,0.52)";

  return (
    <Animated.View
      pointerEvents="box-none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.anchor, { height: glassHeight + SCOOP_RADIUS, opacity: glassOpacity }]}
    >
      {/*
        Inner clip: exact glass height with downward-scoop corners.
        overflow:hidden on a View with borderBottomLeftRadius/borderBottomRightRadius
        gives the concave scoop on iOS & Android.
      */}
      <View
        style={[
          styles.glassClip,
          {
            height: glassHeight,
            borderBottomLeftRadius: SCOOP_RADIUS,
            borderBottomRightRadius: SCOOP_RADIUS,
          }
        ]}
        pointerEvents="none"
      >
        {Platform.OS === "ios" ? (
          <BlurView
            intensity={30}
            tint={tint}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: androidBg }]} />
        )}
        {/* Subtle top-to-transparent inner gradient for depth. */}
        <LinearGradient
          colors={
            isDark
              ? ["rgba(11,18,32,0.20)", "rgba(11,18,32,0.00)"]
              : ["rgba(248,250,252,0.20)", "rgba(248,250,252,0.00)"]
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
    top: 0,
    zIndex: DIMMER_Z_INDEX,
    elevation: 0,
    overflow: "hidden"
  },
  glassClip: {
    overflow: "hidden",
    left: 0,
    right: 0,
    position: "absolute",
    top: 0
  }
});
