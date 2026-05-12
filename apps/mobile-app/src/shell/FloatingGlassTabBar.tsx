import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import React from "react";
import { Keyboard, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from "react-native-reanimated";
import type { EdgeInsets } from "react-native-safe-area-context";
import {
  FLOATING_TAB_BAR_HEIGHT,
  FLOAT_MARGIN_BOTTOM,
  FLOAT_MARGIN_SIDE,
  contentBottomInset
} from "./navBottomMetrics";
import {
  NavIconAccount,
  NavIconBookings,
  NavIconHome,
  NavIconMessages,
  NavIconOrdersMark
} from "./NavTabIcons";
import { FLOATING_TOP_BAR_HEIGHT, FLOATING_TOP_GAP } from "./FloatingTopBar";
import { computeNavSheetSnapDims, useNavSheetPanGestures } from "./NavExpandSheet";
import { R } from "../theme";

export type TabId = "home" | "bookings" | "orders" | "messages" | "account";

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: "home", label: "Home" },
  { id: "bookings", label: "Book" },
  { id: "orders", label: "Orders" },
  { id: "messages", label: "Chat" },
  { id: "account", label: "Profile" }
];

const SPRING = { damping: 24, stiffness: 340, mass: 0.82 };
const PILL_INSET = 3;
const ICON_SIZE = 24;
/** Keeps tab press ripple / hit area inset from outer purple chrome (horizontal padding on strip). */
const TAB_EDGE_INSET_H = 10;
/** Space between seam dash zone and interactive row (ripple must not creep into dash). */
const TAB_STRIP_PAD_ABOVE_TABS = 14;
/** Space between tab row zone and inner bottom corners of purple chrome. */
const TAB_STRIP_PAD_BELOW_TABS = 14;
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
  sheetContent?: React.ReactNode;
  /** Home: user dragged sheet open from collapsed — enables cart panel for this open cycle. */
  onSheetDragOpenFromCollapsed?: () => void;
  /** When true, sheet is in search/discovery mode and must only settle at full or closed (no half detent). */
  sheetFullOnly?: boolean;
};

function TabGlyph({ id, color }: { id: TabId; color: string }) {
  switch (id) {
    case "home":
      return <NavIconHome size={ICON_SIZE} color={color} />;
    case "bookings":
      return <NavIconBookings size={ICON_SIZE} color={color} />;
    case "orders":
      return <NavIconOrdersMark size={ICON_SIZE} color={color} />;
    case "messages":
      return <NavIconMessages size={ICON_SIZE} color={color} />;
    case "account":
      return <NavIconAccount size={ICON_SIZE} color={color} />;
    default:
      return null;
  }
}

