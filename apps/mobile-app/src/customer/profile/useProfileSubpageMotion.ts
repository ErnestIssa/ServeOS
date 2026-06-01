import React from "react";
import { Animated, Dimensions, Easing } from "react-native";

const OPEN_MS = 320;
const CLOSE_MS = 300;

export function useProfileSubpageMotion(active: boolean) {
  const screenW = Dimensions.get("window").width;
  const slideX = React.useRef(new Animated.Value(screenW)).current;
  const scrim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!active) {
      slideX.setValue(screenW);
      scrim.setValue(0);
      return;
    }
    slideX.setValue(screenW);
    scrim.setValue(0);
    Animated.parallel([
      Animated.timing(slideX, {
        toValue: 0,
        duration: OPEN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(scrim, {
        toValue: 1,
        duration: OPEN_MS - 40,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      })
    ]).start();
  }, [active, screenW, scrim, slideX]);

  const runClose = React.useCallback(
    (onDone: () => void) => {
      Animated.parallel([
        Animated.timing(slideX, {
          toValue: screenW,
          duration: CLOSE_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(scrim, {
          toValue: 0,
          duration: CLOSE_MS - 40,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true
        })
      ]).start(({ finished }) => {
        if (!finished) return;
        onDone();
      });
    },
    [screenW, scrim, slideX]
  );

  const motionStyle = React.useMemo(
    () => ({
      flex: 1,
      transform: [{ translateX: slideX }]
    }),
    [slideX]
  );

  const scrimStyle = React.useMemo(
    () => ({
      opacity: scrim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.22]
      })
    }),
    [scrim]
  );

  return { motionStyle, scrimStyle, runClose };
}
