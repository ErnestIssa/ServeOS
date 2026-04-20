import React from "react";
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import Svg, { Path } from "react-native-svg";

const { width: SCREEN_W } = Dimensions.get("window");

export type ServeOSBrandScreenNativeProps = {
  /** Host app finished bootstrapping; splash dismisses only when this is true and the sequence + hold finished. */
  appReady: boolean;
  /** Fired once when both the animation (once) + 2s hold completed and `appReady` is true. */
  onDismiss: () => void;
};

// Timeline aligned with previous loop version: 1s static S, 2.6s build, 2s hold — then done (no loop).
const INITIAL_DELAY_MS = 1000;
const BUILD_DURATION_MS = 2600;
const HOLD_MS = 2000;

/** Last letter (“S”) fully in — same window as `lastS` opacity reaching 1 */
const WORD_COMPLETE_T = 0.28 + 0.06 * 5 + 0.16;

export function ServeOSBrandScreenNative({ appReady, onDismiss }: ServeOSBrandScreenNativeProps) {
  const [rowWidth, setRowWidth] = React.useState(0);
  const [sWidth, setSWidth] = React.useState(0);

  const progress = React.useRef(new Animated.Value(0)).current;
  const [sequenceDone, setSequenceDone] = React.useState(false);
  const dismissed = React.useRef(false);
  const wordHapticFired = React.useRef(false);

  const letterSize = React.useMemo(() => {
    const base = Math.round(Math.min(84, Math.max(36, SCREEN_W * 0.14)));
    return { fontSize: base, lineHeight: base };
  }, []);

  const iconSize = React.useMemo(() => Math.round(Math.min(45, Math.max(22, SCREEN_W * 0.1))), []);

  React.useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    setSequenceDone(false);
    dismissed.current = false;
    wordHapticFired.current = false;

    // Fire once when the splash starts (initial "S" appears).
    void Haptics.selectionAsync();

    const anim = Animated.sequence([
      Animated.delay(INITIAL_DELAY_MS),
      Animated.timing(progress, {
        toValue: 1,
        duration: BUILD_DURATION_MS,
        easing: Easing.linear,
        useNativeDriver: true
      }),
      Animated.delay(HOLD_MS)
    ]);

    anim.start(({ finished }) => {
      if (finished) setSequenceDone(true);
    });

    return () => {
      anim.stop();
    };
  }, [progress]);

  React.useEffect(() => {
    const id = progress.addListener(({ value }) => {
      if (wordHapticFired.current) return;
      if (value < WORD_COMPLETE_T) return;
      wordHapticFired.current = true;
      void Haptics.selectionAsync();
    });
    return () => {
      progress.removeListener(id);
    };
  }, [progress]);

  React.useEffect(() => {
    if (sequenceDone && appReady && !dismissed.current) {
      dismissed.current = true;
      onDismiss();
    }
  }, [sequenceDone, appReady, onDismiss]);

  const startX = -sWidth / 2;
  const endX = -rowWidth / 2;
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [startX, endX]
  });

  const stageScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.99]
  });

  const letterWindow = (t0: number) => {
    const inStart = t0;
    const inEnd = t0 + 0.16;
    return progress.interpolate({
      inputRange: [0, inStart, inEnd, 1],
      outputRange: [0, 0, 1, 1]
    });
  };

  const tDelay = 0.28;
  const tStep = 0.06;

  const sIn = 1;
  const E1 = letterWindow(tDelay + tStep * 0);
  const R = letterWindow(tDelay + tStep * 1);
  const V = letterWindow(tDelay + tStep * 2);
  const E2 = letterWindow(tDelay + tStep * 3);
  const O = letterWindow(tDelay + tStep * 4);
  const lastS = letterWindow(tDelay + tStep * 5);

  const slide = (alpha: Animated.AnimatedInterpolation<number>) =>
    alpha.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });

  const oPulse = progress.interpolate({
    inputRange: [tDelay + tStep * 4, tDelay + tStep * 4 + 0.1, tDelay + tStep * 4 + 0.24, 1],
    outputRange: [0, 1, 0, 0]
  });
  const oScale = oPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const oShadow = oPulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] });

  return (
    <View style={styles.stage} accessibilityLabel="ServeOS brand screen">
      <View style={styles.measure} pointerEvents="none">
        <Text onLayout={(e) => setSWidth(e.nativeEvent.layout.width)} style={[styles.letter, letterSize]}>
          S
        </Text>
      </View>
      <Animated.View
        style={[
          styles.centerAnchor,
          {
            transform: [{ translateX }, { scale: stageScale }]
          }
        ]}
        onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}
        accessibilityRole="header"
        accessibilityLabel="SERVEOS"
      >
        <Animated.Text style={[styles.letter, letterSize, { opacity: sIn }]}>S</Animated.Text>

        <Animated.Text style={[styles.letter, letterSize, { opacity: E1, transform: [{ translateX: slide(E1) }] }]}>
          E
        </Animated.Text>
        <Animated.Text style={[styles.letter, letterSize, { opacity: R, transform: [{ translateX: slide(R) }] }]}>
          R
        </Animated.Text>
        <Animated.Text style={[styles.letter, letterSize, { opacity: V, transform: [{ translateX: slide(V) }] }]}>
          V
        </Animated.Text>
        <Animated.Text style={[styles.letter, letterSize, { opacity: E2, transform: [{ translateX: slide(E2) }] }]}>
          E
        </Animated.Text>

        <Animated.View
          style={[
            styles.iconWrap,
            { width: iconSize, height: iconSize, marginHorizontal: Math.round(iconSize * 0.18) },
            {
              opacity: O,
              transform: [{ translateX: slide(O) }, { translateY: -3 }, { scale: oScale }]
            },
            {
              shadowColor: "#3B82F6",
              shadowOpacity: oShadow as unknown as number,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 0 }
            }
          ]}
          accessibilityLabel="O"
        >
          <Svg viewBox="0 0 380.721 380.721" width="100%" height="100%">
            <Path
              fill="#FFFFFF"
              d="M190.372,29.813c-88.673,0-160.546,71.873-160.546,160.547c0,65.89,39.73,122.438,96.504,147.173l2.092-40.525 c0-32.242-23.83-21.912-23.83-44.465c0-12.641,0.395-38.98,0.395-58.755c0-52.697,22.377-103.673,27.874-115.048 c5.53-11.363,18.537-23.76,18.677-11.828c0,17.312,0.738,218.618,0.738,218.618h-0.035l2.463,61.241 c11.497,2.626,23.395,4.125,35.669,4.125c6.728,0,13.304-0.546,19.822-1.349l5.31-102.906 c-13.106-2.869-24.283-11.212-31.295-21.68c-8.685-13.014,6.675-128.067,6.675-128.067h10.004v107.978h9.922V96.894h10.84v107.978 h9.889V96.894h11.258v107.978h9.911V96.894h7.668c0,0,15.349,115.054,6.669,128.067c-6.947,10.363-18.009,18.682-30.952,21.633 c-0.232,0.07-0.441,0.163-0.441,0.163l5.02,95.993c63.995-21.11,110.249-81.307,110.249-152.39 C350.907,101.687,279.034,29.813,190.372,29.813z"
            />
            <Path
              fill="#FFFFFF"
              d="M190.372,0C85.415,0,0,85.397,0,190.36C0,295.3,85.415,380.721,190.372,380.721c104.952,0,190.35-85.421,190.35-190.361 C380.721,85.397,295.324,0,190.372,0z M190.372,366.523c-97.144,0-176.18-79.03-176.18-176.163 c0-97.144,79.036-176.18,176.18-176.18c97.133,0,176.175,79.036,176.175,176.18C366.546,287.493,287.504,366.523,190.372,366.523z"
            />
          </Svg>
        </Animated.View>

        <Animated.Text style={[styles.letter, letterSize, { opacity: lastS, transform: [{ translateX: slide(lastS) }] }]}>
          S
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    backgroundColor: "#8B5CF6",
    alignItems: "center",
    justifyContent: "center"
  },
  measure: {
    position: "absolute",
    opacity: 0,
    left: -9999,
    top: -9999
  },
  centerAnchor: {
    position: "absolute",
    left: "50%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center"
  },
  letter: {
    fontWeight: "900",
    letterSpacing: -1.4,
    color: "#FFFFFF"
  },
  iconWrap: {
    justifyContent: "center",
    alignItems: "center"
  }
});
