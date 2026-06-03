import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type ViewStyle
} from "react-native";
import { Gesture, GestureDetector, Pressable } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from "react-native-reanimated";
import type { EdgeInsets } from "react-native-safe-area-context";
import {
  FLOATING_TAB_BAR_HEIGHT,
  FLOAT_MARGIN_BOTTOM,
  FLOAT_MARGIN_SIDE,
  contentBottomInset
} from "./navBottomMetrics";
import type { MobileTabIconKey } from "../mobile/mobileExperienceTypes";
import {
  NavIconAccount,
  NavIconBookings,
  NavIconChat,
  NavIconDashboard,
  NavIconHome,
  NavIconMenu,
  NavIconMessages,
  NavIconOrdersMark,
  NavIconProfile,
  NavIconSchedule,
  NavIconStaff,
  NavIconTasks,
  NavTabMeAvatar
} from "./NavTabIcons";
import { FLOATING_TOP_BAR_HEIGHT, FLOATING_TOP_GAP } from "./FloatingTopBar";
import { computeNavSheetSnapDims, useNavSheetPanGestures } from "./NavExpandSheet";
import { R } from "../theme";
import { useAppTheme } from "../theme/AppThemeContext";

/** Active nav tab key — defined by backend `mobileExperience.tabs[].key`. */
export type TabId = string;

type NavTabItem = { id: string; label: string; icon: MobileTabIconKey };

const FALLBACK_CUSTOMER_TABS: ReadonlyArray<NavTabItem> = [
  { id: "home", label: "Home", icon: "home" },
  { id: "bookings", label: "Book", icon: "bookings" },
  { id: "orders", label: "Orders", icon: "orders" },
  { id: "messages", label: "Chat", icon: "messages" },
  { id: "account", label: "Profile", icon: "profile" }
];

/** Matches review mood slider — smooth glide, not bouncy spring. */
const PILL_MOVE_MS = 300;
const PILL_DRAG_SNAP_MS = 260;
const PILL_EASE = Easing.bezier(0.22, 1, 0.36, 1);
const PILL_DRAG_EASE = Easing.out(Easing.cubic);
/** Magnify while finger is down (drag or hold). */
const PILL_LIFT_MS = 200;
const PILL_LIFT_SCALE = 1.12;
const PILL_LIFT_RISE_Y = -4;
/** Finger must move this far before pan (and magnify) — plain taps stay inert. */
const PILL_DRAG_MIN_DISTANCE = 12;
/** Horizontal travel before magnify while dragging. */
const PILL_LIFT_TRANSLATION_X = 8;
const PILL_INSET = 3;
/** Max tabs in any role shell (customer, staff, admin all use five). */
const TAB_LAST_INDEX = 4;
const TAB_INDEX_INPUT = [0, 1, 2, 3, 4] as const;
const ICON_SIZE = 30;

function clampPillProgress(n: number): number {
  "worklet";
  return Math.min(TAB_LAST_INDEX, Math.max(0, n));
}

function useTabStopLayout() {
  const c0 = useSharedValue(0);
  const c1 = useSharedValue(0);
  const c2 = useSharedValue(0);
  const c3 = useSharedValue(0);
  const c4 = useSharedValue(0);
  const w0 = useSharedValue(0);
  const w1 = useSharedValue(0);
  const w2 = useSharedValue(0);
  const w3 = useSharedValue(0);
  const w4 = useSharedValue(0);
  return React.useMemo(
    () => ({
      centers: [c0, c1, c2, c3, c4] as const,
      widths: [w0, w1, w2, w3, w4] as const
    }),
    [c0, c1, c2, c3, c4, w0, w1, w2, w3, w4]
  );
}

