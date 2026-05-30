import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { FLOATING_TOP_BAR_HEIGHT, FLOATING_TOP_GAP, FLOATING_TOP_NUDGE } from "./FloatingTopBar";
import {
  NAV_GLASS_BLUR_INTENSITY,
  NAV_GLASS_DIMMER_Z_INDEX,
  NAV_GLASS_SCOOP_RADIUS,
  navGlassAndroidFill,
  navGlassBlurTint,
  navGlassGradientFeather
} from "./navGlassChrome";
import { useAppTheme } from "../theme/AppThemeContext";

type Props = {
  topInset: number;
};

/**
 * Universal top-nav glass — always visible under the floating search capsule on every tab.
 */
export function TopNavContentDimmer({ topInset }: Props) {
  const { isDark } = useAppTheme();

  const glassHeight = topInset + FLOATING_TOP_GAP + FLOATING_TOP_BAR_HEIGHT + FLOATING_TOP_NUDGE;
  const feather = navGlassGradientFeather(isDark);

  return (
    <View
      pointerEvents="box-none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.anchor, { height: glassHeight + NAV_GLASS_SCOOP_RADIUS }]}
    >
      <View
        style={[
          styles.glassClip,
          {
            height: glassHeight,
            borderBottomLeftRadius: NAV_GLASS_SCOOP_RADIUS,
            borderBottomRightRadius: NAV_GLASS_SCOOP_RADIUS
          }
        ]}
        pointerEvents="none"
      >
        {Platform.OS === "ios" ? (
          <BlurView intensity={NAV_GLASS_BLUR_INTENSITY} tint={navGlassBlurTint(isDark)} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: navGlassAndroidFill(isDark) }]} />
        )}
        <LinearGradient
          colors={feather.top}
          locations={[0, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: NAV_GLASS_DIMMER_Z_INDEX,
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
