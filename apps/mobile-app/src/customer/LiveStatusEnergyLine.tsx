import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from "react-native-reanimated";
import { R } from "../theme";

const TRACK_H = 6;
const WRAP_H = 28;
const SWEEP_W = 56;
const FILL_GREEN = "#22C55E";

type Props = {
  /** 0–1 progress within this status phase only. */
  progress: number;
  active: boolean;
  /** Short phase time e.g. `17 mins` — null hides label (completed step). */
  stepTimeLabel: string | null;
};

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function LiveStatusEnergyLine(props: Props) {
  const { active, stepTimeLabel } = props;
  const progress = clamp01(props.progress);
  const [barW, setBarW] = React.useState(0);

  const progressSV = useSharedValue(progress);
  const sweep = useSharedValue(0);

  React.useEffect(() => {
    progressSV.value = withTiming(progress, { duration: 520, easing: Easing.out(Easing.cubic) });
  }, [progress, progressSV]);

  React.useEffect(() => {
    if (!active) {
      sweep.value = 0;
      return;
    }
    sweep.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.linear }), -1, false);
  }, [active, sweep]);

  const fillClipStyle = useAnimatedStyle(() => ({
    width: Math.max(0, barW * progressSV.value)
  }));

  const sweepStyle = useAnimatedStyle(() => {
    const w = barW > 0 ? barW : 1;
    const start = -SWEEP_W;
    const end = w;
    return {
      transform: [{ translateX: start + (end - start) * sweep.value }],
      opacity: active ? 0.95 : 0.4
    };
  });

  const a11y =
    stepTimeLabel != null
      ? `This step about ${stepTimeLabel} remaining`
      : progress >= 1
        ? "This step complete"
        : "Order step progress";

  return (
    <View style={styles.wrap} onLayout={(e) => setBarW(e.nativeEvent.layout.width)} accessibilityLabel={a11y}>
      <View style={styles.track}>
        <View style={styles.trackBase} />
        <Animated.View style={[styles.fillClip, fillClipStyle]}>
          <View style={styles.fillSolid} />
        </Animated.View>
        <Animated.View style={[styles.sweep, sweepStyle]} pointerEvents="none">
          <LinearGradient
            colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.55)", "rgba(255,255,255,1)", "rgba(255,255,255,0.55)", "rgba(255,255,255,0)"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.sweepGradient}
          />
        </Animated.View>
      </View>

      {stepTimeLabel ? <Text style={styles.stepTimeLabel}>{stepTimeLabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    height: WRAP_H,
    justifyContent: "center",
    marginTop: 2
  },
  track: {
    position: "absolute",
    left: 0,
    right: 0,
    top: (WRAP_H - TRACK_H) / 2,
    height: TRACK_H,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.28)"
  },
  trackBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    borderRadius: 999
  },
  fillClip: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    overflow: "hidden",
    minWidth: 0
  },
  fillSolid: {
    flex: 1,
    backgroundColor: FILL_GREEN,
    borderRadius: 999
  },
  sweep: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: SWEEP_W,
    justifyContent: "center"
  },
  sweepGradient: {
    width: SWEEP_W,
    height: TRACK_H,
    borderRadius: 999
  },
  stepTimeLabel: {
    position: "absolute",
    right: 0,
    top: -2,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2,
    color: R.accentBlue,
    fontVariant: ["tabular-nums"]
  }
});
