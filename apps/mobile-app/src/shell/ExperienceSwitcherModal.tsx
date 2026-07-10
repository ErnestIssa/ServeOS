import { BlurView } from "expo-blur";
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
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ExperienceSwitcherPayload } from "../mobile/experienceSwitcherApi";
import { useAppTheme } from "../theme/AppThemeContext";
import { ExperienceSwitcherPanel } from "./ExperienceSwitcherPanel";
import { floatingTopBarBottomY } from "./navBottomMetrics";

const OPEN_MS = 600;
const CLOSE_MS = 540;
const DISMISS_DRAG_FRAC = 0.2;
const DISMISS_VELOCITY = 680;
const MODAL_Z_INDEX = 40;

type Props = {
  visible: boolean;
  onDismiss: () => void;
  authToken: string | null;
  switcher: ExperienceSwitcherPayload | null;
  busy?: boolean;
  userId?: string | null;
  userDisplayName: string;
  userEmail?: string | null;
  activeVenueId: string;
  activeVenueName: string;
  venueSwitchLocked?: boolean;
  directoryRefreshKey?: number;
  onVenueHydrated: (restaurantId: string) => Promise<void>;
  onVenueSwitchError?: (message: string) => void;
  onSelectCustomer: () => void;
  onSelectWorkspace: (restaurantId: string) => void;
  onJoined?: () => void;
  onClosed?: () => void;
};

export function ExperienceSwitcherModal(props: Props) {
  const { visible, onDismiss, busy, onClosed } = props;
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const { isDark } = useAppTheme();

  const [venueConfirmOverlay, setVenueConfirmOverlay] = React.useState<React.ReactNode>(null);
  const venueConfirmOpen = venueConfirmOverlay != null;

  const reportVenueConfirmOverlay = React.useCallback((node: React.ReactNode) => {
    setVenueConfirmOverlay(node);
  }, []);

  React.useEffect(() => {
    if (!visible) setVenueConfirmOverlay(null);
  }, [visible]);

  const modalTop = floatingTopBarBottomY(insets.top);
  const modalHeight = Math.max(280, screenH - modalTop);

  const [mounted, setMounted] = React.useState(visible);
  const [panelSession, setPanelSession] = React.useState(0);
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

  const requestDismissFromDrag = React.useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  const requestBackdropDismiss = React.useCallback(() => {
    if (busy || venueConfirmOpen) return;
    onDismiss();
  }, [busy, venueConfirmOpen, onDismiss]);

  React.useEffect(() => {
    if (visible) {
      setPanelSession((n) => n + 1);
      setMounted(true);
      dragOffsetSV.value = 0;
      openProgress.value = withTiming(1, {
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
  }, [visible, mounted, openProgress, dragOffsetSV, finishClose]);

  React.useEffect(() => {
    if (!mounted || !visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (busy) return true;
      if (venueConfirmOpen) return true;
      onDismiss();
      return true;
    });
    return () => sub.remove();
  }, [mounted, visible, busy, venueConfirmOpen, onDismiss]);

  const handlePan = React.useMemo(
    () =>
      Gesture.Pan()
        .enabled(!busy && !venueConfirmOpen)
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
            openProgress.value = withTiming(
              0,
              { duration: CLOSE_MS, easing: Easing.bezier(0.4, 0, 0.2, 1) },
              (finished) => {
                if (finished) runOnJS(requestDismissFromDrag)();
              }
            );
            return;
          }

          dragOffsetSV.value = withSpring(0, {
            damping: 28,
            stiffness: 340,
            mass: 0.68,
            velocity: vy
          });
        }),
    [busy, venueConfirmOpen, dragOffsetSV, dragStartOffsetSV, modalHeightSV, openProgress, requestDismissFromDrag]
  );

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(openProgress.value, [0, 1], [0, 1], Extrapolation.CLAMP)
  }));

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

  const shellBg = isDark ? "rgba(16,16,20,0.78)" : "rgba(255,255,255,0.9)";
  const borderColor = isDark ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.08)";
  const handleColor = isDark ? "rgba(255,255,255,0.32)" : "rgba(60,60,67,0.38)";

  return (
    <View
      style={styles.host}
      pointerEvents={visible ? "box-none" : "none"}
      accessibilityViewIsModal
    >
      <Pressable
        style={styles.backdropPress}
        onPress={requestBackdropDismiss}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Close switch experience"
      >
        <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents="none">
          <BlurView
            intensity={Platform.OS === "ios" ? 28 : 20}
            tint={isDark ? "dark" : "dark"}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: isDark ? "rgba(0,0,0,0.42)" : "rgba(2,6,23,0.38)" }
            ]}
          />
        </Animated.View>
      </Pressable>

      <Animated.View
        style={[styles.panel, { height: modalHeight, borderColor }, panelStyle]}
        accessibilityRole="menu"
        accessibilityLabel="Switch experience"
      >
        <BlurView
          intensity={Platform.OS === "ios" ? (isDark ? 88 : 100) : 68}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
          {...(Platform.OS === "android" ? ({ experimentalBlurMethod: "dimezisBlurView" } as const) : {})}
        />
        <View style={[styles.shellFill, { backgroundColor: shellBg }]} pointerEvents="none" />
        <LinearGradient
          colors={
            isDark
              ? ["rgba(255,255,255,0.1)", "rgba(255,255,255,0.02)", "rgba(255,255,255,0)"]
              : ["rgba(255,255,255,0.65)", "rgba(255,255,255,0.12)", "rgba(255,255,255,0)"]
          }
          locations={[0, 0.35, 1]}
          style={styles.topSheen}
          pointerEvents="none"
        />
        <View style={styles.edgeHighlight} pointerEvents="none" />

        <GestureDetector gesture={handlePan}>
          <View style={styles.panelGestureRoot}>
            <View style={styles.dragZone} accessibilityRole="adjustable" accessibilityLabel="Drag down to close">
              <Animated.View style={[styles.handleWrap, handleStyle]}>
                <View style={[styles.handle, { backgroundColor: handleColor }]} />
              </Animated.View>
            </View>

            <View style={styles.body}>
              <ExperienceSwitcherPanel
                key={`experience-switcher-panel-${panelSession}`}
                variant="modal"
                modalOpen={visible}
                authToken={props.authToken}
                switcher={props.switcher}
                busy={props.busy}
                userId={props.userId}
                userDisplayName={props.userDisplayName}
                userEmail={props.userEmail}
                activeVenueId={props.activeVenueId}
                activeVenueName={props.activeVenueName}
                venueSwitchLocked={props.venueSwitchLocked}
                directoryRefreshKey={props.directoryRefreshKey}
                onVenueHydrated={props.onVenueHydrated}
                onVenueSwitchError={props.onVenueSwitchError}
                onSelectCustomer={props.onSelectCustomer}
                onSelectWorkspace={props.onSelectWorkspace}
                onJoined={props.onJoined}
                onVenueConfirmOverlayChange={reportVenueConfirmOverlay}
              />
            </View>
          </View>
        </GestureDetector>
      </Animated.View>

      {venueConfirmOverlay ? (
        <View style={styles.venueConfirmHost} pointerEvents="box-none">
          {venueConfirmOverlay}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: MODAL_Z_INDEX,
    elevation: MODAL_Z_INDEX
  },
  backdropPress: {
    ...StyleSheet.absoluteFillObject
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject
  },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
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
  shellFill: { ...StyleSheet.absoluteFillObject },
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
  },
  venueConfirmHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 120,
    elevation: 120
  }
});
