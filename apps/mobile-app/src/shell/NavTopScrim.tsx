import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Platform, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle
} from "react-native-reanimated";
import { useAppTheme } from "../theme/AppThemeContext";
import {
  NAV_BOTTOM_AMBIENT_HEIGHT_RATIO
} from "./NavBottomScrim";
import {
  NAV_GLASS_BLUR_INTENSITY,
  NAV_GLASS_SCOOP_RADIUS,
  navGlassAndroidFill,
  navGlassBlurTint,
  navGlassGradientFeather
} from "./navGlassChrome";
import {
  CONTENT_GAP_BELOW_TOP_NAV,
  FLOAT_MARGIN_TOP,
  FLOAT_MARGIN_TOP_HOME,
  FLOATING_HOME_TOP_BAR_HEIGHT,
  FLOATING_TOP_BAR_HEIGHT
} from "./navBottomMetrics";

/** Below floating top bar (30), above scroll mesh — matches bottom scrim stack order. */
export const NAV_TOP_SCRIM_Z_INDEX = 28;

type GradientStops = {
  colors: readonly [string, string, string, string, string, string, string];
  locations: readonly [number, number, number, number, number, number, number];
};

/** Long-range top field — strongest at the physical screen top. */
function navTopAmbientStops(isDark: boolean): GradientStops {
  if (isDark) {
    return {
      colors: [
        "rgba(0,0,0,0.26)",
        "rgba(0,0,0,0.18)",
        "rgba(0,0,0,0.12)",
        "rgba(0,0,0,0.075)",
        "rgba(0,0,0,0.04)",
        "rgba(0,0,0,0.016)",
        "rgba(0,0,0,0)"
      ],
      locations: [0, 0.12, 0.28, 0.44, 0.6, 0.78, 1]
    };
  }
  return {
    colors: [
      "rgba(12,18,28,0.14)",
      "rgba(12,18,28,0.1)",
      "rgba(12,18,28,0.068)",
      "rgba(12,18,28,0.042)",
      "rgba(12,18,28,0.024)",
      "rgba(12,18,28,0.01)",
      "rgba(12,18,28,0)"
    ],
    locations: [0, 0.12, 0.28, 0.44, 0.6, 0.78, 1]
  };
}

/** Local reinforcement hugging the floating top nav capsule. */
function navTopLocalStops(isDark: boolean): GradientStops {
  if (isDark) {
    return {
      colors: [
        "rgba(0,0,0,0.2)",
        "rgba(0,0,0,0.14)",
        "rgba(0,0,0,0.09)",
        "rgba(0,0,0,0.055)",
        "rgba(0,0,0,0.028)",
        "rgba(0,0,0,0.01)",
        "rgba(0,0,0,0)"
      ],
      locations: [0, 0.14, 0.32, 0.5, 0.68, 0.84, 1]
    };
  }
  return {
    colors: [
      "rgba(12,18,28,0.11)",
      "rgba(12,18,28,0.078)",
      "rgba(12,18,28,0.05)",
      "rgba(12,18,28,0.03)",
      "rgba(12,18,28,0.016)",
      "rgba(12,18,28,0.006)",
      "rgba(12,18,28,0)"
    ],
    locations: [0, 0.14, 0.32, 0.5, 0.68, 0.84, 1]
  };
}

type Props = {
  /** Safe-area top inset — scrim bleeds from physical screen top through the nav capsule. */
  topInset: number;
  /** 1 = idle; 0 = scrolling — subtle local intensity only. */
  navFocusSV: SharedValue<number>;
  /** Customer home uses the thinner split top row metrics. */
  customerHome?: boolean;
};

/**
 * Fixed top depth field + frosted glass band — mirrors the bottom nav scrim stack.
 * Bleeds from the physical screen top through the floating top nav and fades below.
 */
export function NavTopScrim({ topInset, navFocusSV, customerHome = false }: Props) {
  const { isDark } = useAppTheme();
  const { height: screenH } = useWindowDimensions();

  const topMargin = customerHome ? FLOAT_MARGIN_TOP_HOME : FLOAT_MARGIN_TOP;
  const topBarHeight = customerHome ? FLOATING_HOME_TOP_BAR_HEIGHT : FLOATING_TOP_BAR_HEIGHT;

  const ambientStops = React.useMemo(() => navTopAmbientStops(isDark), [isDark]);
  const localStops = React.useMemo(() => navTopLocalStops(isDark), [isDark]);
  const glassFeather = React.useMemo(() => navGlassGradientFeather(isDark), [isDark]);

  const navChromeBottom = topInset + topMargin + topBarHeight + CONTENT_GAP_BELOW_TOP_NAV;

  const glassBandHeight = navChromeBottom + NAV_GLASS_SCOOP_RADIUS;
  const localHeight = Math.max(180, navChromeBottom + 56);
  const fieldHeight = Math.max(
    localHeight + 140,
    Math.round(screenH * NAV_BOTTOM_AMBIENT_HEIGHT_RATIO)
  );

  const rootStyle = useAnimatedStyle(() => {
    const focus = navFocusSV.value;
    const opacity = interpolate(focus, [0, 1], [1, 0.92], Extrapolation.CLAMP);
    return { opacity };
  });

  const localLayerStyle = useAnimatedStyle(() => {
    const focus = navFocusSV.value;
    const opacity = interpolate(focus, [0, 1], [1, 0.84], Extrapolation.CLAMP);
    return { opacity };
  });

  const fieldLayerStyle = useAnimatedStyle(() => {
    const focus = navFocusSV.value;
    const opacity = interpolate(focus, [0, 1], [1, 0.96], Extrapolation.CLAMP);
    return { opacity };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.anchor, rootStyle]}
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

      <View style={[styles.glassAnchor, { height: glassBandHeight }]} pointerEvents="none">
        <View
          style={[
            styles.glassClip,
            {
              height: navChromeBottom,
              borderBottomLeftRadius: NAV_GLASS_SCOOP_RADIUS,
              borderBottomRightRadius: NAV_GLASS_SCOOP_RADIUS
            }
          ]}
        >
          {Platform.OS === "ios" ? (
            <BlurView
              intensity={NAV_GLASS_BLUR_INTENSITY}
              tint={navGlassBlurTint(isDark)}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: navGlassAndroidFill(isDark) }]} />
          )}
          <LinearGradient
            colors={glassFeather.top}
            locations={[0, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    ...StyleSheet.absoluteFillObject,
    zIndex: NAV_TOP_SCRIM_Z_INDEX,
    elevation: NAV_TOP_SCRIM_Z_INDEX
  },
  layer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0
  },
  glassAnchor: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    overflow: "hidden"
  },
  glassClip: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    overflow: "hidden"
  }
});
