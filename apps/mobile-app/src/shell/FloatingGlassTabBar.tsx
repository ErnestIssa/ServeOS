import * as Haptics from "expo-haptics";
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type ViewStyle
} from "react-native";
import { Gesture, GestureDetector, Pressable } from "react-native-gesture-handler";
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
import type { EdgeInsets } from "react-native-safe-area-context";
import {
  FLOATING_TAB_BAR_HEIGHT,
  FLOAT_MARGIN_BOTTOM,
  FLOAT_MARGIN_SIDE,
  contentBottomInset,
  floatingDockBottomY
} from "./navBottomMetrics";
import { navDockGlassTokens } from "./navDockGlass";
import { LiquidGlassChrome } from "./LiquidGlassChrome";
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

/** Smooth spring for selection pill — liquid glass feel. */
const PILL_SPRING = { damping: 20, stiffness: 260, mass: 0.62 };
const PILL_MOVE_MS = 300;
const PILL_DRAG_SNAP_MS = 260;
const PILL_EASE = Easing.bezier(0.22, 1, 0.36, 1);
const PILL_DRAG_EASE = Easing.out(Easing.cubic);
const PILL_LIFT_MS = 200;
const PILL_LIFT_SCALE = 1.08;
const PILL_LIFT_RISE_Y = -3;
const PILL_DRAG_MIN_DISTANCE = 4;
const PILL_LIFT_TRANSLATION_X = 4;
const PILL_INSET = 4;
const TAB_INDEX_INPUT = [0, 1, 2, 3, 4] as const;
const ICON_SIZE = 24;
const DOCK_RADIUS = 999;

