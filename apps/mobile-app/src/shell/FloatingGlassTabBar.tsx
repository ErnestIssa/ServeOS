import React from "react";
import {
  AppState,
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
  withTiming
} from "react-native-reanimated";
import type { EdgeInsets } from "react-native-safe-area-context";
import {
  FLOATING_TAB_BAR_HEIGHT,
  FLOAT_MARGIN_BOTTOM,
  FLOATING_TAB_BAR_MARGIN_SIDE,
  contentBottomInset,
  floatingDockBottomY
} from "./navBottomMetrics";
import {
  BOTTOM_NAV_FOCUS_TIMING,
  BOTTOM_NAV_MIN_SCALE,
  BOTTOM_NAV_PRESS_SCALE,
  BOTTOM_NAV_PRESS_TIMING
} from "./navBottomFocus";
import { navBottomDockGlassTokens, NAV_BOTTOM_DOCK_SHELL_BG } from "./navDockGlass";
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

const PILL_MOVE_MS = 280;
const PILL_DRAG_SNAP_MS = 260;
/** Single easing curve for tap and drag snap — consistent speed at any distance. */
const PILL_EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const PILL_DRAG_EASE = Easing.out(Easing.cubic);
const PILL_LIFT_MS = 200;
const PILL_DRAG_MIN_DISTANCE = 4;
const PILL_LIFT_TRANSLATION_X = 4;
const ICON_SIZE = 27;
const DOCK_RADIUS = 999;
/** Gray capsule behind the active tab — nearly full dock height. */
const PICKER_COLOR = "#a8a8a8";
/** Tiny gap between picker and nav shell (top/bottom/edge tabs). */
const PICKER_SHELL_INSET_V = 3;
const PICKER_SHELL_INSET_H = 3;
/** Small gap between picker and neighboring tab centers (wider = more rectangular). */
const PICKER_INNER_GAP = 2;

function pickerShapeWidth(
  rowW: number,
  lastIdx: number,
  cx0: number,
  cw0: number,
  cxLast: number,
  cwLast: number,
  shellPad: number,
  shellEdgeGap: number,
  innerGap: number
): number {
  "worklet";
  const shellEdgeTx = -shellPad + shellEdgeGap;
  const fromFirst = cx0 + cw0 * 0.5 - innerGap - shellEdgeTx;
  const lastTx = cxLast - cwLast * 0.5 + innerGap;
  const fromLast = rowW + shellPad - shellEdgeGap - lastTx;
  return Math.max(36, fromFirst, fromLast);
}

function pickerLayoutAtIndex(
  index: number,
  lastIdx: number,
  rowW: number,
  cx: number,
  cw: number,
  shellPad: number,
  shellEdgeGap: number,
  innerGap: number,
  shapeW: number
): { tx: number; w: number } {
  "worklet";
  if (index <= 0) {
    return { tx: -shellPad + shellEdgeGap, w: shapeW };
  }
  if (index >= lastIdx) {
    return { tx: rowW + shellPad - shellEdgeGap - shapeW, w: shapeW };
  }
  return { tx: cx - shapeW * 0.5, w: shapeW };
}

function clampTranslateX(tx: number, minTx: number, maxTx: number): number {
  "worklet";
  return Math.min(maxTx, Math.max(minTx, tx));
}

function resolvePickerLayout(
  index: number,
  lastIdx: number,
  rowW: number,
  c0: number,
  c1: number,
  c2: number,
  c3: number,
  c4: number,
  w0: number,
  w1: number,
  w2: number,
  w3: number,
  w4: number,
  shellPad: number
): { tx: number; w: number } {
  "worklet";
  const centers = [c0, c1, c2, c3, c4];
  const widths = [w0, w1, w2, w3, w4];
  const i = Math.max(0, Math.min(lastIdx, index));
  const shapeW = pickerShapeWidth(
    rowW,
    lastIdx,
    c0,
    w0,
    centers[lastIdx],
    widths[lastIdx],
    shellPad,
    PICKER_SHELL_INSET_H,
    PICKER_INNER_GAP
  );
  return pickerLayoutAtIndex(
    i,
    lastIdx,
    rowW,
    centers[i],
    widths[i],
    shellPad,
    PICKER_SHELL_INSET_H,
    PICKER_INNER_GAP,
    shapeW
  );
}

