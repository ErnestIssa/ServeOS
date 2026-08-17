import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

const BAR_COUNT = 24;

type Props = {
  active: boolean;
  level?: number;
  color?: string;
};

export function VoiceWaveform({ active, level = 0.3, color = "#175F61" }: Props) {
  const bars = useRef(Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.25))).current;
  const tick = useRef(0);

  useEffect(() => {
    if (!active) {
      bars.forEach((bar) => bar.setValue(0.2));
      return;
    }

    const id = setInterval(() => {
      tick.current += 1;
      bars.forEach((bar, i) => {
        const wave = Math.sin(tick.current * 0.35 + i * 0.55);
        const jitter = Math.random() * 0.35;
        const target = Math.max(0.15, Math.min(1, level * 0.85 + wave * 0.2 + jitter * level));
        Animated.timing(bar, {
          toValue: target,
          duration: 90,
          useNativeDriver: false
        }).start();
      });
    }, 90);

    return () => clearInterval(id);
  }, [active, level, bars]);

  return (
    <View style={styles.root}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            {
              backgroundColor: color,
              height: bar.interpolate({
                inputRange: [0, 1],
                outputRange: [4, 28]
              })
            }
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    height: 32,
    paddingHorizontal: 4
  },
  bar: {
    width: 3,
    borderRadius: 2,
    minHeight: 4
  }
});
