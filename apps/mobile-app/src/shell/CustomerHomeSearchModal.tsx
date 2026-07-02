import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { BackHandler, Platform, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NAV_BOTTOM_DOCK_SHELL_BG } from "./navDockGlass";
import { experienceStyleSheetModalHeight } from "./navBottomMetrics";

const OPEN_MS = 600;
const CLOSE_MS = 540;
const DISMISS_DRAG_FRAC = 0.2;
const DISMISS_VELOCITY = 680;
const MODAL_Z_INDEX = 31;
const PANEL_TOP_RADIUS = 30;

type Props = {
  visible: boolean;
  onDismiss: () => void;
  /** Fires once the open animation has fully settled. */
  onOpened?: () => void;
  onClosed?: () => void;
  /** 0 = collapsed, 1 = fully open — drives top search chip motion. */
  searchOpenSV: SharedValue<number>;
  onDismissKeyboard?: () => void;
  children: React.ReactNode;
};

export function CustomerHomeSearchModal({
  visible,
  onDismiss,
  onOpened,
  onClosed,
  searchOpenSV,
  onDismissKeyboard,
  children
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();

  const modalHeight = experienceStyleSheetModalHeight(screenH, insets.top);

  const [mounted, setMounted] = React.useState(visible);
  const openProgress = useSharedValue(0);
  const dragOffsetSV = useSharedValue(0);
  const dragStartOffsetSV = useSharedValue(0);
  const modalHeightSV = useSharedValue(modalHeight);

  React.useLayoutEffect(() => {
    modalHeightSV.value = modalHeight;
  }, [modalHeight, modalHeightSV]);

  const finishClose = React.useCallback(() => {
    setMounted(false);
    dragOffsetSV.value = 0;
    onClosed?.();
  }, [dragOffsetSV, onClosed]);

  const notifyOpened = React.useCallback(() => {
    onOpened?.();
  }, [onOpened]);

  const requestDismissFromDrag = React.useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  React.useEffect(() => {
    if (visible) {
      setMounted(true);
      dragOffsetSV.value = 0;
      openProgress.value = withTiming(
        1,
        { duration: OPEN_MS, easing: Easing.bezier(0.22, 1, 0.36, 1) },
        (finished) => {
          if (finished) runOnJS(notifyOpened)();
        }
      );
      searchOpenSV.value = withTiming(1, {
        duration: OPEN_MS,
        easing: Easing.bezier(0.22, 1, 0.36, 1)
      });
      return;
    }
    if (!mounted) return;
    dragOffsetSV.value = withTiming(0, { duration: 160, easing: Easing.out(Easing.quad) });
    openProgress.value = withTiming(
      0,
      { duration: CLOSE_MS, easing: Easing.bezier(0.4, 0, 0.2, 1) },
      (finished) => {
        if (finished) runOnJS(finishClose)();
      }
    );
    searchOpenSV.value = withTiming(0, {
      duration: CLOSE_MS,
      easing: Easing.bezier(0.4, 0, 0.2, 1)
    });
  }, [visible, mounted, openProgress, dragOffsetSV, searchOpenSV, finishClose, notifyOpened]);

  React.useEffect(() => {
    if (!mounted || !visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onDismiss();
      return true;
    });
    return () => sub.remove();
  }, [mounted, visible, onDismiss]);

  const handlePan = React.useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(1)
        .activeOffsetY(2)
        .failOffsetX([-48, 48])
        .onTouchesDown(() => {
          "worklet";
          cancelAnimation(openProgress);
          cancelAnimation(dragOffsetSV);
        })
        .onBegin(() => {
          "worklet";
          openProgress.value = 1;
          dragStartOffsetSV.value = dragOffsetSV.value;
        })
        .onUpdate((e) => {
          "worklet";
          const next = dragStartOffsetSV.value + e.translationY;
          dragOffsetSV.value = Math.max(0, next);
        })
        .onEnd((e) => {
          "worklet";
          const h = modalHeightSV.value;
          const threshold = h * DISMISS_DRAG_FRAC;
          const vy = e.velocityY ?? 0;
          const dragged = dragOffsetSV.value;
          const shouldDismiss = dragged > threshold || vy > DISMISS_VELOCITY;

          if (shouldDismiss) {
            cancelAnimation(dragOffsetSV);
            cancelAnimation(openProgress);
            dragOffsetSV.value = 0;
            openProgress.value = Math.max(0, 1 - dragged / Math.max(1, h));
            searchOpenSV.value = openProgress.value;
            openProgress.value = withTiming(
              0,
              { duration: CLOSE_MS, easing: Easing.bezier(0.4, 0, 0.2, 1) },
              (finished) => {
                if (finished) runOnJS(requestDismissFromDrag)();
              }
            );
            searchOpenSV.value = withTiming(0, {
              duration: CLOSE_MS,
              easing: Easing.bezier(0.4, 0, 0.2, 1)
            });
            return;
          }

          dragOffsetSV.value = withSpring(0, {
            damping: 28,
            stiffness: 340,
            mass: 0.68,
            velocity: vy
          });
        }),
    [
      dragOffsetSV,
      dragStartOffsetSV,
      modalHeightSV,
      openProgress,
      requestDismissFromDrag,
      searchOpenSV
    ]
  );

  const panelStyle = useAnimatedStyle(() => {
    const h = modalHeightSV.value;
    const baseY = interpolate(openProgress.value, [0, 1], [h, 0], Extrapolation.CLAMP);
    return {
      transform: [{ translateY: baseY + dragOffsetSV.value }]
    };
  });

  const handleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(openProgress.value, [0.25, 0.85], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(openProgress.value, [0.25, 1], [0.82, 1], Extrapolation.CLAMP)
      }
    ]
  }));

  if (!mounted) return null;

  const borderColor = "rgba(255,255,255,0.12)";
  const handleColor = "rgba(255,255,255,0.32)";

  return (
    <View
      style={[styles.host, { height: modalHeight }]}
      pointerEvents="box-none"
      accessibilityViewIsModal={false}
    >
      <Animated.View
        style={[styles.panel, { height: modalHeight, borderColor }, panelStyle]}
        accessibilityRole="search"
      >
        <View style={styles.shellFill} pointerEvents="none" />
        <LinearGradient
          colors={["rgba(255,255,255,0.08)", "rgba(255,255,255,0.02)", "rgba(255,255,255,0)"]}
          locations={[0, 0.35, 1]}
          style={styles.topSheen}
          pointerEvents="none"
        />
        <View style={styles.edgeHighlight} pointerEvents="none" />

        <GestureDetector gesture={handlePan}>
          <View style={styles.panelGestureRoot}>
            <View style={styles.dragZone} accessibilityRole="adjustable" accessibilityLabel="Drag down to close">
              <Pressable onPress={onDismissKeyboard} style={styles.dragZonePress}>
                <Animated.View style={[styles.handleWrap, handleStyle]}>
                  <View style={[styles.handle, { backgroundColor: handleColor }]} />
                </Animated.View>
              </Pressable>
            </View>
            <View style={styles.body}>{children}</View>
          </View>
        </GestureDetector>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: MODAL_Z_INDEX,
    elevation: MODAL_Z_INDEX
  },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    overflow: "hidden",
    backgroundColor: NAV_BOTTOM_DOCK_SHELL_BG,
    borderTopLeftRadius: PANEL_TOP_RADIUS,
    borderTopRightRadius: PANEL_TOP_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -12 },
        shadowOpacity: 0.22,
        shadowRadius: 36
      },
      android: { elevation: 28 }
    })
  },
  shellFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: NAV_BOTTOM_DOCK_SHELL_BG
  },
  topSheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 140,
    pointerEvents: "none"
  },
  edgeHighlight: {
    position: "absolute",
    top: 0,
    left: 20,
    right: 20,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.28)"
  },
  dragZone: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 8,
    paddingBottom: 2
  },
  dragZonePress: {
    alignSelf: "stretch",
    alignItems: "center"
  },
  panelGestureRoot: {
    flex: 1,
    minHeight: 0
  },
  handleWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 48
  },
  handle: {
    width: 52,
    height: 5,
    borderRadius: 3
  },
  body: {
    flex: 1,
    minHeight: 0,
    marginTop: -10
  }
});
