import React from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

const VISIT_PHRASES = ["Plan your visit", "Reserve a table", "Dine in", "Celebrate"] as const;

const COLOR_LIGHT = ["#4C1D95", "#B45309", "#047857", "#0369A1"] as const;

/** Swipe + fade phrase rotation; color only advances when the phrase changes. */
function useRotatingPhrase(phrases: readonly string[], intervalMs = 3000) {
  const [idx, setIdx] = React.useState(0);
  const opacity = React.useRef(new Animated.Value(1)).current;
  const x = React.useRef(new Animated.Value(0)).current;
  const [colorIndex, setColorIndex] = React.useState(0);
  const lastColorByPhrase = React.useRef<Record<string, number>>({});
  const lastGlobalColor = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (phrases.length <= 1) return;
    const timer = setInterval(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.timing(x, { toValue: -22, duration: 320, useNativeDriver: true })
      ]).start(() => {
        setIdx((i) => {
          const nextIdx = (i + 1) % phrases.length;
          const nextText = phrases[nextIdx] ?? "";
          const prev = lastColorByPhrase.current[nextText];
          const gPrev = lastGlobalColor.current;
          const candidates = [0, 1, 2, 3].filter((c) => c !== prev && c !== gPrev);
          const nextColor =
            candidates.length > 0
              ? candidates[nextIdx % candidates.length]!
              : ((gPrev ?? 0) + 1) % 4;
          lastColorByPhrase.current[nextText] = nextColor;
          lastGlobalColor.current = nextColor;
          setColorIndex(nextColor);
          return nextIdx;
        });
        x.setValue(22);
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(x, { toValue: 0, duration: 360, useNativeDriver: true })
        ]).start();
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [phrases, intervalMs, opacity, x]);

  const text = phrases[Math.max(0, Math.min(idx, phrases.length - 1))] ?? "";
  return { text, opacity, x, colorIndex };
}

function ReservationPlanVisitIntroInner() {
  const swap = useRotatingPhrase(VISIT_PHRASES, 3000);
  const phraseColor = COLOR_LIGHT[swap.colorIndex]!;

  return (
    <View style={styles.root} pointerEvents="none">
      <View style={styles.phraseStrip}>
        <Animated.Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[
            styles.phrase,
            {
              opacity: swap.opacity,
              transform: [{ translateX: swap.x }],
              color: phraseColor
            }
          ]}
        >
          {swap.text}
        </Animated.Text>
      </View>
    </View>
  );
}

export const ReservationPlanVisitIntro = React.memo(ReservationPlanVisitIntroInner);

const styles = StyleSheet.create({
  root: {
    paddingVertical: 16,
    marginTop: 4,
    alignItems: "center"
  },
  phraseStrip: {
    minHeight: 40,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginBottom: 10,
    width: "100%"
  },
  phrase: {
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.3,
    textAlign: "center"
  }
});