function clampPillProgress(n: number, maxIndex: number): number {
  "worklet";
  return Math.min(maxIndex, Math.max(0, n));
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
const ME_AVATAR_TAB_SIZE = 32;
const TAB_EDGE_INSET_H = 6;
const TAB_STRIP_PAD_V = 4;

export { FLOATING_TAB_BAR_HEIGHT, FLOAT_MARGIN_BOTTOM, FLOAT_MARGIN_SIDE, contentBottomInset };

type Props = {
  tab: TabId;
  onChange: (t: TabId) => void;
  insets: EdgeInsets;
  /** 1 = expanded dock; animates down while content scrolls. */
  navFocusSV?: SharedValue<number>;
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
  navFocusSV: navFocusProp,
  messagesUnreadCount = 0,
  ordersActiveCount = 0,
  bookingsUpcomingCount = 0,
  meAvatarUri = null,
  navTabs
}: Props) {
  const fallbackFocusSV = useSharedValue(1);
  const navFocusSV = navFocusProp ?? fallbackFocusSV;
  const visibleTabs = React.useMemo((): ReadonlyArray<NavTabItem> => {
    if (navTabs?.length) {
      return navTabs.map((t) => ({ id: t.key, label: t.label, icon: t.icon }));
    }
    return FALLBACK_CUSTOMER_TABS;
  }, [navTabs]);
  const tabCount = visibleTabs.length;
  const tabLastIndex = Math.max(0, tabCount - 1);

  const { isDark, colors: theme } = useAppTheme();
  const glass = React.useMemo(() => navDockGlassTokens(isDark), [isDark]);
  const dockBottom = floatingDockBottomY(insets.bottom);

  const { centers: tabCenters, widths: tabWidths } = useTabStopLayout();
  const pillProgress = useSharedValue(0);
  const pillLiftSV = useSharedValue(0);
  const dragStartProgress = useSharedValue(0);
  const lastPillTabIndex = useSharedValue(0);
  const pillDragDidMoveSV = useSharedValue(0);
  const tabIndexSV = useSharedValue(0);
  const tabLastIndexSV = useSharedValue(tabLastIndex);
  const tabRowWidthSV = useSharedValue(0);
  const tabIndex = React.useMemo(
    () => Math.max(0, visibleTabs.findIndex((t) => t.id === tab)),
    [tab, visibleTabs]
  );

  React.useLayoutEffect(() => {
    tabIndexSV.value = tabIndex;
    tabLastIndexSV.value = tabLastIndex;
  }, [tabIndex, tabIndexSV, tabLastIndex, tabLastIndexSV]);

  const tabRef = React.useRef(tab);
  tabRef.current = tab;
  const pillDragActiveRef = React.useRef(false);

  const resetPillLift = React.useCallback(() => {
    cancelAnimation(pillLiftSV);
    pillLiftSV.value = withTiming(0, { duration: PILL_LIFT_MS, easing: PILL_DRAG_EASE });
  }, [pillLiftSV]);

  const snapPillTo = React.useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(tabLastIndex, index));
      lastPillTabIndex.value = clamped;
      cancelAnimation(pillLiftSV);
      pillLiftSV.value = 0;
      pillProgress.value = withSpring(clamped, PILL_SPRING);
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
      .activeOffsetX([-6, 6])
      .failOffsetY([-18, 18]);

    pan.onBegin(() => {
      "worklet";
      dragStartProgress.value = pillProgress.value;
      lastPillTabIndex.value = Math.round(pillProgress.value);
      pillDragDidMoveSV.value = 0;
      runOnJS(setPillDragActive)(true);
    });

    pan.onUpdate((event) => {
      "worklet";
      const lastIdx = tabLastIndexSV.value;
      const range = tabCenters[lastIdx].value - tabCenters[0].value;
      if (range <= 1) return;

      if (Math.abs(event.translationX) >= PILL_LIFT_TRANSLATION_X) {
        pillDragDidMoveSV.value = 1;
        if (pillLiftSV.value < 0.02) {
          cancelAnimation(pillLiftSV);
          pillLiftSV.value = withTiming(1, { duration: PILL_LIFT_MS, easing: PILL_EASE });
        }
      }

      const next = dragStartProgress.value + (event.translationX / range) * lastIdx;
      pillProgress.value = clampPillProgress(next, lastIdx);
      const idx = Math.round(pillProgress.value);
      const clamped = Math.max(0, Math.min(lastIdx, idx));
      if (clamped !== lastPillTabIndex.value) {
        lastPillTabIndex.value = clamped;
        runOnJS(fireTabCrossHaptic)();
      }
    });

    pan.onEnd(() => {
      "worklet";
      cancelAnimation(pillLiftSV);
      pillLiftSV.value = withTiming(0, { duration: PILL_LIFT_MS, easing: PILL_DRAG_EASE });

      const lastIdx = tabLastIndexSV.value;

      if (pillDragDidMoveSV.value < 0.5) {
        const home = Math.max(0, Math.min(lastIdx, tabIndexSV.value));
        pillProgress.value = withTiming(home, { duration: PILL_DRAG_SNAP_MS, easing: PILL_DRAG_EASE });
        runOnJS(setPillDragActive)(false);
        return;
      }

      const clamped = Math.max(0, Math.min(lastIdx, Math.round(pillProgress.value)));
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
    tabIndexSV,
    tabLastIndexSV
  ]);

  const panTabRowWithPress = React.useMemo(
    () => Gesture.Exclusive(panTabRow, Gesture.Native()),
    [panTabRow]
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
    const lastIdx = Math.min(4, Math.max(0, tabLastIndexSV.value));
    const fallbackSeg = rowW > 0 ? rowW / Math.max(1, tabCount) : 64;
    const wSafe = w > 8 ? w : fallbackSeg;
    const rangeOk = tabCenters[lastIdx].value - tabCenters[0].value > 8;
    const xSafe = rangeOk
      ? x
      : rowW > 0
        ? 6 + (pillProgress.value + 0.5) * Math.max(0, rowW - 12) / Math.max(1, tabCount)
        : 0;
    const pillW = Math.max(36, wSafe - PILL_INSET * 2);
    const lift = pillLiftSV.value;
    const atRest = lift < 0.001;
    const focus = navFocusSV.value;
    const focusScale = interpolate(focus, [0, 1], [0.9, 1], Extrapolation.CLAMP);
    const dragScale = atRest ? 1 : interpolate(lift, [0, 1], [1, PILL_LIFT_SCALE]);
    const scale = focusScale * dragScale;
    const liftY = atRest ? 0 : interpolate(lift, [0, 1], [0, PILL_LIFT_RISE_Y]);
    const tx = xSafe - wSafe / 2;
    const translateX = atRest ? Math.round(tx) : tx;
    return {
      width: pillW * focusScale,
      zIndex: atRest ? 1 : 10,
      shadowOpacity: atRest ? 0.14 : interpolate(lift, [0, 1], [0.14, 0.28]),
      shadowRadius: atRest ? 8 : interpolate(lift, [0, 1], [8, 16]),
      elevation: atRest ? 3 : interpolate(lift, [0, 1], [3, 10]),
      transform: [{ translateX }, { translateY: liftY }, { scale }]
    };
  });

  const pillFillStyle = React.useMemo(
    () => ({ backgroundColor: glass.pillBg, borderColor: glass.pillBorder }),
    [glass.pillBg, glass.pillBorder]
  );

  const dockShellStyle = useAnimatedStyle(() => {
    const focus = navFocusSV.value;
    const scale = interpolate(focus, [0, 1], [0.94, 1], Extrapolation.CLAMP);
    const opacity = interpolate(focus, [0, 1], [0.8, 1], Extrapolation.CLAMP);
    const height = interpolate(focus, [0, 1], [FLOATING_TAB_BAR_HEIGHT - 6, FLOATING_TAB_BAR_HEIGHT], Extrapolation.CLAMP);
    return {
      transform: [{ scale }],
      opacity,
      height
    };
  });

  const onTabPress = (id: TabId, index: number) => {
    navFocusSV.value = withSpring(1, PILL_SPRING);
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
      <Animated.View
        style={[
          styles.chromeShell,
          dockShellStyle,
          {
            bottom: dockBottom,
            left: FLOAT_MARGIN_SIDE,
            right: FLOAT_MARGIN_SIDE,
            shadowColor: glass.shadowColor,
            shadowOpacity: glass.shadowOpacity
          }
        ]}
      >
        <LiquidGlassChrome
          tokens={glass}
          variant="shell"
          borderRadius={DOCK_RADIUS}
          focusSV={navFocusSV}
        />

        <View style={styles.tabStrip} accessibilityRole="tablist">
          <View style={styles.gestureHost}>
            <View style={styles.tabGestureSizer}>
              <GestureDetector gesture={panTabRowWithPress}>
                <View style={styles.tabSwipeArea}>
                  <Animated.View style={[styles.selectionPill, pillAnimatedStyle]} pointerEvents="none" collapsable={false}>
                    <View style={[styles.selectionPillFill, pillFillStyle]} />
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
                                  color: "rgba(255,255,255,0.12)",
                                  foreground: false,
                                  borderless: false,
                                  radius: 22
                                }
                              : undefined
                          }
                          onLayout={onTabItemLayout(index)}
                          onPress={() => onTabPress(t.id, index)}
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
        </View>
      </Animated.View>
    </View>
  );
}