/** ME tab profile photo — slightly larger than nav glyphs. */
const ME_AVATAR_TAB_SIZE = 40;
/** Keeps tab press ripple / hit area inset from outer purple chrome (horizontal padding on strip). */
const TAB_EDGE_INSET_H = 10;
/** Space between seam dash zone and interactive row (ripple must not creep into dash). */
const TAB_STRIP_PAD_ABOVE_TABS = 10;
/** Space between tab row zone and inner bottom corners of purple chrome. */
const TAB_STRIP_PAD_BELOW_TABS = 10;
/** Overlays sheet↔tabs seam so drags work when sheet layout height is 0 (zero-height views don't receive touches). */
const SHEET_SEAM_GRAB_HEIGHT = 36;
/** When sheet is taller than this and finger is up, hide seam grab so only the sheet pan runs (no double updates). */
const SEAM_GRAB_HIDE_ABOVE_H = 28;

export { FLOATING_TAB_BAR_HEIGHT, FLOAT_MARGIN_BOTTOM, FLOAT_MARGIN_SIDE, contentBottomInset };

type Props = {
  tab: TabId;
  onChange: (t: TabId) => void;
  insets: EdgeInsets;
  sheetHeightSV: SharedValue<number>;
  /** Arming pair for snap “hit” haptics (first entry into target band). Owned by App, shared with programmatic springs. */
  snapImpactTargetSV: SharedValue<number>;
  snapImpactArmedSV: SharedValue<number>;
  sheetContent?: React.ReactNode;
  /** Home: user dragged sheet open from collapsed — enables cart panel for this open cycle. */
  onSheetDragOpenFromCollapsed?: () => void;
  /** When true, sheet is in search/discovery mode and must only settle at full or closed (no half detent). */
  sheetFullOnly?: boolean;
  /** Unread incoming chat messages (customer). */
  messagesUnreadCount?: number;
  /** Active (in-progress) orders — hidden while Orders tab is open. */
  ordersActiveCount?: number;
  /** Upcoming confirmed reservations — hidden while Book tab is open. */
  bookingsUpcomingCount?: number;
  /** When set, ME tab shows the user's photo instead of the ME label. */
  meAvatarUri?: string | null;
  /** Backend nav manifest (`mobileExperience.tabs`). */
  navTabs?: ReadonlyArray<{ key: string; label: string; icon: MobileTabIconKey }>;
};

function TabGlyph({
  icon,
  color,
  meAvatarUri
}: {
  icon: MobileTabIconKey;
  color: string;
  meAvatarUri?: string | null;
}) {
  if (icon === "profile" && meAvatarUri?.trim()) {
    return <NavTabMeAvatar size={ME_AVATAR_TAB_SIZE} uri={meAvatarUri.trim()} />;
  }
  switch (icon) {
    case "home":
      return <NavIconHome size={ICON_SIZE} color={color} />;
    case "bookings":
      return <NavIconBookings size={ICON_SIZE} color={color} />;
    case "orders":
      return <NavIconOrdersMark size={ICON_SIZE} color={color} />;
    case "messages":
      return <NavIconMessages size={ICON_SIZE} color={color} />;
    case "chat":
      return <NavIconChat size={ICON_SIZE} color={color} />;
    case "profile":
      return <NavIconProfile size={ICON_SIZE} color={color} />;
    case "dashboard":
      return <NavIconDashboard size={ICON_SIZE} color={color} />;
    case "tasks":
      return <NavIconTasks size={ICON_SIZE} color={color} />;
    case "schedule":
      return <NavIconSchedule size={ICON_SIZE} color={color} />;
    case "menu":
      return <NavIconMenu size={ICON_SIZE} color={color} />;
    case "staff":
      return <NavIconStaff size={ICON_SIZE} color={color} />;
    default:
      return <NavIconAccount size={ICON_SIZE} color={color} />;
  }
}

function isChatTabKey(key: string): boolean {
  return key === "messages" || key === "chat";
}