function nearestTabIndexForTranslateX(
  tx: number,
  lastIdx: number,
  rowW: number,
  c0: number,
  c1: number,
  c2: number,
  c3: number,
  c4: number,
  w0: number,
  w1: number,
  w2: number,
  w3: number,
  w4: number,
  shellPad: number
): number {
  "worklet";
  let nearest = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i <= lastIdx; i++) {
    const layout = resolvePickerLayout(i, lastIdx, rowW, c0, c1, c2, c3, c4, w0, w1, w2, w3, w4, shellPad);
    const dist = Math.abs(layout.tx - tx);
    if (dist < bestDist) {
      bestDist = dist;
      nearest = i;
    }
  }
  return nearest;
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
const ME_AVATAR_TAB_SIZE = 35;
const TAB_EDGE_INSET_H = 6;
const TAB_STRIP_PAD_V = PICKER_SHELL_INSET_V;
const PICKER_HEIGHT = FLOATING_TAB_BAR_HEIGHT - PICKER_SHELL_INSET_V * 2;
/** Matches inner curvature of the nav shell on the left/right ends. */
const PICKER_EDGE_END_RADIUS = PICKER_HEIGHT / 2;

export {
  FLOATING_TAB_BAR_HEIGHT,
  FLOAT_MARGIN_BOTTOM,
  FLOATING_TAB_BAR_MARGIN_SIDE,
  contentBottomInset
};