/** Web: suppress focus ring hugging the chrome */
const webTabPressNoOutline: ViewStyle = Platform.OS === "web" ? { outlineWidth: 0 } : {};

const styles = StyleSheet.create({
  screenAnchor: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 22,
    pointerEvents: "box-none"
  },
  chromeShell: {
    position: "absolute",
    overflow: "hidden",
    borderRadius: DOCK_RADIUS,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 14 },
        shadowRadius: 28
      },
      android: { elevation: 16 },
      default: {}
    })
  },
  tabStrip: {
    flex: 1,
    height: FLOATING_TAB_BAR_HEIGHT,
    minHeight: FLOATING_TAB_BAR_HEIGHT
  },
  gestureHost: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    paddingHorizontal: TAB_EDGE_INSET_H,
    paddingVertical: TAB_STRIP_PAD_V
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
  selectionPill: {
    position: "absolute",
    left: 0,
    top: PILL_INSET,
    bottom: PILL_INSET,
    borderRadius: DOCK_RADIUS,
    overflow: "hidden",
    zIndex: 0
  },
  selectionPillFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: DOCK_RADIUS,
    borderWidth: StyleSheet.hairlineWidth
  },
  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "stretch",
    minHeight: 42,
    paddingHorizontal: 4,
    position: "relative",
    zIndex: 4,
    overflow: "visible"
  },
  tabItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    borderRadius: DOCK_RADIUS,
    overflow: "visible"
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