export function FloatingGlassTabBar({
  tab,
  onChange,
  insets,
  sheetHeightSV,
  sheetContent,
  onSheetDragOpenFromCollapsed,
  sheetFullOnly
}: Props) {
  const { height: screenH } = useWindowDimensions();

  const { panVerticalOnSheetBody, panVerticalSeamGrab, panVerticalWithTabsDuplicate, sheetPanDragSessionSV } =
    useNavSheetPanGestures(insets, sheetHeightSV, {
      onUserDragFromCollapsed: onSheetDragOpenFromCollapsed,
      allowHalfDetent: !sheetFullOnly
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

  const rowW = useSharedValue(0);
  const pillX = useSharedValue(0);
  const startPillX = useSharedValue(0);

  const tabIndex = React.useMemo(() => Math.max(0, TABS.findIndex((t) => t.id === tab)), [tab]);
  const tabRef = React.useRef(tab);
  tabRef.current = tab;

  const finishPan = React.useCallback(
    (index: number) => {
      const id = TABS[index]?.id;
      if (!id || id === tabRef.current) return;
      onChange(id);
      void Haptics.selectionAsync();
    },
    [onChange]
  );

  React.useEffect(() => {
    const seg = rowW.value / TABS.length;
    if (seg <= 0 || !Number.isFinite(seg)) return;
    pillX.value = withSpring(tabIndex * seg, SPRING);
  }, [tab, tabIndex, pillX]);

  const handleRowLayout = React.useCallback(
    (w: number) => {
      rowW.value = w;
      const seg = w / TABS.length;
      if (seg > 0) {
        pillX.value = withSpring(tabIndex * seg, SPRING);
      }
    },
    [rowW, pillX, tabIndex]
  );

  const panTabExclusive = React.useMemo(
    () =>
      Gesture.Exclusive(
        panVerticalWithTabsDuplicate,
        Gesture.Pan()
          .activeOffsetX([-12, 12])
          .failOffsetY([-20, 20])
          .onBegin(() => {
            startPillX.value = pillX.value;
          })
          .onUpdate((e) => {
            const seg = rowW.value / TABS.length;
            if (seg <= 0) return;
            const maxX = (TABS.length - 1) * seg;
            const next = startPillX.value + e.translationX;
            pillX.value = Math.max(0, Math.min(maxX, next));
          })
          .onEnd(() => {
            const seg = rowW.value / TABS.length;
            if (seg <= 0) return;
            const idx = Math.round(pillX.value / seg);
            const clamped = Math.max(0, Math.min(TABS.length - 1, idx));
            pillX.value = withSpring(clamped * seg, SPRING);
            runOnJS(finishPan)(clamped);
          })
      ),
    [panVerticalWithTabsDuplicate, pillX, rowW, finishPan, startPillX]
  );

  const pillAnimatedStyle = useAnimatedStyle(() => {
    const seg = rowW.value / TABS.length;
    const w = Math.max(0, seg - PILL_INSET * 2);
    return {
      width: w,
      transform: [{ translateX: pillX.value + PILL_INSET }]
    };
  });

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
    const w = rowW.value;
    const seg = w / TABS.length;
    if (seg > 0) {
      pillX.value = withSpring(index * seg, SPRING);
    }
    onChange(id);
    void Haptics.selectionAsync();
  };

  const colorsFor = (t: (typeof TABS)[number], selected: boolean) => {
    if (t.id === "orders") {
      return {
        icon: selected ? R.ordersNavPurpleBright : R.ordersNavPurple,
        label: selected ? R.ordersNavPurpleBright : R.ordersNavPurple
      };
    }
    if (selected) {
      return { icon: R.accentPurple, label: R.text };
    }
    return { icon: R.navIconIdle, label: R.navLabelIdle };
  };

  return (
    <View pointerEvents="box-none" style={styles.screenAnchor}>
      <Animated.View style={[styles.chromeShell, animatedShellStyle]}>
        <BlurView
          pointerEvents="box-none"
          intensity={Platform.OS === "ios" ? 92 : Platform.OS === "android" ? 50 : 70}
          tint={Platform.OS === "ios" ? "systemChromeMaterialLight" : "light"}
          blurReductionFactor={Platform.OS === "android" ? 3.2 : undefined}
          style={styles.blurFill}
          {...(Platform.OS === "android" ? ({ experimentalBlurMethod: "dimezisBlurView" } as const) : {})}
        >
          {Platform.OS === "android" ? <View style={styles.androidFallbackFill} pointerEvents="none" /> : null}

          <View style={styles.chromeColumn} accessibilityRole="adjustable" accessibilityLabel="Bottom navigation and panels">
            <GestureDetector gesture={panVerticalOnSheetBody}>
              <Animated.View
                collapsable={false}
                style={[styles.sheetPanel, sheetPanelStyle]}
                pointerEvents="auto"
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
                  <GestureDetector gesture={panTabExclusive}>
                    <View style={styles.tabSwipeArea}>
                      <Animated.View style={[styles.liquidPill, pillAnimatedStyle]} pointerEvents="none">
                        <View style={styles.pillFill} />
                        <View style={styles.pillGlassBorder} />
                      </Animated.View>

                      <View
                      style={styles.tabRow}
                      onLayout={(e) => handleRowLayout(e.nativeEvent.layout.width)}
                    >
                      {TABS.map((t, index) => {
                        const selected = tab === t.id;
                        const { icon, label: labelColor } = colorsFor(t, selected);
                        const labelWeight: "600" | "800" | "900" =
                          t.id === "orders" ? "900" : selected ? "800" : "600";
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
                                    radius: 22
                                  }
                                : undefined
                            }
                            onPress={() => onTabPress(t.id, index)}
                          >
                            <View style={styles.tabGlyphWrap}>
                              <TabGlyph id={t.id} color={icon} />
                            </View>
                            <Text
                              style={[styles.tabLabel, { color: labelColor, fontWeight: labelWeight }]}
                              numberOfLines={1}
                            >
                              {t.label}
                            </Text>
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
    top: -14,
    left: 0,
    right: 0,
    height: SHEET_SEAM_GRAB_HEIGHT,
    zIndex: 30,
    backgroundColor: "transparent"
  },
  gestureHost: {
    flex: 1,
    width: "100%",
    position: "relative",
    justifyContent: "flex-start",
    paddingHorizontal: TAB_EDGE_INSET_H,
    paddingTop: TAB_STRIP_PAD_ABOVE_TABS,
    paddingBottom: TAB_STRIP_PAD_BELOW_TABS,
    ...hairline
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
    position: "relative"
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
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.14,
        shadowRadius: 10
      },
      android: { elevation: 3 },
      default: {}
    })
  },
  pillFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    backgroundColor:
      Platform.OS === "ios" ? "rgba(255,255,255,0.68)" : "rgba(255,255,255,0.78)"
  },
  pillGlassBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "rgba(139,92,246,0.52)"
  },
  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "stretch",
    minHeight: 44,
    paddingHorizontal: 6,
    position: "relative",
    zIndex: 2,
    overflow: "hidden",
    gap: 3
  },
  tabItem: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 3,
    paddingHorizontal: 0,
    borderRadius: 13,
    overflow: "hidden",
    marginHorizontal: 2,
    marginTop: 2,
    marginBottom: 2
  },
  tabGlyphWrap: {
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3
  },
  tabLabel: {
    fontSize: 13,
    letterSpacing: 0.12,
    textAlign: "center",
    width: "100%"
  },
  pressed: { opacity: 0.88 }
});