export function FloatingGlassTabBar({
  tab,
  onChange,
  insets,
  sheetHeightSV,
  snapImpactTargetSV,
  snapImpactArmedSV,
  sheetContent,
  onSheetDragOpenFromCollapsed,
  sheetFullOnly,
  messagesUnreadCount = 0,
  ordersActiveCount = 0,
  bookingsUpcomingCount = 0,
  meAvatarUri = null,
  navTabs
}: Props) {
  const visibleTabs = React.useMemo((): ReadonlyArray<NavTabItem> => {
    if (navTabs?.length) {
      return navTabs.map((t) => ({ id: t.key, label: t.label, icon: t.icon }));
    }
    return FALLBACK_CUSTOMER_TABS;
  }, [navTabs]);
  const tabCount = visibleTabs.length;
  const tabLastIndex = Math.max(0, tabCount - 1);

  const { height: screenH } = useWindowDimensions();
  const { isDark, colors: theme } = useAppTheme();
  const pillFillRest = isDark ? "#334155" : "#F5F3FF";
  const pillFillLift = isDark ? "#3D4F68" : "#FFFFFF";
  const pillBorderColor = isDark ? "rgba(167,139,250,0.85)" : "rgba(139,92,246,0.65)";
  const androidGlassFill = React.useMemo(
    () => ({
      ...styles.androidFallbackFill,
      backgroundColor: isDark ? "rgba(26, 35, 50, 0.9)" : "rgba(255,255,255,0.82)"
    }),
    [isDark]
  );

  const { panVerticalOnSheetBody, panVerticalSeamGrab, panVerticalWithTabsDuplicate, sheetPanDragSessionSV } =
    useNavSheetPanGestures(insets, sheetHeightSV, {
      onUserDragFromCollapsed: onSheetDragOpenFromCollapsed,
      allowHalfDetent: !sheetFullOnly,
      snapImpactTargetSV,
      snapImpactArmedSV
    });

  const dockBottom = insets.bottom + FLOAT_MARGIN_BOTTOM;
  const pillAnchorBottom = FLOAT_MARGIN_BOTTOM + insets.bottom + FLOATING_TAB_BAR_HEIGHT;
  const topReserve = insets.top + FLOATING_TOP_BAR_HEIGHT + FLOATING_TOP_GAP + 8;
  const fullH = Math.max(120, screenH - topReserve);
  const dockMaxH = Math.max(0, fullH - pillAnchorBottom);

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

  const { centers: tabCenters, widths: tabWidths } = useTabStopLayout();
  const pillProgress = useSharedValue(0);
  const pillLiftSV = useSharedValue(0);
  const dragStartProgress = useSharedValue(0);
  const lastPillTabIndex = useSharedValue(0);
  const pillDragDidMoveSV = useSharedValue(0);
  const tabIndexSV = useSharedValue(0);
  const tabRowWidthSV = useSharedValue(0);

  React.useLayoutEffect(() => {
    tabIndexSV.value = tabIndex;
  }, [tabIndex, tabIndexSV]);

  const tabIndex = React.useMemo(
    () => Math.max(0, visibleTabs.findIndex((t) => t.id === tab)),
    [tab, visibleTabs]
  );
  const tabRef = React.useRef(tab);
  tabRef.current = tab;
  const pillDragActiveRef = React.useRef(false);

  const resetPillLift = React.useCallback(() => {
    cancelAnimation(pillLiftSV);
    pillLiftSV.value = withTiming(0, { duration: PILL_LIFT_MS, easing: PILL_DRAG_EASE });
  }, [pillLiftSV]);

  const snapPillTo = React.useCallback(
    (index: number, duration = PILL_MOVE_MS, easing = PILL_EASE) => {
      const clamped = Math.max(0, Math.min(tabLastIndex, index));
      lastPillTabIndex.value = clamped;
      cancelAnimation(pillLiftSV);
      pillLiftSV.value = 0;
      pillProgress.value = withTiming(clamped, { duration, easing });
    },
    [lastPillTabIndex, pillLiftSV, pillProgress, tabLastIndex]
  );

  const finishPan = React.useCallback(
    (index: number) => {
      const id = visibleTabs[index]?.id;
      if (!id || id === tabRef.current) return;
      onChange(id);
    },
    [onChange, visibleTabs]
  );

  const fireTabCrossHaptic = React.useCallback(() => {
    void Haptics.selectionAsync();
  }, []);

  const setPillDragActive = React.useCallback((active: boolean) => {
    pillDragActiveRef.current = active;
  }, []);

  React.useEffect(() => {
    if (pillDragActiveRef.current) return;
    snapPillTo(tabIndex);
  }, [tab, tabIndex, snapPillTo]);

  const seedTabStopsFromRowWidth = React.useCallback(
    (rowW: number) => {
      tabRowWidthSV.value = rowW;
      const pad = 6;
      const inner = Math.max(0, rowW - pad * 2);
      const step = inner / tabCount;
      if (step <= 0) return;
      for (let i = 0; i < tabCount; i++) {
        tabCenters[i].value = pad + (i + 0.5) * step;
        tabWidths[i].value = step;
      }
    },
    [tabCenters, tabRowWidthSV, tabWidths, tabCount]
  );

  const onTabRowLayout = React.useCallback(
    (e: LayoutChangeEvent) => {
      const rowW = e.nativeEvent.layout.width;
      if (rowW <= 0) return;
      seedTabStopsFromRowWidth(rowW);
      if (!pillDragActiveRef.current) {
        pillProgress.value = tabIndex;
        lastPillTabIndex.value = tabIndex;
      }
    },
    [lastPillTabIndex, pillProgress, seedTabStopsFromRowWidth, tabIndex]
  );

  const onTabItemLayout = React.useCallback(
    (index: number) => (e: LayoutChangeEvent) => {
      const { x, width } = e.nativeEvent.layout;
      if (width <= 0) return;
      tabCenters[index].value = x + width / 2;
      tabWidths[index].value = width;
    },
    [tabCenters, tabWidths]
  );

  const panTabRow = React.useMemo(() => {
    const pan = Gesture.Pan()
      .minPointers(1)
      .maxPointers(1)
      .minDistance(PILL_DRAG_MIN_DISTANCE)
      .activeOffsetX([-10, 10])
      .failOffsetY([-22, 22]);

    pan.onBegin(() => {
      "worklet";
      dragStartProgress.value = pillProgress.value;
      lastPillTabIndex.value = Math.round(pillProgress.value);
      pillDragDidMoveSV.value = 0;
    });

    pan.onUpdate((event) => {
      "worklet";
      const range = tabCenters[4].value - tabCenters[0].value;
      if (range <= 1) return;

      if (Math.abs(event.translationX) >= PILL_LIFT_TRANSLATION_X) {
        pillDragDidMoveSV.value = 1;
        if (pillLiftSV.value < 0.02) {
          cancelAnimation(pillLiftSV);
          pillLiftSV.value = withTiming(1, { duration: PILL_LIFT_MS, easing: PILL_EASE });
          runOnJS(setPillDragActive)(true);
        }
      }

      const next = dragStartProgress.value + (event.translationX / range) * TAB_LAST_INDEX;
      pillProgress.value = clampPillProgress(next);
      const idx = Math.round(pillProgress.value);
      const clamped = Math.max(0, Math.min(TAB_LAST_INDEX, idx));
      if (clamped !== lastPillTabIndex.value) {
        lastPillTabIndex.value = clamped;
        runOnJS(fireTabCrossHaptic)();
      }
    });

    pan.onEnd(() => {
      "worklet";
      cancelAnimation(pillLiftSV);
      pillLiftSV.value = withTiming(0, { duration: PILL_LIFT_MS, easing: PILL_DRAG_EASE });

      if (pillDragDidMoveSV.value < 0.5) {
        const home = Math.max(0, Math.min(TAB_LAST_INDEX, tabIndexSV.value));
        pillProgress.value = withTiming(home, { duration: PILL_DRAG_SNAP_MS, easing: PILL_DRAG_EASE });
        runOnJS(setPillDragActive)(false);
        return;
      }

      const clamped = Math.max(0, Math.min(TAB_LAST_INDEX, Math.round(pillProgress.value)));
      lastPillTabIndex.value = clamped;
      pillProgress.value = withTiming(clamped, {
        duration: PILL_DRAG_SNAP_MS,
        easing: PILL_DRAG_EASE
      });
      runOnJS(finishPan)(clamped);
      runOnJS(setPillDragActive)(false);
    });

    pan.onFinalize(() => {
      "worklet";
      cancelAnimation(pillLiftSV);
      pillLiftSV.value = withTiming(0, { duration: PILL_LIFT_MS, easing: PILL_DRAG_EASE });
      runOnJS(setPillDragActive)(false);
    });

    return pan;
  }, [
    dragStartProgress,
    finishPan,
    fireTabCrossHaptic,
    lastPillTabIndex,
    pillDragDidMoveSV,
    pillLiftSV,
    pillProgress,
    setPillDragActive,
    tabCenters,
    tabIndexSV
  ]);

  const panTabRowWithPress = React.useMemo(
    () => Gesture.Simultaneous(panTabRow, Gesture.Native()),
    [panTabRow]
  );

  /** Vertical sheet open vs horizontal tab pill — first axis to activate wins. */
  const panTabsWithSheet = React.useMemo(
    () => Gesture.Race(panVerticalWithTabsDuplicate, panTabRowWithPress),
    [panTabRowWithPress, panVerticalWithTabsDuplicate]
  );

  const pillAnimatedStyle = useAnimatedStyle(() => {
    const x = interpolate(
      pillProgress.value,
      TAB_INDEX_INPUT,
      [
        tabCenters[0].value,
        tabCenters[1].value,
        tabCenters[2].value,
        tabCenters[3].value,
        tabCenters[4].value
      ]
    );
    const w = interpolate(
      pillProgress.value,
      TAB_INDEX_INPUT,
      [tabWidths[0].value, tabWidths[1].value, tabWidths[2].value, tabWidths[3].value, tabWidths[4].value]
    );
    const rowW = tabRowWidthSV.value;
    const lastIdx = Math.min(4, Math.max(0, tabLastIndex));
    const fallbackSeg = rowW > 0 ? rowW / Math.max(1, tabCount) : 64;
    const wSafe = w > 8 ? w : fallbackSeg;
    const rangeOk = tabCenters[lastIdx].value - tabCenters[0].value > 8;
    const xSafe = rangeOk
      ? x
      : rowW > 0
        ? 6 + (pillProgress.value + 0.5) * Math.max(0, rowW - 12) / Math.max(1, tabCount)
        : 0;
    const pillW = Math.max(40, wSafe - PILL_INSET * 2);
    const lift = pillLiftSV.value;
    const atRest = lift < 0.001;
    const scale = atRest ? 1 : interpolate(lift, [0, 1], [1, PILL_LIFT_SCALE]);
    const liftY = atRest ? 0 : interpolate(lift, [0, 1], [0, PILL_LIFT_RISE_Y]);
    const tx = xSafe - wSafe / 2;
    const translateX = atRest ? Math.round(tx) : tx;
    return {
      width: pillW,
      zIndex: atRest ? 1 : 10,
      shadowOpacity: atRest ? 0.1 : interpolate(lift, [0, 1], [0.1, 0.28]),
      shadowRadius: atRest ? 4 : interpolate(lift, [0, 1], [4, 18]),
      elevation: atRest ? 2 : interpolate(lift, [0, 1], [2, 12]),
      transform: [{ translateX }, { translateY: liftY }, { scale }]
    };
  });

  const pillFillAnimatedStyle = useAnimatedStyle(() => {
    const lift = pillLiftSV.value;
    return {
      backgroundColor: interpolateColor(lift, [0, 1], [pillFillRest, pillFillLift])
    };
  }, [pillFillLift, pillFillRest]);

  const animatedShellStyle = useAnimatedStyle(() => {
    const h = sheetHeightSV.value;
    const totalH = FLOATING_TAB_BAR_HEIGHT + h;

    if (h <= 0.5) {
      return {
        height: FLOATING_TAB_BAR_HEIGHT,
        bottom: dockBottom,
        left: FLOAT_MARGIN_SIDE,
        right: FLOAT_MARGIN_SIDE,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28
      };
    }

    /** Search mode should not “kink” at half; start shrinking inset from the first pixel of open. */
    const sm = sheetFullOnly ? 0 : snapMidSV.value;
    const sh = snapHighSV.value;
    const span = Math.max(1, sh - sm);
    const expandT =
      h <= sm ? 0 : h >= sh ? 1 : (h - sm) / span;
    const marginH = interpolate(expandT, [0, 1], [FLOAT_MARGIN_SIDE, 0], Extrapolation.CLAMP);

    const bottomPos = h <= dockMaxH ? dockBottom : screenH - topReserve - FLOATING_TAB_BAR_HEIGHT - h;

    return {
      height: totalH,
      bottom: bottomPos,
      left: marginH,
      right: marginH,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28
    };
  }, [dockBottom, dockMaxH, screenH, topReserve, sheetHeightSV, snapMidSV, snapHighSV]);

  const sheetPanelStyle = useAnimatedStyle(
    () => ({
      height: sheetHeightSV.value,
      opacity: sheetHeightSV.value <= 0.5 ? 0 : 1
    }),
    [sheetHeightSV]
  );

  const seamDashStyle = useAnimatedStyle(
    () => ({
      opacity: interpolate(sheetHeightSV.value, [0, 28], [1, 0], Extrapolation.CLAMP)
    }),
    [sheetHeightSV]
  );

  /** Top handle: visible when sheet rests at half/full; hidden while finger is down so it pops in after each stop. */
  const sheetTopHandleDashStyle = useAnimatedStyle(() => {
    const h = sheetHeightSV.value;
    const dragging = sheetPanDragSessionSV.value > 0.5;
    const openEnough = interpolate(h, [22, 56], [0, 1], Extrapolation.CLAMP);
    const settled = dragging ? 0 : 1;
    return { opacity: openEnough * settled };
  }, [sheetHeightSV, sheetPanDragSessionSV]);

  /** Unmounting the seam grab mid-drag killed the pan; keep it while `sheetPanDragSessionSV` is active. */
  const [sheetPanelTouches, setSheetPanelTouches] = React.useState(false);
  useAnimatedReaction(
    () => sheetHeightSV.value > 0.5,
    (open, prev) => {
      if (open === prev) return;
      runOnJS(setSheetPanelTouches)(open);
    },
    [sheetHeightSV]
  );

  const [seamGrabActive, setSeamGrabActive] = React.useState(true);
  useAnimatedReaction(
    () => {
      const busy = sheetPanDragSessionSV.value > 0.5;
      if (busy) return 1;
      return sheetHeightSV.value < SEAM_GRAB_HIDE_ABOVE_H ? 1 : 0;
    },
    (show, prev) => {
      if (show === prev) return;
      runOnJS(setSeamGrabActive)(show === 1);
    },
    [sheetHeightSV, sheetPanDragSessionSV]
  );

  const onTabPress = (id: TabId, index: number) => {
    pillDragActiveRef.current = false;
    pillDragDidMoveSV.value = 0;
    resetPillLift();
    snapPillTo(index);
    onChange(id);
    void Haptics.selectionAsync();
  };

  const iconColorFor = (tabItem: NavTabItem, selected: boolean) => {
    if (tabItem.id === "orders") {
      return selected ? theme.ordersNavPurpleBright : theme.ordersNavPurple;
    }
    if (selected) return theme.accentPurple;
    return theme.navIconIdle;
  };

  return (
    <View pointerEvents="box-none" style={styles.screenAnchor}>
      <Animated.View style={[styles.chromeShell, animatedShellStyle]}>
        <BlurView
          pointerEvents="box-none"
          intensity={Platform.OS === "ios" ? 92 : Platform.OS === "android" ? 50 : 70}
          tint={isDark ? "dark" : Platform.OS === "ios" ? "systemChromeMaterialLight" : "light"}
          blurReductionFactor={Platform.OS === "android" ? 3.2 : undefined}
          style={styles.blurFill}
          {...(Platform.OS === "android" ? ({ experimentalBlurMethod: "dimezisBlurView" } as const) : {})}
        >
          {Platform.OS === "android" ? <View style={androidGlassFill} pointerEvents="none" /> : null}

          <View style={styles.chromeColumn} accessibilityRole="adjustable" accessibilityLabel="Bottom navigation and panels">
            <GestureDetector gesture={panVerticalOnSheetBody}>
              <Animated.View
                collapsable={false}
                style={[styles.sheetPanel, sheetPanelStyle]}
                pointerEvents={sheetPanelTouches ? "auto" : "box-none"}
              >
                <Animated.View
                  style={[styles.sheetTopHandleDashWrap, sheetTopHandleDashStyle]}
                  pointerEvents="none"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <View style={styles.sheetTopHandleDash} />
                </Animated.View>
                <Pressable accessible={false} style={styles.sheetBodyHost} collapsable={false} onPress={Keyboard.dismiss}>
                  <View style={styles.sheetBodyInner} collapsable={false}>
                    {sheetContent}
                  </View>
                </Pressable>
              </Animated.View>
            </GestureDetector>

            <View style={styles.tabStrip} accessibilityRole="tablist">
              <Animated.View style={[styles.seamDashWrap, seamDashStyle]} pointerEvents="none">
                <View style={styles.seamDash} />
              </Animated.View>

              <View style={styles.gestureHost}>
                <View style={styles.tabGestureSizer}>
                  <GestureDetector gesture={panTabsWithSheet}>
                    <View style={styles.tabSwipeArea}>
                      <Animated.View
                        style={[styles.liquidPill, pillAnimatedStyle]}
                        pointerEvents="none"
                        collapsable={false}
                      >
                        <Animated.View style={[styles.pillFill, pillFillAnimatedStyle]} />
                        <View style={[styles.pillGlassBorder, { borderColor: pillBorderColor }]} />
                      </Animated.View>

                      <View style={styles.tabRow} onLayout={onTabRowLayout}>
                      {visibleTabs.map((t, index) => {
                        const selected = tab === t.id;
                        const iconColor = iconColorFor(t, selected);
                        return (
                          <Pressable
                            key={t.id}
                            accessibilityRole="tab"
                            accessibilityLabel={t.label}
                            accessibilityState={{ selected }}
                            style={({ pressed }) => [styles.tabItem, webTabPressNoOutline, pressed && styles.pressed]}
                            android_ripple={
                              Platform.OS === "android"
                                ? {
                                    color: "rgba(139,92,246,0.14)",
                                    foreground: false,
                                    borderless: false,
                                    radius: 26
                                  }
                                : undefined
                            }
                            onLayout={onTabItemLayout(index)}
                            onPress={() => {
                              if (pillDragActiveRef.current) return;
                              onTabPress(t.id, index);
                            }}
                          >
                            <View style={styles.tabGlyphWrap}>
                              <TabGlyph icon={t.icon} color={iconColor} meAvatarUri={meAvatarUri} />
                              {isChatTabKey(t.id) && messagesUnreadCount > 0 ? (
                                <View style={styles.tabBadge}>
                                  <Text style={styles.tabBadgeText}>
                                    {messagesUnreadCount > 99 ? "99+" : String(messagesUnreadCount)}
                                  </Text>
                                </View>
                              ) : null}
                              {t.id === "orders" && ordersActiveCount > 0 ? (
                                <View style={styles.tabBadge}>
                                  <Text style={styles.tabBadgeText}>
                                    {ordersActiveCount > 99 ? "99+" : String(ordersActiveCount)}
                                  </Text>
                                </View>
                              ) : null}
                              {t.id === "bookings" && bookingsUpcomingCount > 0 ? (
                                <View style={styles.tabBadgeCart} pointerEvents="none">
                                  <Text style={styles.tabBadgeCartText} allowFontScaling={false}>
                                    {bookingsUpcomingCount > 99 ? "99+" : String(bookingsUpcomingCount)}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          </Pressable>
                        );
                      })}
                      </View>
                    </View>
                  </GestureDetector>
                </View>
              </View>

              {seamGrabActive ? (
                <GestureDetector gesture={panVerticalSeamGrab}>
                  <View
                    style={styles.sheetSeamGrabBridge}
                    collapsable={false}
                    accessibilityLabel="Drag to expand or collapse panel"
                    accessibilityRole="adjustable"
                  />
                </GestureDetector>
              ) : null}
            </View>
          </View>
        </BlurView>
      </Animated.View>
    </View>
  );
}

/** Web: suppress focus ring hugging the chrome */
const webTabPressNoOutline: ViewStyle = Platform.OS === "web" ? { outlineWidth: 0 } : {};

const hairline: ViewStyle =
  Platform.OS === "ios"
    ? { borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.65)" }
    : { borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(226,232,240,0.95)" };

const styles = StyleSheet.create({
  screenAnchor: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    pointerEvents: "box-none"
  },
  chromeShell: {
    position: "absolute",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: R.accentPurple,
    ...Platform.select({
      ios: {
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 32
      },
      android: { elevation: 18 },
      default: {}
    })
  },
  blurFill: {
    flex: 1,
    minHeight: FLOATING_TAB_BAR_HEIGHT
  },
  androidFallbackFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.82)"
  },
  chromeColumn: {
    flex: 1,
    flexDirection: "column",
    position: "relative"
  },
  sheetPanel: {
    position: "relative",
    width: "100%",
    overflow: "hidden",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.35)"
  },
  sheetTopHandleDashWrap: {
    position: "absolute",
    top: 10,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 6
  },
  sheetTopHandleDash: {
    width: 56,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(15,23,42,0.88)"
  },
  sheetBodyHost: {
    flex: 1,
    minHeight: 48
  },
  sheetBodyInner: {
    flex: 1,
    minHeight: 48
  },
  tabStrip: {
    position: "relative",
    height: FLOATING_TAB_BAR_HEIGHT,
    minHeight: FLOATING_TAB_BAR_HEIGHT,
    flexShrink: 0
  },
  seamDashWrap: {
    position: "absolute",
    /** Slightly below sheet hairline — reserved band below keeps ripple off the dash */
    top: 5,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 8
  },
  seamDash: {
    width: 52,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(15,23,42,0.88)"
  },
  /** Bridges the collapsed sheet (h=0) and tab strip so vertical pans always have a hit target. */
  sheetSeamGrabBridge: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: SHEET_SEAM_GRAB_HEIGHT,
    zIndex: 40,
    backgroundColor: "transparent"
  },
  gestureHost: {
    flex: 1,
    width: "100%",
    position: "relative",
    zIndex: 32,
    justifyContent: "flex-start",
    paddingHorizontal: TAB_EDGE_INSET_H,
    paddingTop: TAB_STRIP_PAD_ABOVE_TABS,
    paddingBottom: TAB_STRIP_PAD_BELOW_TABS,
    ...hairline,
    ...Platform.select({
      android: { elevation: 34 },
      default: {}
    })
  },
  tabGestureSizer: {
    flex: 1,
    minHeight: 0,
    alignSelf: "stretch",
    width: "100%"
  },
  tabSwipeArea: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    justifyContent: "center",
    position: "relative",
    overflow: "visible"
  },
  liquidPill: {
    position: "absolute",
    left: 0,
    top: PILL_INSET,
    bottom: PILL_INSET,
    borderRadius: 22,
    overflow: "hidden",
    zIndex: 0,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 }
      },
      default: {}
    })
  },
  pillFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22
  },
  pillGlassBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 2
  },
  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "stretch",
    minHeight: 48,
    paddingHorizontal: 6,
    position: "relative",
    zIndex: 4,
    overflow: "visible",
    gap: 3
  },
  tabItem: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 0,
    borderRadius: 13,
    overflow: "visible",
    marginHorizontal: 2
  },
  tabGlyphWrap: {
    width: ME_AVATAR_TAB_SIZE,
    height: ME_AVATAR_TAB_SIZE,
    alignItems: "center",
    justifyContent: "center"
  },
  tabBadge: {
    position: "absolute",
    top: -2,
    right: -8,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: "#DC2626",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  tabBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
    lineHeight: 11
  },
  /** Book tab — same purple pill + white ring as `CartFABPopup` badge. */
  tabBadgeCart: {
    position: "absolute",
    top: -6,
    right: -10,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: R.accentPurple,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.95)"
  },
  tabBadgeCartText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 12
  },
  pressed: { opacity: 0.88 }
});
