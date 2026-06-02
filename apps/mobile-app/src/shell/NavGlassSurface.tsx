import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useAppTheme } from "../theme/AppThemeContext";
import {
  NAV_GLASS_BLUR_INTENSITY,
  NAV_GLASS_SCOOP_RADIUS,
  navGlassAndroidFill,
  navGlassBlurTint,
  navGlassGradientFeather
} from "./navGlassChrome";

export type NavGlassFeather = "top" | "bottom" | "both" | "none";

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
  feather?: NavGlassFeather;
};

/**
 * Same frosted glass as `TopNavContentDimmer` / `BottomNavContentDimmer` — blur + nav feather, no tint border.
 */
export function NavGlassSurface({
  children,
  style,
  borderRadius = NAV_GLASS_SCOOP_RADIUS,
  feather = "top"
}: Props) {
  const { isDark } = useAppTheme();
  const gradients = navGlassGradientFeather(isDark);

  return (
    <View style={[{ overflow: "hidden", borderRadius }, style]}>
      {Platform.OS === "ios" ? (
        <BlurView
          intensity={NAV_GLASS_BLUR_INTENSITY}
          tint={navGlassBlurTint(isDark)}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: navGlassAndroidFill(isDark) }]} />
      )}
      {feather === "top" || feather === "both" ? (
        <LinearGradient
          colors={gradients.top}
          locations={[0, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      {feather === "bottom" || feather === "both" ? (
        <LinearGradient
          colors={gradients.bottom}
          locations={[0, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      {children ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    minHeight: 0
  }
});
