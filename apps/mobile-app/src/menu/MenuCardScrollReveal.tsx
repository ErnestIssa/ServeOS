import { useEffect } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

/** Slightly longer + smooth ease-out so motion feels gradual, not abrupt */
const DURATION_MS = 520;
const TRANSLATE_FROM = 26;
/** Softer landing than cubic-out alone */
const ENTRANCE_EASING = Easing.bezier(0.33, 0.86, 0.56, 1);

type Props = {
  /** When set (stagger delay in ms), fades up once; undefined = idle at opacity 0 until viewport */
  delayMs: number | undefined;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

/**
 * Scroll-triggered fade-up: opacity 0→1, translateY →0 (transform only, no layout jump).
 */
export function MenuCardScrollReveal({ delayMs, style, children }: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (delayMs !== undefined) {
      progress.value = 0;
      progress.value = withDelay(delayMs, withTiming(1, { duration: DURATION_MS, easing: ENTRANCE_EASING }));
      return;
    }
    /**
     * If viewability hasn't assigned stagger yet (nested lists / RN timing), fade in shortly so taps and
     * prices are never stranded at opacity 0.
     */
    progress.value = 0;
    const t = setTimeout(() => {
      progress.value = withTiming(1, { duration: 280, easing: ENTRANCE_EASING });
    }, 560);
    return () => clearTimeout(t);
  }, [delayMs]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [TRANSLATE_FROM, 0]) }]
  }));

  return (
    <Animated.View style={[style, animatedStyle]} collapsable={false}>
      {children}
    </Animated.View>
  );
}
