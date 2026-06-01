import React from "react";
import { Animated, Easing, Keyboard, Platform, type ScrollView } from "react-native";

const ANDROID_SHOW_MS = 260;
const ANDROID_HIDE_MS = 220;
/** Open the footer gap quicker than the keyboard (feels immediate on `keyboardWillShow`). */
const OPEN_GAP_MS_MIN = 120;
const OPEN_GAP_MS_MAX = 190;
const OPEN_GAP_KB_RATIO = 0.48;
const OPEN_HEAD_START_RATIO = 0.22;

type KeyboardFrameEvent = {
  duration?: number;
  easing?: string;
};

function timingDuration(e: KeyboardFrameEvent | undefined, fallback: number): number {
  const d = e?.duration;
  return typeof d === "number" && d > 0 ? d : fallback;
}

function openGapDuration(e: KeyboardFrameEvent | undefined): number {
  const kb = timingDuration(e, ANDROID_SHOW_MS);
  return Math.min(OPEN_GAP_MS_MAX, Math.max(OPEN_GAP_MS_MIN, Math.round(kb * OPEN_GAP_KB_RATIO)));
}

/**
 * Animates footer spacer below Continue: 0 when keyboard closed, `maxGap` when open.
 * Scrolls the sheet so the footer stays reachable while the keyboard is up.
 */
export function useFooterKeyboardRevealGap(
  maxGap: number,
  enabled: boolean,
  scrollRef: React.RefObject<ScrollView | null>,
  getMaxScrollY: () => number
) {
  const gapAnim = React.useRef(new Animated.Value(0)).current;

  const scrollToBottom = React.useCallback(
    (animated: boolean) => {
      requestAnimationFrame(() => {
        const max = getMaxScrollY();
        if (max <= 0) return;
        scrollRef.current?.scrollTo({ y: max, animated });
      });
    },
    [getMaxScrollY, scrollRef]
  );

  const scrollToRest = React.useCallback(
    (animated: boolean) => {
      requestAnimationFrame(() => {
        const max = getMaxScrollY();
        scrollRef.current?.scrollTo({ y: Math.max(0, max), animated });
      });
    },
    [getMaxScrollY, scrollRef]
  );

  const animateGap = React.useCallback(
    (to: number, duration: number, easing: (value: number) => number, onDone?: () => void) => {
      gapAnim.stopAnimation();
      Animated.timing(gapAnim, {
        toValue: to,
        duration,
        easing,
        useNativeDriver: false
      }).start(({ finished }) => {
        if (finished) onDone?.();
      });
    },
    [gapAnim]
  );

  React.useEffect(() => {
    if (!enabled || maxGap <= 0) {
      gapAnim.setValue(0);
      return;
    }

    const showEv = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEv = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEv, (e: KeyboardFrameEvent) => {
      const ms = openGapDuration(e);
      gapAnim.setValue(maxGap * OPEN_HEAD_START_RATIO);
      scrollToBottom(true);
      animateGap(maxGap, ms, Easing.out(Easing.quad), () => scrollToBottom(true));
    });

    const hideSub = Keyboard.addListener(hideEv, (e: KeyboardFrameEvent) => {
      const ms = timingDuration(e, ANDROID_HIDE_MS);
      animateGap(0, ms, Easing.inOut(Easing.cubic), () => scrollToRest(true));
    });

    return () => {
      gapAnim.setValue(0);
      showSub.remove();
      hideSub.remove();
    };
  }, [enabled, maxGap, gapAnim, animateGap, scrollToBottom, scrollToRest]);

  return gapAnim;
}
