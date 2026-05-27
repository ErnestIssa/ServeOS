import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from "react-native-reanimated";

const DOT = 10;
const GAP = 10;
const WIDTH = DOT * 3 + GAP * 2;
const CYCLE_MS = 1000;

type Props = {
  color?: string;
};

function useDotPhase(offsetMs: number) {
  const phase = useSharedValue(0);

  React.useEffect(() => {
    const run = () => {
      phase.value = withRepeat(
        withSequence(
          withTiming(0, { duration: offsetMs }),
          withTiming(0, { duration: CYCLE_MS * 0.2 }),
          withTiming(1, { duration: CYCLE_MS * 0.2, easing: Easing.linear }),
          withTiming(0.5, { duration: CYCLE_MS * 0.2, easing: Easing.linear }),
          withTiming(0, { duration: CYCLE_MS * 0.4, easing: Easing.linear })
        ),
        -1,
        false
      );
    };
    run();
  }, [offsetMs, phase]);

  return useAnimatedStyle(() => {
    const t = phase.value;
    const y = t <= 0.5 ? -7 * (t / 0.5) : -7 * (1 - (t - 0.5) / 0.5);
    const scale = t <= 0.5 ? 1 + 0.14 * (t / 0.5) : 1 + 0.14 * (1 - (t - 0.5) / 0.5);
    return {
      transform: [{ translateY: y }, { scale }]
    };
  });
}

/** Three-dot loader inspired by CSS `l3` — replaces button label while loading. */
export function ReservationThreeDotLoader({ color = "#FFFFFF" }: Props) {
  const s0 = useDotPhase(0);
  const s1 = useDotPhase(Math.round(CYCLE_MS * 0.2));
  const s2 = useDotPhase(Math.round(CYCLE_MS * 0.4));

  return (
    <View style={styles.row} accessibilityLabel="Loading">
      <Animated.View style={[styles.dot, { backgroundColor: color }, s0]} />
      <Animated.View style={[styles.dot, { backgroundColor: color }, s1]} />
      <Animated.View style={[styles.dot, { backgroundColor: color }, s2]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: WIDTH,
    height: DOT * 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2
  }
});
