import { Dimensions } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import React from "react";
import {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue
} from "react-native-reanimated";

const OPEN_MS = 380;
const CLOSE_MS = 340;
const SCRIM_MAX = 0.26;
const OPEN_EASE = Easing.bezier(0.22, 1, 0.36, 1);
const CLOSE_EASE = Easing.bezier(0.4, 0, 0.6, 1);

type Options = {
  active: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  dismissOnBack: boolean;
  onBackComplete: () => void;
  onNestedBack: () => void;
  onForward: () => void;
};

function finishBack(
  translateX: SharedValue<number>,
  screenW: number,
  onDone: () => void
) {
  translateX.value = withTiming(screenW, { duration: CLOSE_MS, easing: CLOSE_EASE }, (finished) => {
    if (finished) runOnJS(onDone)();
  });
}

export function useProfileSubpageSwipeMotion(options: Options) {
  const screenW = Dimensions.get("window").width;
  const translateX = useSharedValue(screenW);
  const dismissingRef = React.useRef(false);

  const runDismissBack = React.useCallback(() => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    finishBack(translateX, screenW, () => {
      dismissingRef.current = false;
      options.onBackComplete();
    });
  }, [options.onBackComplete, screenW, translateX]);

  const runNestedDismissBack = React.useCallback(() => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    finishBack(translateX, screenW, () => {
      dismissingRef.current = false;
      options.onNestedBack();
    });
  }, [options.onNestedBack, screenW, translateX]);

  const requestBack = React.useCallback(() => {
    if (options.dismissOnBack) {
      runDismissBack();
    } else {
      runNestedDismissBack();
    }
  }, [options.dismissOnBack, runDismissBack, runNestedDismissBack]);

  React.useEffect(() => {
    if (!options.active) {
      translateX.value = screenW;
      dismissingRef.current = false;
      return;
    }
    dismissingRef.current = false;
    translateX.value = screenW;
    translateX.value = withTiming(0, { duration: OPEN_MS, easing: OPEN_EASE });
  }, [options.active, screenW, translateX]);

  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        .enabled(options.canGoBack)
        .activeOffsetX([-12, 12])
        .failOffsetY([-16, 16])
        .onUpdate((e) => {
          const next = Math.max(0, e.translationX);
          translateX.value = next;
        })
        .onEnd((e) => {
          const shouldClose = e.translationX > screenW * 0.26 || e.velocityX > 820;
          if (shouldClose) {
            if (options.dismissOnBack) {
              runOnJS(runDismissBack)();
            } else {
              runOnJS(runNestedDismissBack)();
            }
            return;
          }
          translateX.value = withTiming(0, { duration: 280, easing: OPEN_EASE });
        }),
    [options.canGoBack, options.dismissOnBack, runDismissBack, runNestedDismissBack, screenW, translateX]
  );

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }]
  }));

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, screenW], [SCRIM_MAX, 0], Extrapolation.CLAMP)
  }));

  const underlayStyle = useAnimatedStyle(() => ({
    opacity: 1
  }));

  return {
    pan,
    panelStyle,
    scrimStyle,
    underlayStyle,
    requestBack
  };
}

/** Legacy shim for reservation wizard and other slide-over hosts. */
export function useProfileSubpageMotion(active: boolean) {
  const doneRef = React.useRef<(() => void) | null>(null);

  const onBackComplete = React.useCallback(() => {
    doneRef.current?.();
    doneRef.current = null;
  }, []);

  const { panelStyle, scrimStyle, requestBack } = useProfileSubpageSwipeMotion({
    active,
    canGoBack: true,
    canGoForward: false,
    dismissOnBack: true,
    onBackComplete,
    onNestedBack: onBackComplete,
    onForward: () => {}
  });

  const runClose = React.useCallback(
    (onDone: () => void) => {
      doneRef.current = onDone;
      requestBack();
    },
    [requestBack]
  );

  return {
    motionStyle: panelStyle,
    scrimStyle,
    runClose
  };
}
