import { BlurView } from "expo-blur";
import React from "react";
import { Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue
} from "react-native-reanimated";
import type { EdgeInsets } from "react-native-safe-area-context";
import {
  DOCK_SHEET_GAP,
  FLOATING_TAB_BAR_HEIGHT,
  FLOAT_MARGIN_SIDE,
  floatingDockBottomY
} from "./navBottomMetrics";
import { computeNavSheetSnapDims, useNavSheetPanGestures } from "./NavExpandSheet";
import {
  NavSheetScrollProvider,
  createNavSheetNativeScrollGesture
} from "./NavSheetScrollContext";
import { useAppTheme } from "../theme/AppThemeContext";

type Props = {
  insets: EdgeInsets;
  sheetHeightSV: SharedValue<number>;
  snapImpactTargetSV: SharedValue<number>;
  snapImpactArmedSV: SharedValue<number>;
  sheetContent?: React.ReactNode;
  sheetFullOnly?: boolean;
};

/**
 * Expandable panel that sits above the floating dock — decoupled from tab bar chrome.
 * Opens only programmatically; pans dismiss when already open.
 */
export function NavExpandSheetHost({
  insets,
  sheetHeightSV,
  snapImpactTargetSV,
  snapImpactArmedSV,
  sheetContent,
  sheetFullOnly = false
}: Props) {
  const { height: screenH } = useWindowDimensions();
  const { isDark } = useAppTheme();

  const navSheetScrollYSV = useSharedValue(0);
  const navSheetScrollAtEndSV = useSharedValue(0);
  const navSheetNativeScrollGesture = React.useMemo(() => createNavSheetNativeScrollGesture(), []);

  useAnimatedReaction(
    () => sheetHeightSV.value,
    (h) => {
      if (h <= 2) {
        navSheetScrollYSV.value = 0;
        navSheetScrollAtEndSV.value = 0;
      }
    }
  );

  const { panVerticalOnSheetBody, sheetPanDragSessionSV } = useNavSheetPanGestures(insets, sheetHeightSV, {
    allowHalfDetent: !sheetFullOnly,
    snapImpactTargetSV,
    snapImpactArmedSV,
    sheetContentScrollYSV: navSheetScrollYSV,
    sheetContentScrollAtEndSV: navSheetScrollAtEndSV,
    nativeScrollGesture: navSheetNativeScrollGesture
  });

  const { snapMid, snapHigh } = React.useMemo(
    () => computeNavSheetSnapDims(screenH, insets),
    [screenH, insets.bottom, insets.top]
  );
  const snapMidSV = useSharedValue(snapMid);
  const snapHighSV = useSharedValue(snapHigh);
  React.useLayoutEffect(() => {
    const v = computeNavSheetSnapDims(screenH, insets);
    snapMidSV.value = v.snapMid;
    snapHighSV.value = v.snapHigh;
  }, [screenH, insets.bottom, insets.top, snapMidSV, snapHighSV]);

  const dockClearance = floatingDockBottomY(insets.bottom) + FLOATING_TAB_BAR_HEIGHT + DOCK_SHEET_GAP;

  const [sheetPanelTouches, setSheetPanelTouches] = React.useState(false);
  useAnimatedReaction(
    () => sheetHeightSV.value > 0.5,
    (open, prev) => {
      if (open === prev) return;
      runOnJS(setSheetPanelTouches)(open);
    },
    [sheetHeightSV]
  );

  const panelShellStyle = useAnimatedStyle(() => {
    const h = sheetHeightSV.value;
    if (h <= 0.5) {
      return {
        height: 0,
        opacity: 0,
        bottom: dockClearance,
        left: FLOAT_MARGIN_SIDE,
        right: FLOAT_MARGIN_SIDE,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        borderBottomLeftRadius: 22,
        borderBottomRightRadius: 22
      };
    }

    const sm = sheetFullOnly ? 0 : snapMidSV.value;
    const sh = snapHighSV.value;
    const span = Math.max(1, sh - sm);
    const expandT = h <= sm ? 0 : h >= sh ? 1 : (h - sm) / span;
    const marginH = interpolate(expandT, [0, 1], [FLOAT_MARGIN_SIDE, 0], Extrapolation.CLAMP);
    const radius = interpolate(expandT, [0, 1], [22, 0], Extrapolation.CLAMP);

    return {
      height: h,
      opacity: 1,
      bottom: dockClearance,
      left: marginH,
      right: marginH,
      borderTopLeftRadius: radius,
      borderTopRightRadius: radius,
      borderBottomLeftRadius: 12,
      borderBottomRightRadius: 12
    };
  }, [dockClearance, sheetFullOnly, snapMidSV, snapHighSV]);

  const handleStyle = useAnimatedStyle(() => {
    const h = sheetHeightSV.value;
    const dragging = sheetPanDragSessionSV.value > 0.5;
    const openEnough = interpolate(h, [22, 56], [0, 1], Extrapolation.CLAMP);
    const settled = dragging ? 0 : 1;
    return { opacity: openEnough * settled };
  }, [sheetPanDragSessionSV]);

  const shellTint = isDark ? "rgba(18,18,22,0.55)" : "rgba(255,255,255,0.12)";
  const shellBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.18)";

  return (
    <View pointerEvents="box-none" style={styles.anchor}>
      <GestureDetector gesture={panVerticalOnSheetBody}>
        <Animated.View
          collapsable={false}
          pointerEvents={sheetPanelTouches ? "auto" : "box-none"}
          style={[styles.panelShell, panelShellStyle, { borderColor: shellBorder }]}
        >
          <BlurView
            intensity={Platform.OS === "ios" ? (isDark ? 70 : 88) : 56}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
            {...(Platform.OS === "android" ? ({ experimentalBlurMethod: "dimezisBlurView" } as const) : {})}
          />
          <View style={[styles.shellTint, { backgroundColor: shellTint }]} pointerEvents="none" />
          <View style={styles.shellHighlight} pointerEvents="none" />

          <Animated.View style={[styles.handleWrap, handleStyle]} pointerEvents="none">
            <View style={styles.handle} />
          </Animated.View>

          <View style={styles.bodyHost} pointerEvents="box-none">
            <NavSheetScrollProvider
              scrollYSV={navSheetScrollYSV}
              scrollAtEndSV={navSheetScrollAtEndSV}
              nativeScrollGesture={navSheetNativeScrollGesture}
            >
              {sheetContent}
            </NavSheetScrollProvider>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 18,
    pointerEvents: "box-none"
  },
  panelShell: {
    position: "absolute",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.16,
        shadowRadius: 28
      },
      android: { elevation: 14 },
      default: {}
    })
  },
  shellTint: { ...StyleSheet.absoluteFillObject },
  shellHighlight: {
    position: "absolute",
    top: 0,
    left: 12,
    right: 12,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.2)"
  },
  handleWrap: {
    position: "absolute",
    top: 8,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 4
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(120,120,130,0.55)"
  },
  bodyHost: {
    flex: 1,
    minHeight: 48,
    paddingTop: 18
  }
});
