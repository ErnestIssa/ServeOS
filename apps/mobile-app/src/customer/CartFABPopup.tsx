import * as Haptics from "expo-haptics";
import React, { useEffect, useRef } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  Easing
} from "react-native-reanimated";
import { ShoppingCartGlyph } from "../components/ShoppingCartGlyph";
import { R } from "../theme";

type Props = {
  active: boolean;
  bumpKey: number;
  totalQuantity: number;
  bottomOffset: number;
  rightOffset: number;
  onOpenCart: () => void;
};

export function CartFABPopup({ active, bumpKey, totalQuantity, bottomOffset, rightOffset, onOpenCart }: Props) {
  const prog = useSharedValue(0);
  const bump = useSharedValue(1);
  const pressDepth = useSharedValue(1);
  const wasActive = useRef(false);

  useEffect(() => {
    cancelAnimation(prog);
    cancelAnimation(bump);
    if (active && totalQuantity > 0) {
      prog.value = withSpring(1, { damping: 17, stiffness: 260, mass: 0.72 });
      if (!wasActive.current) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      prog.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) });
    }
    wasActive.current = !!(active && totalQuantity > 0);
  }, [active, totalQuantity, prog]);

  useEffect(() => {
    if (!active || bumpKey <= 0 || totalQuantity <= 0) return;
    bump.value = 1;
    bump.value = withSequence(
      withSpring(1.1, { damping: 13, stiffness: 400 }),
      withSpring(1, { damping: 16, stiffness: 330 })
    );
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [active, bumpKey, bump, totalQuantity]);

  const shellStyle = useAnimatedStyle(() => ({
    opacity: interpolate(prog.value, [0, 0.15, 1], [0, 1, 1], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(prog.value, [0, 1], [44, 0], Extrapolation.CLAMP) },
      { translateY: interpolate(prog.value, [0, 1], [28, 0], Extrapolation.CLAMP) }
    ]
  }));

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: (0.86 + prog.value * 0.14) * bump.value * pressDepth.value }]
  }));

  function handleOpenCart() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onOpenCart();
    prog.value = withTiming(0, { duration: 300, easing: Easing.in(Easing.cubic) });
    bump.value = withSequence(withTiming(0.9, { duration: 80 }), withTiming(1, { duration: 140 }));
  }

  const show = active && totalQuantity > 0;
  return (
    <Animated.View
      pointerEvents={show ? "box-none" : "none"}
      style={[styles.anchor, shellStyle, { bottom: bottomOffset, right: rightOffset }]}
      accessibilityElementsHidden={!show}
    >
      <Animated.View style={contentStyle}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Shopping cart · ${totalQuantity} items. Opens order summary`}
          accessibilityHint="Opens your cart sheet"
          disabled={!show}
          hitSlop={10}
          onPress={handleOpenCart}
          onPressIn={() => {
            pressDepth.value = withSpring(0.93, { damping: 22, stiffness: 520 });
          }}
          onPressOut={() => {
            pressDepth.value = withSpring(1, { damping: 14, stiffness: 420 });
          }}
          style={({ pressed }) => [styles.sheet, pressed && styles.sheetPressed]}
        >
          <View style={styles.iconRow}>
            <ShoppingCartGlyph size={26} color="#312e81" />
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{totalQuantity > 99 ? "99+" : String(totalQuantity)}</Text>
            </View>
          </View>
          <Text style={styles.cta}>View cart</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: "absolute",
    zIndex: 14,
    alignItems: "flex-end"
  },
  sheet: {
    minWidth: 112,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: "rgba(255,255,255,0.93)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.35)",
    ...Platform.select({
      ios: {
        shadowColor: "#1e1b4b",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.22,
        shadowRadius: 20
      },
      android: { elevation: 12 }
    }),
    gap: 4
  },
  sheetPressed: {
    opacity: 0.97
  },
  iconRow: {
    alignSelf: "center",
    position: "relative",
    justifyContent: "center",
    alignItems: "center"
  },
  badge: {
    position: "absolute",
    top: -8,
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
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800"
  },
  cta: {
    fontSize: 11,
    fontWeight: "800",
    color: R.accentPurple,
    letterSpacing: 0.2,
    textAlign: "center"
  }
});
