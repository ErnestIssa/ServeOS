import {
  ambientNativeMeshGradient,
  ambientNativePalettes,
  type AmbientNativeTab
} from "@serveos/core-ambient/themes";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useAppTheme } from "../theme/AppThemeContext";

type Props = {
  tab: AmbientNativeTab;
  scrollY: Animated.Value;
};

/**
 * Multi-stop vertical mesh (light → deep, top → bottom). Scroll deepens the whole
 * surface uniformly — no patchy blobs or hard midpoint bands.
 */
export function ScrollMeshBackground({ tab, scrollY }: Props) {
  const { isDark, colors: theme } = useAppTheme();
  const ambient = ambientNativePalettes[tab];
  const top = isDark ? theme.meshTop : ambient.top;
  const bottom = isDark ? theme.meshBottom : ambient.bottom;

  const mesh = React.useMemo(
    () => ambientNativeMeshGradient(top, bottom),
    [top, bottom]
  );

  const scrollDepth = scrollY.interpolate({
    inputRange: [0, 120, 480],
    outputRange: [0, isDark ? 0.04 : 0.06, isDark ? 0.12 : 0.2],
    extrapolate: "clamp"
  });

  const overlayColor = isDark ? "#020617" : "#0f172a";

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 0 }]} pointerEvents="none">
      <LinearGradient
        colors={mesh.colors as [string, string, ...string[]]}
        locations={mesh.locations as [number, number, ...number[]]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: overlayColor,
            opacity: scrollDepth
          }
        ]}
      />
    </View>
  );
}
