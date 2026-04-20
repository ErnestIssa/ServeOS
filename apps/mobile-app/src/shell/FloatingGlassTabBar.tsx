import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from "react-native-reanimated";
import type { EdgeInsets } from "react-native-safe-area-context";
import {
  NavIconAccount,
  NavIconBookings,
  NavIconHome,
  NavIconMessages,
  NavIconOrdersMark
} from "./NavTabIcons";
import { R } from "../theme";

export type TabId = "home" | "bookings" | "orders" | "messages" | "account";

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: "home", label: "Home" },
  { id: "bookings", label: "Bookings" },
  { id: "orders", label: "Orders" },
  { id: "messages", label: "Messages" },
  { id: "account", label: "Account" }
];

const SPRING = { damping: 24, stiffness: 340, mass: 0.82 };
const PILL_INSET = 3;

/** Floating pill height + gap above home indicator (add `insets.bottom` for total clearance). */
export const FLOATING_TAB_BAR_HEIGHT = 66;
const FLOAT_MARGIN_SIDE = 10;
const FLOAT_MARGIN_BOTTOM = 8;

const ICON_SIZE = 24;

export function contentBottomInset(bottomInset: number): number {
  return R.space.lg + FLOATING_TAB_BAR_HEIGHT + FLOAT_MARGIN_BOTTOM + bottomInset;
}

type Props = {
  tab: TabId;
  onChange: (t: TabId) => void;
  insets: EdgeInsets;
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

export function FloatingGlassTabBar({ tab, onChange, insets }: Props) {
  const bottom = insets.bottom + FLOAT_MARGIN_BOTTOM;

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

  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-12, 12])
        .failOffsetY([-18, 18])
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
        }),
    [pillX, rowW, finishPan, startPillX]
  );

  const pillAnimatedStyle = useAnimatedStyle(() => {
    const seg = rowW.value / TABS.length;
    const w = Math.max(0, seg - PILL_INSET * 2);
    return {
      width: w,
      transform: [{ translateX: pillX.value + PILL_INSET }]
    };
  });

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
      <View style={[styles.floatingOuter, { left: FLOAT_MARGIN_SIDE, right: FLOAT_MARGIN_SIDE, bottom }]}>
        <BlurView
          intensity={Platform.OS === "ios" ? 92 : Platform.OS === "android" ? 50 : 70}
          tint={Platform.OS === "ios" ? "systemChromeMaterialLight" : "light"}
          blurReductionFactor={Platform.OS === "android" ? 3.2 : undefined}
          style={styles.blur}
          {...(Platform.OS === "android"
            ? ({ experimentalBlurMethod: "dimezisBlurView" } as const)
            : {})}
        >
          {Platform.OS === "android" ? <View style={styles.androidFallbackFill} /> : null}

          <GestureDetector gesture={pan}>
            <View
              style={styles.gestureHost}
              onLayout={(e) => handleRowLayout(e.nativeEvent.layout.width)}
            >
              <Animated.View style={[styles.liquidPill, pillAnimatedStyle]} pointerEvents="none">
                <View style={styles.pillFill} />
                <View style={styles.pillGlassBorder} />
              </Animated.View>

              <View style={styles.tabRow}>
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
                      style={({ pressed }) => [styles.tabItem, pressed && styles.pressed]}
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
        </BlurView>
      </View>
    </View>
  );
}

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
  floatingOuter: {
    position: "absolute",
    borderRadius: 28,
    overflow: "hidden",
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
  blur: {
    borderRadius: 28,
    overflow: "hidden",
    minHeight: FLOATING_TAB_BAR_HEIGHT
  },
  androidFallbackFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.82)"
  },
  gestureHost: {
    minHeight: FLOATING_TAB_BAR_HEIGHT,
    position: "relative",
    justifyContent: "center",
    ...hairline
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
    minHeight: FLOATING_TAB_BAR_HEIGHT - 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    position: "relative",
    zIndex: 2
  },
  tabItem: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderRadius: 16
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
