import React from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { R } from "../theme";

// Keep palette aligned with AuthFlowScreen loader mood.
const SWAP: readonly string[] = ["#8B5CF6", "#F59E0B", "#10B981", "#0EA5E9"];
const LOADER_SWAP_DIM: readonly string[] = [
  "rgba(255,255,255,0.28)",
  "rgba(253,230,138,0.42)",
  "rgba(167,243,208,0.42)",
  "rgba(186,230,253,0.42)"
];

function swapColor(i: number): string {
  return SWAP[i % SWAP.length] ?? SWAP[0]!;
}

export function SwapColorSpinner({ size = 18, stroke = 3 }: { size?: number; stroke?: number }) {
  const idxRef = React.useRef(0);
  const [, tick] = React.useState(0);
  const rot = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rot, { toValue: 1, duration: 720, easing: Easing.linear, useNativeDriver: true }),
      { resetBeforeIteration: true }
    );
    loop.start();
    const t = setInterval(() => {
      idxRef.current = (idxRef.current + 1) % 4;
      tick((x) => x + 1);
    }, 520);
    return () => {
      loop.stop();
      clearInterval(t);
    };
  }, [rot]);

  const i = idxRef.current;
  const deg = rot.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: stroke,
        borderColor: LOADER_SWAP_DIM[i] ?? LOADER_SWAP_DIM[0],
        borderTopColor: swapColor(i),
        borderRightColor: swapColor(i),
        transform: [{ rotate: deg }]
      }}
    />
  );
}

export function SwapColorFullscreenLoader({
  hint,
  sub
}: {
  hint: string;
  sub?: string | null;
}) {
  return (
    <View style={styles.full}>
      <Text style={styles.hint}>{hint}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      <View style={{ height: 18 }} />
      <SwapColorSpinner size={52} stroke={5} />
    </View>
  );
}

const styles = StyleSheet.create({
  full: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: R.accentPurple
  },
  hint: { color: "rgba(255,255,255,0.94)", fontSize: 16, fontWeight: "900", letterSpacing: -0.2 },
  sub: { marginTop: 8, color: "rgba(255,255,255,0.84)", fontSize: 13, fontWeight: "700", textAlign: "center" }
});

