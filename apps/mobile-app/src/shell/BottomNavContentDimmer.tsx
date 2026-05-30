import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { FLOATING_TAB_BAR_HEIGHT, FLOAT_MARGIN_BOTTOM } from "./navBottomMetrics";
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
  bottomInset: number;
};

/**
 * Universal bottom-nav glass — always visible under the floating tab bar on every tab.
 */
export function BottomNavContentDimmer({ bottomInset }: Props) {
  const { isDark } = useAppTheme();

  const zoneHeight = FLOATING_TAB_BAR_HEIGHT + FLOAT_MARGIN_BOTTOM + bottomInset;
  const feather = navGlassGradientFeather(isDark);

  return (
    <View
      pointerEvents="auto"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.anchor, { height: zoneHeight + NAV_GLASS_SCOOP_RADIUS }]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.glassClip,
          {
            height: zoneHeight,
            borderTopLeftRadius: NAV_GLASS_SCOOP_RADIUS,
            borderTopRightRadius: NAV_GLASS_SCOOP_RADIUS
          }
        ]}
      >
        {Platform.OS === "ios" ? (
          <BlurView intensity={NAV_GLASS_BLUR_INTENSITY} tint={navGlassBlurTint(isDark)} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: navGlassAndroidFill(isDark) }]} />
        )}
        <LinearGradient
          colors={feather.bottom}
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
    bottom: 0,
    zIndex: NAV_GLASS_DIMMER_Z_INDEX,
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
