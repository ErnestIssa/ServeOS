import * as Haptics from "expo-haptics";
import React from "react";
import { LayoutChangeEvent, Platform, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming
} from "react-native-reanimated";
import { R } from "../theme";

/** Matches `ReservationConfirmationScreen` manage CTA (`minHeight: 64`, `borderRadius: 20`). */
const RAIL_MIN_HEIGHT = 64;
const RAIL_RADIUS = 20;
const THUMB_MARGIN = 5;
const THUMB_SIZE = RAIL_MIN_HEIGHT - THUMB_MARGIN * 2;
const COMMIT_FRAC = 0.72;
const SPRING_SLIDE = { damping: 19, stiffness: 460, mass: 0.52 };
const SPRING_BACK = { damping: 22, stiffness: 400, mass: 0.48 };

type Props = {
  disabled: boolean;
  placing: boolean;
  label: string;
  onCommit: () => void;
};

export function SwipePlaceOrderBar({ disabled, placing, label, onCommit }: Props) {
  const railWidth = useSharedValue(0);
  const translateX = useSharedValue(0);
  const dragStartX = useSharedValue(0);
  const endBump = useSharedValue(0);
  const chevPulse = useSharedValue(0);
  const placingBgPhase = useSharedValue(0);

  const onRailLayout = React.useCallback(
    (e: LayoutChangeEvent) => {
      railWidth.value = e.nativeEvent.layout.width;
    },
    [railWidth]
  );

  React.useEffect(() => {
    chevPulse.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.linear }),
      -1,
      false
    );
  }, [chevPulse]);

  React.useEffect(() => {
    if (!placing) {
      placingBgPhase.value = 0;
      return;
    }
    placingBgPhase.value = withRepeat(
      withTiming(4, { duration: 1920, easing: Easing.linear }),
      -1,
      false
    );
  }, [placing, placingBgPhase]);

  React.useEffect(() => {
    if (!placing) {
      translateX.value = withSpring(0, SPRING_BACK);
    }
  }, [placing, translateX]);

  const fireCommit = React.useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onCommit();
  }, [onCommit]);

  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled && !placing)
        .activeOffsetX([-10, 10])
        .failOffsetY([-20, 20])
        .onBegin(() => {
          dragStartX.value = translateX.value;
        })
        .onUpdate((e) => {
          const m = Math.max(0, railWidth.value - THUMB_SIZE - THUMB_MARGIN * 2);
          const next = dragStartX.value + e.translationX;
          translateX.value = Math.min(m, Math.max(0, next));
        })
        .onEnd(() => {
          const m = Math.max(0, railWidth.value - THUMB_SIZE - THUMB_MARGIN * 2);
          if (m <= 1) return;
          if (translateX.value >= m * COMMIT_FRAC) {
            translateX.value = withSpring(m, { ...SPRING_SLIDE, stiffness: 540 }, (finished) => {
              if (!finished) return;
              endBump.value = withSequence(withTiming(1, { duration: 100 }), withTiming(0, { duration: 260 }));
              runOnJS(fireCommit)();
            });
          } else {
            translateX.value = withSpring(0, SPRING_BACK);
          }
        }),
    [disabled, placing, dragStartX, endBump, fireCommit, railWidth, translateX]
  );

  const railBumpStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(endBump.value, [0, 1], [1, 1.018], Extrapolation.CLAMP) }]
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }]
  }));

  const trackFillStyle = useAnimatedStyle(() => {
    const m = Math.max(1, railWidth.value - THUMB_SIZE - THUMB_MARGIN * 2);
    const p = translateX.value / m;
    return {
      opacity: 0.08 + p * 0.22
    };
  });

  const labelFadeStyle = useAnimatedStyle(() => {
    const m = Math.max(1, railWidth.value - THUMB_SIZE - THUMB_MARGIN * 2);
    const p = translateX.value / m;
    return {
      opacity: interpolate(p, [0, 0.2, 0.55, 0.92, 1], [1, 0.85, 0.45, 0.08, 0], Extrapolation.CLAMP)
    };
  });

  const chev0Style = useAnimatedStyle(() => {
    const t = chevPulse.value * Math.PI * 2;
    const wave = (Math.sin(t) + 1) * 0.5;
    return {
      opacity: 0.42 + wave * 0.58,
      transform: [{ scale: 0.92 + wave * 0.12 }]
    };
  });

  const chev1Style = useAnimatedStyle(() => {
    const t = chevPulse.value * Math.PI * 2 + 1.15;
    const wave = (Math.sin(t) + 1) * 0.5;
    return {
      opacity: 0.42 + wave * 0.58,
      transform: [{ scale: 0.92 + wave * 0.12 }]
    };
  });

  const chev2Style = useAnimatedStyle(() => {
    const t = chevPulse.value * Math.PI * 2 + 2.3;
    const wave = (Math.sin(t) + 1) * 0.5;
    return {
      opacity: 0.42 + wave * 0.58,
      transform: [{ scale: 0.92 + wave * 0.12 }]
    };
  });

  const placingRailBgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      placingBgPhase.value,
      [0, 1, 2, 3, 4],
      ["#8B5CF6", "#7C3AED", "#6366F1", "#A855F7", "#8B5CF6"]
    )
  }));

  if (placing) {
    return (
      <Animated.View
        style={[styles.rail, styles.railLoading, placingRailBgStyle, { borderRadius: RAIL_RADIUS }]}
        accessibilityRole="progressbar"
        accessibilityLabel="Placing order"
      >
        <Text style={styles.placingLabel}>Placing order…</Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[railBumpStyle]}>
      <GestureDetector gesture={pan}>
        <View style={[styles.rail, disabled && styles.railDisabled]} onLayout={onRailLayout}>
          <Animated.View pointerEvents="none" style={[styles.trackFill, trackFillStyle]} />
          <Animated.Text style={[styles.railLabel, labelFadeStyle]} pointerEvents="none" numberOfLines={1}>
            {label}
          </Animated.Text>
          <Animated.View style={[styles.thumb, thumbStyle]} accessibilityRole="adjustable" accessibilityLabel="Swipe right to place order">
            <View style={styles.chevronRow}>
              <Animated.Text style={[styles.chevronChar, chev0Style]} allowFontScaling={false}>
                ›
              </Animated.Text>
              <Animated.Text style={[styles.chevronChar, chev1Style]} allowFontScaling={false}>
                ›
              </Animated.Text>
              <Animated.Text style={[styles.chevronChar, chev2Style]} allowFontScaling={false}>
                ›
              </Animated.Text>
            </View>
          </Animated.View>
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rail: {
    height: RAIL_MIN_HEIGHT,
    minHeight: RAIL_MIN_HEIGHT,
    borderRadius: RAIL_RADIUS,
    backgroundColor: R.accentPurple,
    justifyContent: "center",
    overflow: "visible",
    ...Platform.select({
      ios: { shadowColor: "#0f172a", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 14 },
      android: { elevation: 6 },
      default: {}
    })
  },
  railDisabled: { opacity: 0.42 },
  railLoading: {
    alignItems: "center",
    justifyContent: "center"
  },
  placingLabel: {
    color: "rgba(255,255,255,0.96)",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.2
  },
  trackFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RAIL_RADIUS,
    backgroundColor: "rgba(255,255,255,0.38)"
  },
  railLabel: {
    alignSelf: "center",
    paddingHorizontal: THUMB_SIZE + THUMB_MARGIN * 2 + 8,
    color: "rgba(255,255,255,0.98)",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.1
  },
  thumb: {
    position: "absolute",
    left: THUMB_MARGIN,
    top: THUMB_MARGIN,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(124,58,237,0.35)",
    shadowColor: "#4c1d95",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3
  },
  chevronRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible"
  },
  chevronChar: {
    fontSize: 28,
    fontWeight: "900",
    color: R.accentPurple,
    lineHeight: 32,
    includeFontPadding: false,
    marginHorizontal: 1,
    textAlignVertical: "center"
  }
});
