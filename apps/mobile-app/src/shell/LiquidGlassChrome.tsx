import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle
} from "react-native-reanimated";
import Svg, { Defs, FeTurbulence, Rect } from "react-native-svg";
import type { NavDockGlassTokens } from "./navDockGlass";
import { NAV_DOCK_SHELL_BORDER_WIDTH } from "./navDockGlass";

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export type LiquidGlassVariant = "shell" | "pill" | "control";

type Props = {
  tokens: NavDockGlassTokens;
  variant: LiquidGlassVariant;
  borderRadius: number;
  /** Dock scroll-focus (1 = expanded). */
  focusSV?: SharedValue<number>;
  /** Pill drag lift. */
  liftSV?: SharedValue<number>;
  /** Control press / hold (theme toggle). */
  pressSV?: SharedValue<number>;
};

function GlassNoise({ opacity }: { opacity: number }) {
  if (opacity <= 0) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <FeTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" />
        </Defs>
        <Rect width="100%" height="100%" fill="white" opacity={opacity} />
      </Svg>
    </View>
  );
}

/**
 * Layered liquid glass material — blur, refraction, specular, grain.
 * Same stack used behind the appearance theme toggle and the floating dock.
 */
export function LiquidGlassChrome({
  tokens,
  variant,
  borderRadius,
  focusSV,
  liftSV,
  pressSV
}: Props) {
  const isPill = variant === "pill";
  const isControl = variant === "control";

  const isShell = !isPill && !isControl;
  const rimWidth = isShell ? NAV_DOCK_SHELL_BORDER_WIDTH : StyleSheet.hairlineWidth;

  const fill = isPill ? tokens.pillBg : isControl ? tokens.controlBg : tokens.shellBg;
  const border = isPill ? tokens.pillBorder : isControl ? tokens.controlBorder : tokens.shellBorder;
  const refractionTop = isPill
    ? tokens.pillRefractionTop
    : isControl
      ? tokens.controlRefractionTop
      : tokens.shellRefractionTop;
  const innerGlow = isPill ? tokens.pillInnerGlow : tokens.shellInnerGlow;

  const animatedBlurProps = useAnimatedProps(() => {
    const focus = focusSV?.value ?? 1;
    const lift = liftSV?.value ?? 0;
    const press = pressSV?.value ?? 0;
    const base = isPill
      ? tokens.blurIntensityPill
      : isControl
        ? tokens.blurIntensityControl
        : tokens.blurIntensity;
    const focusMul = interpolate(focus, [0, 1], [0.86, 1], Extrapolation.CLAMP);
    const pressMul = interpolate(press, [0, 1], [1, 1.14], Extrapolation.CLAMP);
    const liftMul = interpolate(lift, [0, 1], [1, 1.06], Extrapolation.CLAMP);
    return { intensity: base * focusMul * pressMul * liftMul };
  });

  const pressBloomStyle = useAnimatedStyle(() => {
    const press = pressSV?.value ?? 0;
    return {
      opacity: interpolate(press, [0, 1], [1, 1.08], Extrapolation.CLAMP)
    };
  });

  const blurAndroidProps =
    Platform.OS === "android" ? ({ experimentalBlurMethod: "dimezisBlurView" } as const) : {};

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { borderRadius, overflow: "hidden" }, pressBloomStyle]}
      pointerEvents="none"
    >
      <AnimatedBlurView
        animatedProps={animatedBlurProps}
        tint={tokens.blurTint}
        blurReductionFactor={Platform.OS === "android" ? 3.2 : undefined}
        style={StyleSheet.absoluteFill}
        {...blurAndroidProps}
      />

      <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />

      {isShell ? (
        <>
          <LinearGradient
            colors={tokens.shellRefractionTop}
            locations={[0, 0.42, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          <LinearGradient
            colors={tokens.shellRefractionBottom}
            locations={[0.55, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          <LinearGradient
            colors={tokens.specularStreak}
            locations={[0.2, 0.5, 0.8]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, styles.specular]}
            pointerEvents="none"
          />

          <View
            style={[
              styles.innerGlow,
              {
                backgroundColor: tokens.shellInnerGlow,
                borderRadius: borderRadius * 0.72
              }
            ]}
            pointerEvents="none"
          />

          <GlassNoise opacity={tokens.noiseOpacity} />

          <View
            style={[
              styles.edgeHighlight,
              {
                backgroundColor: tokens.shellEdgeHighlight,
                height: rimWidth,
                left: Math.max(12, borderRadius * 0.28),
                right: Math.max(12, borderRadius * 0.28)
              }
            ]}
            pointerEvents="none"
          />
        </>
      ) : (
        <>
          <LinearGradient
            colors={refractionTop}
            locations={[0, 0.42, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          <LinearGradient
            colors={tokens.shellRefractionBottom}
            locations={[0.55, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          <LinearGradient
            colors={tokens.specularStreak}
            locations={[0.2, 0.5, 0.8]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, styles.specular]}
            pointerEvents="none"
          />

          <View
            style={[
              styles.innerGlow,
              {
                backgroundColor: innerGlow,
                borderRadius: borderRadius * 0.72
              }
            ]}
            pointerEvents="none"
          />

          <GlassNoise opacity={tokens.noiseOpacity} />

          <View
            style={[
              styles.edgeHighlight,
              {
                backgroundColor: tokens.shellEdgeHighlight,
                left: Math.max(12, borderRadius * 0.28),
                right: Math.max(12, borderRadius * 0.28)
              }
            ]}
            pointerEvents="none"
          />
        </>
      )}

      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius,
            borderWidth: rimWidth,
            borderColor: border
          }
        ]}
        pointerEvents="none"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  specular: {
    transform: [{ scaleX: 1.15 }, { scaleY: 0.55 }]
  },
  innerGlow: {
    position: "absolute",
    top: "18%",
    left: "12%",
    right: "12%",
    bottom: "22%",
    opacity: 0.9
  },
  edgeHighlight: {
    position: "absolute",
    top: 0,
    height: StyleSheet.hairlineWidth
  }
});