type Props = {
  tab: TabId;
  onChange: (t: TabId) => void;
  insets: EdgeInsets;
  /** 1 = full emphasis; 0 = scrolled-down compact scale. */
  bottomNavFocusSV?: SharedValue<number>;
  /** Tap anywhere on the dock chrome (non-tab) to restore full size. */
  onDockPress?: () => void;
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
  bottomNavFocusSV: bottomNavFocusProp,
  onDockPress,
  messagesUnreadCount = 0,
  ordersActiveCount = 0,
  bookingsUpcomingCount = 0,
  meAvatarUri = null,
  navTabs
}: Props) {
  const fallbackFocusSV = useSharedValue(1);
  const bottomNavFocusSV = bottomNavFocusProp ?? fallbackFocusSV;
  const visibleTabs = React.useMemo((): ReadonlyArray<NavTabItem> => {
    if (navTabs?.length) {
      return navTabs.map((t) => ({ id: t.key, label: t.label, icon: t.icon }));
    }
    return FALLBACK_CUSTOMER_TABS;
  }, [navTabs]);
  const tabCount = visibleTabs.length;
  const tabLastIndex = Math.max(0, tabCount - 1);

  const { isDark } = useAppTheme();
  const glass = React.useMemo(() => navBottomDockGlassTokens(isDark), [isDark]);
  const dockBottom = floatingDockBottomY(insets.bottom);
  const bottomNavIconColor = React.useCallback((_tabItem: NavTabItem, selected: boolean) => {
    if (selected) return "#FFFFFF";
    return "rgba(255, 255, 255, 0.58)";
  }, []);

  const { centers: tabCenters, widths: tabWidths } = useTabStopLayout();
  const pillTranslateX = useSharedValue(0);
  const pillWidthSV = useSharedValue(36);
  const pillAnimTargetSV = useSharedValue(0);
  const pillInMotionSV = useSharedValue(0);
  const pillDraggingSV = useSharedValue(0);
  const pillLiftSV = useSharedValue(0);
  const dragStartTranslateX = useSharedValue(0);
  const lastPillTabIndex = useSharedValue(0);
  const pillDragDidMoveSV = useSharedValue(0);
  const tabIndexSV = useSharedValue(0);
  const tabLastIndexSV = useSharedValue(tabLastIndex);
  const tabRowWidthSV = useSharedValue(0);
  const tabIndex = React.useMemo(() => {
    const idx = visibleTabs.findIndex((t) => t.id === tab);
    if (idx >= 0) return idx;
    const homeIdx = visibleTabs.findIndex((t) => t.id === "home");
    if (homeIdx >= 0) return homeIdx;
    return 0;
  }, [tab, visibleTabs]);

  const bottomNavPressSV = useSharedValue(1);
  const tabRef = React.useRef(tab);
  tabRef.current = tab;
  const tabIndexRef = React.useRef(tabIndex);
  tabIndexRef.current = tabIndex;
  const pillDragActiveRef = React.useRef(false);
  const pillAnimatingRef = React.useRef(false);
  const pendingCommitIndexRef = React.useRef<number | null>(null);

  React.useLayoutEffect(() => {
    tabIndexSV.value = tabIndex;
    tabLastIndexSV.value = tabLastIndex;
    tabIndexRef.current = tabIndex;
    lastPillTabIndex.value = tabIndex;
    pillAnimTargetSV.value = tabIndex;
  }, [tabIndex, tabIndexSV, tabLastIndex, tabLastIndexSV, lastPillTabIndex, pillAnimTargetSV]);

  const beginNavPress = React.useCallback(() => {
    cancelAnimation(bottomNavPressSV);
    bottomNavPressSV.value = withTiming(BOTTOM_NAV_PRESS_SCALE, BOTTOM_NAV_PRESS_TIMING);
  }, [bottomNavPressSV]);

  const endNavPress = React.useCallback(() => {
    cancelAnimation(bottomNavPressSV);
    bottomNavPressSV.value = withTiming(1, BOTTOM_NAV_PRESS_TIMING);
  }, [bottomNavPressSV]);

  const getPickerLayout = React.useCallback(
    (index: number) => {
      const rowW = tabRowWidthSV.value;
      const lastIdx = tabLastIndex;
      const shellPad = TAB_EDGE_INSET_H;
      return resolvePickerLayout(
        index,
        lastIdx,
        rowW,
        tabCenters[0].value,
        tabCenters[1].value,
        tabCenters[2].value,
        tabCenters[3].value,
        tabCenters[4].value,
        tabWidths[0].value,
        tabWidths[1].value,
        tabWidths[2].value,
        tabWidths[3].value,
        tabWidths[4].value,
        shellPad
      );
    },
    [tabCenters, tabLastIndex, tabRowWidthSV, tabWidths]
  );

  const clearPillAnimating = React.useCallback(() => {
    pillAnimatingRef.current = false;
  }, []);

  const commitTabSelection = React.useCallback(
    (index: number) => {
      if (pendingCommitIndexRef.current !== index) return;
      pendingCommitIndexRef.current = null;
      const id = visibleTabs[index]?.id;
      if (id && id !== tabRef.current) onChange(id);
      else pillAnimatingRef.current = false;
    },
    [onChange, visibleTabs]
  );

  const scheduleTabCommit = React.useCallback((index: number) => {
    pendingCommitIndexRef.current = index;
    pillAnimatingRef.current = true;
  }, []);

  const drivePillToRef = React.useRef<(index: number, opts?: { immediate?: boolean; durationMs?: number; commitOnComplete?: boolean }) => void>(() => {});
  const getPickerLayoutRef = React.useRef<(index: number) => { tx: number; w: number }>(() => ({ tx: 0, w: 36 }));
  const dockPickerAtIndexRef = React.useRef<(index: number) => void>(() => {});

  const dockPickerAtIndex = React.useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(tabLastIndex, index));
      if (tabRowWidthSV.value <= 0) return;
      const target = getPickerLayout(clamped);
      cancelAnimation(pillTranslateX);
      pillTranslateX.value = target.tx;
      pillWidthSV.value = target.w;
      pillAnimTargetSV.value = clamped;
      lastPillTabIndex.value = clamped;
      pillInMotionSV.value = 0;
      pillDraggingSV.value = 0;
    },
    [
      getPickerLayout,
      lastPillTabIndex,
      pillAnimTargetSV,
      pillDraggingSV,
      pillInMotionSV,
      pillTranslateX,
      pillWidthSV,
      tabLastIndex,
      tabRowWidthSV
    ]
  );

  dockPickerAtIndexRef.current = dockPickerAtIndex;

  const syncPickerToCurrentTab = React.useCallback(
    (opts?: { force?: boolean }) => {
      if (pillDragActiveRef.current) return;
      if (
        !opts?.force &&
        pillAnimatingRef.current &&
        pendingCommitIndexRef.current !== null &&
        pendingCommitIndexRef.current !== tabIndexRef.current
      ) {
        return;
      }
      if (tabRowWidthSV.value <= 0) return;
      pillAnimTargetSV.value = tabIndexRef.current;
      dockPickerAtIndex(tabIndexRef.current);
    },
    [dockPickerAtIndex, pillAnimTargetSV, tabRowWidthSV]
  );

  const syncPickerToCurrentTabRef = React.useRef(syncPickerToCurrentTab);
  syncPickerToCurrentTabRef.current = syncPickerToCurrentTab;

  const resetPillLift = React.useCallback(() => {
    cancelAnimation(pillLiftSV);
    pillLiftSV.value = withTiming(0, { duration: PILL_LIFT_MS, easing: PILL_DRAG_EASE });
  }, [pillLiftSV]);

  const drivePillTo = React.useCallback(
    (index: number, opts?: { immediate?: boolean; durationMs?: number; commitOnComplete?: boolean }) => {
      const clamped = Math.max(0, Math.min(tabLastIndex, index));
      const target = getPickerLayout(clamped);
      pillAnimTargetSV.value = clamped;
      lastPillTabIndex.value = clamped;
      cancelAnimation(pillLiftSV);
      pillLiftSV.value = 0;
      cancelAnimation(pillTranslateX);

      if (opts?.commitOnComplete) {
        scheduleTabCommit(clamped);
      }

      if (opts?.immediate) {
        dockPickerAtIndex(clamped);
        if (opts.commitOnComplete) {
          commitTabSelection(clamped);
        }
        return;
      }

      pillInMotionSV.value = 1;
      const duration = opts?.durationMs ?? PILL_MOVE_MS;
      const commitIndex = opts?.commitOnComplete ? clamped : -1;
      pillWidthSV.value = target.w;
      pillTranslateX.value = withTiming(
        target.tx,
        { duration, easing: PILL_EASE },
        (finished) => {
          "worklet";
          if (finished) {
            runOnJS(dockPickerAtIndex)(clamped);
            runOnJS(endNavPress)();
            if (commitIndex >= 0) {
              runOnJS(commitTabSelection)(commitIndex);
            } else {
              runOnJS(clearPillAnimating)();
            }
          }
        }
      );
    },
    [
      clearPillAnimating,
      commitTabSelection,
      dockPickerAtIndex,
      endNavPress,
      getPickerLayout,
      lastPillTabIndex,
      pillAnimTargetSV,
      pillInMotionSV,
      pillLiftSV,
      pillTranslateX,
      pillWidthSV,
      scheduleTabCommit,
      tabLastIndex
    ]
  );

  drivePillToRef.current = drivePillTo;
  getPickerLayoutRef.current = getPickerLayout;

  const setPillDragActive = React.useCallback((active: boolean) => {
    pillDragActiveRef.current = active;
  }, []);

  React.useLayoutEffect(() => {
    syncPickerToCurrentTabRef.current({ force: true });
  }, [tab, tabIndex, tabCount]);

  React.useEffect(() => {
    if (pillAnimatingRef.current && Math.round(pillAnimTargetSV.value) === tabIndex) {
      pillAnimatingRef.current = false;
      pendingCommitIndexRef.current = null;
    }
    syncPickerToCurrentTabRef.current();
  }, [tab, tabIndex, pillAnimTargetSV]);

  const handleAppForeground = React.useCallback(() => {
    pillDragActiveRef.current = false;
    pillAnimatingRef.current = false;
    pendingCommitIndexRef.current = null;
    cancelAnimation(pillTranslateX);
    cancelAnimation(pillLiftSV);
    pillLiftSV.value = 0;
    pillInMotionSV.value = 0;
    pillDraggingSV.value = 0;
    endNavPress();
    requestAnimationFrame(() => {
      syncPickerToCurrentTabRef.current({ force: true });
    });
  }, [endNavPress, pillDraggingSV, pillInMotionSV, pillLiftSV, pillTranslateX]);

  React.useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") handleAppForeground();
    });
    return () => sub.remove();
  }, [handleAppForeground]);

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
      if (pillDragActiveRef.current) return;
      if (pillAnimatingRef.current && pendingCommitIndexRef.current !== null) return;
      syncPickerToCurrentTabRef.current({ force: true });
    },
    [seedTabStopsFromRowWidth]
  );

  const onTabItemLayout = React.useCallback(
    (index: number) => (e: LayoutChangeEvent) => {
      const { x, width } = e.nativeEvent.layout;
      if (width <= 0) return;
      tabCenters[index].value = x + width / 2;
      tabWidths[index].value = width;
      if (pillDragActiveRef.current) return;
      if (pillAnimatingRef.current && pendingCommitIndexRef.current !== null) return;
      dockPickerAtIndex(tabIndexRef.current);
    },
    [dockPickerAtIndex, tabCenters, tabWidths]
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
      bottomNavFocusSV.value = withTiming(1, BOTTOM_NAV_FOCUS_TIMING);
      dragStartTranslateX.value = pillTranslateX.value;
      pillDragDidMoveSV.value = 0;
      pillDraggingSV.value = 1;
      runOnJS(beginNavPress)();
      runOnJS(setPillDragActive)(true);
    });

    pan.onUpdate((event) => {
      "worklet";
      const lastIdx = tabLastIndexSV.value;
      const rowW = tabRowWidthSV.value;
      const shellPad = TAB_EDGE_INSET_H;
      const c0 = tabCenters[0].value;
      const c1 = tabCenters[1].value;
      const c2 = tabCenters[2].value;
      const c3 = tabCenters[3].value;
      const c4 = tabCenters[4].value;
      const w0 = tabWidths[0].value;
      const w1 = tabWidths[1].value;
      const w2 = tabWidths[2].value;
      const w3 = tabWidths[3].value;
      const w4 = tabWidths[4].value;
      const first = resolvePickerLayout(0, lastIdx, rowW, c0, c1, c2, c3, c4, w0, w1, w2, w3, w4, shellPad);
      const last = resolvePickerLayout(lastIdx, lastIdx, rowW, c0, c1, c2, c3, c4, w0, w1, w2, w3, w4, shellPad);
      if (last.tx - first.tx <= 1) return;

      if (Math.abs(event.translationX) >= PILL_LIFT_TRANSLATION_X) {
        pillDragDidMoveSV.value = 1;
        if (pillLiftSV.value < 0.02) {
          cancelAnimation(pillLiftSV);
          pillLiftSV.value = withTiming(1, { duration: PILL_LIFT_MS, easing: PILL_EASE });
        }
      }

      pillTranslateX.value = clampTranslateX(
        dragStartTranslateX.value + event.translationX,
        first.tx,
        last.tx
      );
    });

    pan.onEnd(() => {
      "worklet";
      cancelAnimation(pillLiftSV);
      pillLiftSV.value = withTiming(0, { duration: PILL_LIFT_MS, easing: PILL_DRAG_EASE });

      const lastIdx = tabLastIndexSV.value;
      const rowW = tabRowWidthSV.value;
      const shellPad = TAB_EDGE_INSET_H;
      const c0 = tabCenters[0].value;
      const c1 = tabCenters[1].value;
      const c2 = tabCenters[2].value;
      const c3 = tabCenters[3].value;
      const c4 = tabCenters[4].value;
      const w0 = tabWidths[0].value;
      const w1 = tabWidths[1].value;
      const w2 = tabWidths[2].value;
      const w3 = tabWidths[3].value;
      const w4 = tabWidths[4].value;

      if (pillDragDidMoveSV.value < 0.5) {
        const home = Math.max(0, Math.min(lastIdx, tabIndexSV.value));
        const homeLayout = resolvePickerLayout(home, lastIdx, rowW, c0, c1, c2, c3, c4, w0, w1, w2, w3, w4, shellPad);
        pillAnimTargetSV.value = home;
        cancelAnimation(pillTranslateX);
        pillWidthSV.value = homeLayout.w;
        pillDraggingSV.value = 0;
        pillInMotionSV.value = 1;
        pillTranslateX.value = withTiming(
          homeLayout.tx,
          {
            duration: PILL_DRAG_SNAP_MS,
            easing: PILL_DRAG_EASE
          },
          (finished) => {
            "worklet";
            if (finished) {
              runOnJS(dockPickerAtIndex)(home);
              runOnJS(endNavPress)();
            }
          }
        );
        runOnJS(setPillDragActive)(false);
        return;
      }

      const nearest = nearestTabIndexForTranslateX(
        pillTranslateX.value,
        lastIdx,
        rowW,
        c0,
        c1,
        c2,
        c3,
        c4,
        w0,
        w1,
        w2,
        w3,
        w4,
        shellPad
      );
      const target = resolvePickerLayout(nearest, lastIdx, rowW, c0, c1, c2, c3, c4, w0, w1, w2, w3, w4, shellPad);
      lastPillTabIndex.value = nearest;
      pillAnimTargetSV.value = nearest;
      pillWidthSV.value = target.w;
      cancelAnimation(pillTranslateX);
      pillDraggingSV.value = 0;
      pillInMotionSV.value = 1;
      runOnJS(scheduleTabCommit)(nearest);
      pillTranslateX.value = withTiming(
        target.tx,
        { duration: PILL_DRAG_SNAP_MS, easing: PILL_EASE },
        (finished) => {
          "worklet";
          if (finished) {
            runOnJS(dockPickerAtIndex)(nearest);
            runOnJS(endNavPress)();
            runOnJS(commitTabSelection)(nearest);
          }
        }
      );
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
    beginNavPress,
    bottomNavFocusSV,
    commitTabSelection,
    dockPickerAtIndex,
    dragStartTranslateX,
    endNavPress,
    pillAnimTargetSV,
    pillDragDidMoveSV,
    pillDraggingSV,
    pillInMotionSV,
    pillLiftSV,
    pillTranslateX,
    pillWidthSV,
    scheduleTabCommit,
    setPillDragActive,
    tabCenters,
    tabIndexSV,
    tabLastIndexSV,
    tabRowWidthSV,
    tabWidths
  ]);

  const pickerAnimatedStyle = useAnimatedStyle(() => {
    const rowW = tabRowWidthSV.value;
    const lastIdx = Math.max(0, tabLastIndexSV.value);
    const layoutReady = rowW > 8;
    const inMotion = pillInMotionSV.value > 0.5 || pillDraggingSV.value > 0.5;
    const shellPad = TAB_EDGE_INSET_H;
    const c0 = tabCenters[0].value;
    const c1 = tabCenters[1].value;
    const c2 = tabCenters[2].value;
    const c3 = tabCenters[3].value;
    const c4 = tabCenters[4].value;
    const w0 = tabWidths[0].value;
    const w1 = tabWidths[1].value;
    const w2 = tabWidths[2].value;
    const w3 = tabWidths[3].value;
    const w4 = tabWidths[4].value;

    let tx = pillTranslateX.value;
    let w = pillWidthSV.value;

    if (layoutReady && !inMotion) {
      const idx = Math.max(0, Math.min(lastIdx, Math.round(pillAnimTargetSV.value)));
      const docked = resolvePickerLayout(
        idx,
        lastIdx,
        rowW,
        c0,
        c1,
        c2,
        c3,
        c4,
        w0,
        w1,
        w2,
        w3,
        w4,
        shellPad
      );
      tx = docked.tx;
      w = docked.w;
    }

    return {
      width: w,
      opacity: layoutReady ? 1 : 0,
      transform: [{ translateX: tx }],
      borderTopLeftRadius: PICKER_EDGE_END_RADIUS,
      borderBottomLeftRadius: PICKER_EDGE_END_RADIUS,
      borderTopRightRadius: PICKER_EDGE_END_RADIUS,
      borderBottomRightRadius: PICKER_EDGE_END_RADIUS
    };
  });

  const dockShellStyle = useAnimatedStyle(() => {
    const focus = bottomNavFocusSV.value;
    const scrollScale = interpolate(focus, [0, 1], [BOTTOM_NAV_MIN_SCALE, 1], Extrapolation.CLAMP);
    const scale = scrollScale * bottomNavPressSV.value;
    const opacity = interpolate(focus, [0, 1], [0.78, 1], Extrapolation.CLAMP);
    const anchorLift = ((1 - scale) * FLOATING_TAB_BAR_HEIGHT) / 2;
    return {
      transform: [{ translateY: anchorLift }, { scale }],
      opacity
    };
  });

  const restoreDockFocus = React.useCallback(() => {
    bottomNavFocusSV.value = withTiming(1, BOTTOM_NAV_FOCUS_TIMING);
    onDockPress?.();
  }, [bottomNavFocusSV, onDockPress]);

  const tapDockGesture = React.useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        "worklet";
        bottomNavFocusSV.value = withTiming(1, BOTTOM_NAV_FOCUS_TIMING);
        if (onDockPress) runOnJS(onDockPress)();
      }),
    [bottomNavFocusSV, onDockPress]
  );

  const panTabRowWithPress = React.useMemo(
    () => Gesture.Exclusive(panTabRow, Gesture.Simultaneous(tapDockGesture, Gesture.Native())),
    [panTabRow, tapDockGesture]
  );

  const onTabPress = (id: TabId, index: number) => {
    if (id === tab) {
      restoreDockFocus();
      setTimeout(() => endNavPress(), PILL_MOVE_MS);
      return;
    }
    restoreDockFocus();
    pillDragActiveRef.current = false;
    pillDragDidMoveSV.value = 0;
    resetPillLift();
    drivePillTo(index, { commitOnComplete: true });
  };

  return (
    <View pointerEvents="box-none" style={styles.screenAnchor}>
      <Animated.View
        style={[
          styles.chromeShell,
          dockShellStyle,
          {
            bottom: dockBottom,
            left: FLOATING_TAB_BAR_MARGIN_SIDE,
            right: FLOATING_TAB_BAR_MARGIN_SIDE,
            height: FLOATING_TAB_BAR_HEIGHT,
            shadowColor: glass.shadowColor,
            shadowOpacity: glass.shadowOpacity
          }
        ]}
      >
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.dockSolidFill, { borderRadius: DOCK_RADIUS }]}
        />

        <View style={styles.tabStrip} accessibilityRole="tablist">
          <View style={styles.gestureHost}>
            <View style={styles.tabGestureSizer}>
              <GestureDetector gesture={panTabRowWithPress}>
                <View style={styles.tabSwipeArea}>
                  <View style={styles.tabRow} onLayout={onTabRowLayout}>
                    <Animated.View
                      style={[styles.selectionPicker, pickerAnimatedStyle]}
                      pointerEvents="none"
                      collapsable={false}
                    />
                    {visibleTabs.map((t, index) => {
                      const selected = tab === t.id;
                      const iconColor = bottomNavIconColor(t, selected);
                      return (
                        <Pressable
                          key={t.id}
                          accessibilityRole="tab"
                          accessibilityLabel={t.label}
                          accessibilityState={{ selected }}
                          style={[styles.tabItem, webTabPressNoOutline]}
                          onLayout={onTabItemLayout(index)}
                          onPressIn={beginNavPress}
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
    backgroundColor: NAV_BOTTOM_DOCK_SHELL_BG,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 14 },
        shadowRadius: 28
      },
      android: { elevation: 16 },
      default: {}
    })
  },
  dockSolidFill: {
    backgroundColor: NAV_BOTTOM_DOCK_SHELL_BG
  },
  tabStrip: {
    flex: 1,
    height: FLOATING_TAB_BAR_HEIGHT,
    minHeight: FLOATING_TAB_BAR_HEIGHT,
    backgroundColor: NAV_BOTTOM_DOCK_SHELL_BG
  },
  gestureHost: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    paddingHorizontal: TAB_EDGE_INSET_H,
    paddingVertical: TAB_STRIP_PAD_V,
    backgroundColor: NAV_BOTTOM_DOCK_SHELL_BG
  },
  tabGestureSizer: {
    flex: 1,
    minHeight: 0,
    alignSelf: "stretch",
    width: "100%",
    backgroundColor: NAV_BOTTOM_DOCK_SHELL_BG
  },
  tabSwipeArea: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    justifyContent: "center",
    position: "relative",
    overflow: "visible",
    backgroundColor: NAV_BOTTOM_DOCK_SHELL_BG
  },
  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "stretch",
    height: PICKER_HEIGHT,
    minHeight: PICKER_HEIGHT,
    paddingHorizontal: 4,
    position: "relative",
    zIndex: 1,
    overflow: "visible",
    backgroundColor: NAV_BOTTOM_DOCK_SHELL_BG
  },
  selectionPicker: {
    position: "absolute",
    left: 0,
    top: 0,
    height: PICKER_HEIGHT,
    backgroundColor: PICKER_COLOR,
    zIndex: 0
  },
  tabItem: {
    flex: 1,
    minWidth: 0,
    height: PICKER_HEIGHT,
    minHeight: PICKER_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
    backgroundColor: "transparent",
    zIndex: 2
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
  }
});
