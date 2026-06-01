import * as Haptics from "expo-haptics";
import React from "react";
import { Animated } from "react-native";
import {
  REVIEW_CLOSE_FADE_MS,
  REVIEW_CLOSE_Y_MS,
  REVIEW_CLOSE_Y_TO,
  REVIEW_OPEN_FADE_MS,
  REVIEW_OPEN_Y_FROM,
  REVIEW_OPEN_Y_MS
} from "../profile/profileReviewTransition";

/** Account-creation wizard card enter/exit (`AuthFlowScreen` openWizard / closeWizard). */
export function useReservationWizardMotion(presentationActive: boolean, enterScrollToken?: number) {
  const fade = React.useRef(new Animated.Value(0)).current;
  const y = React.useRef(new Animated.Value(REVIEW_OPEN_Y_FROM)).current;
  const exitInFlightRef = React.useRef(false);

  const runOpen = React.useCallback(() => {
    exitInFlightRef.current = false;
    fade.setValue(0);
    y.setValue(REVIEW_OPEN_Y_FROM);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: REVIEW_OPEN_FADE_MS, useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: REVIEW_OPEN_Y_MS, useNativeDriver: true })
    ]).start();
  }, [fade, y]);

  const runClose = React.useCallback(
    (onDone: () => void) => {
      if (exitInFlightRef.current) return;
      exitInFlightRef.current = true;
      Animated.parallel([
        Animated.timing(fade, { toValue: 0, duration: REVIEW_CLOSE_FADE_MS, useNativeDriver: true }),
        Animated.timing(y, { toValue: REVIEW_CLOSE_Y_TO, duration: REVIEW_CLOSE_Y_MS, useNativeDriver: true })
      ]).start(({ finished }) => {
        if (!finished) return;
        exitInFlightRef.current = false;
        onDone();
      });
    },
    [fade, y]
  );

  React.useEffect(() => {
    if (!presentationActive) {
      fade.setValue(0);
      y.setValue(REVIEW_OPEN_Y_FROM);
      exitInFlightRef.current = false;
      return;
    }
    void Haptics.selectionAsync();
    runOpen();
  }, [presentationActive, enterScrollToken, fade, runOpen, y]);

  const cardMotionStyle = React.useMemo(
    () => ({
      opacity: fade,
      transform: [{ translateY: y }]
    }),
    [fade, y]
  );

  return { cardMotionStyle, runClose };
}
