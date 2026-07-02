import * as Haptics from "expo-haptics";
import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming
} from "react-native-reanimated";
import { ShoppingCartGlyph } from "../components/ShoppingCartGlyph";

/** Matches `CartFABPopup` cart glyph. */
const CART_COLOR = "#312e81";
const CART_SIZE = 112;
/** Time between bounce cycles while user stays on empty orders (slow pace). */
export const EMPTY_ORDERS_CART_LOOP_MS = 5600;
/** Wait after the orders screen is visible before the first bounce. */
export const EMPTY_ORDERS_CART_LAND_DELAY_MS = 1000;
/** Nudge cart slightly above vertical centre of the orders tab area. */
const ABOVE_CENTRE_OFFSET = -56;

const BOUNCE_RISE1_MS = 780;
const BOUNCE_FALL1_MS = 820;
const BOUNCE_RISE2_MS = 620;
const BOUNCE_SETTLE_MS = 920;

/** When the cart’s final small bounce lands (end of settle) — phrase rotation syncs here. */
export const EMPTY_CART_LAST_BOUNCE_HIT_MS =
  BOUNCE_RISE1_MS + BOUNCE_FALL1_MS + BOUNCE_RISE2_MS + BOUNCE_SETTLE_MS;

/** When the cart hits bottom after the main fall (sync with `withSequence` below). */
const HAPTIC_MAIN_LAND_MS = BOUNCE_RISE1_MS + BOUNCE_FALL1_MS;

function subtleCartLandHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
}

function triggerEmptyCartBounce(translateY: SharedValue<number>) {
  cancelAnimation(translateY);
  translateY.value = 0;

  const rise = Easing.out(Easing.cubic);
  const fall = Easing.in(Easing.cubic);
  const easeOut = Easing.out(Easing.quad);

  /** High arc: slow lift, slower fall, one softer rebound, long settle. */
  translateY.value = withSequence(
    withTiming(-56, { duration: BOUNCE_RISE1_MS, easing: rise }),
    withTiming(14, { duration: BOUNCE_FALL1_MS, easing: fall }),
    withTiming(-26, { duration: BOUNCE_RISE2_MS, easing: rise }),
    withTiming(0, { duration: BOUNCE_SETTLE_MS, easing: easeOut })
  );
}

type Props = {
  /** When set, fills tab area for vertical centring (standalone). Omit when nested in a parent that supplies height. */
  minHeight?: number;
  /** Nested under empty orders layout: no full-area minHeight on the cart wrapper. */
  embedded?: boolean;
  /** Fires exactly when the final settle bounce lands (same instant as the subtle haptic). */
  onLastBounceLand?: () => void;
  /** Stops bounce loop and timers (e.g. search sheet open on Orders). */
  paused?: boolean;
  /** True only when the empty-orders cart is on screen and the user can see it. */
  active?: boolean;
};

export function EmptyOrdersCartAnimation({
  minHeight,
  embedded,
  onLastBounceLand,
  paused = false,
  active = false
}: Props) {
  const translateY = useSharedValue(0);
  const landTimeoutsRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const resumeAfterPauseRef = React.useRef(false);

  const clearLandSchedule = React.useCallback(() => {
    for (const t of landTimeoutsRef.current) clearTimeout(t);
    landTimeoutsRef.current = [];
  }, []);

  const play = React.useCallback(() => {
    triggerEmptyCartBounce(translateY);
    clearLandSchedule();
    landTimeoutsRef.current = [
      setTimeout(subtleCartLandHaptic, HAPTIC_MAIN_LAND_MS),
      setTimeout(() => {
        subtleCartLandHaptic();
        onLastBounceLand?.();
      }, EMPTY_CART_LAST_BOUNCE_HIT_MS)
    ];
  }, [translateY, clearLandSchedule, onLastBounceLand]);

  React.useEffect(() => {
    if (!active || paused) {
      if (active && paused) resumeAfterPauseRef.current = true;
      clearLandSchedule();
      cancelAnimation(translateY);
      translateY.value = 0;
      return;
    }

    cancelAnimation(translateY);
    translateY.value = 0;

    const landDelay = resumeAfterPauseRef.current ? 0 : EMPTY_ORDERS_CART_LAND_DELAY_MS;
    resumeAfterPauseRef.current = false;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    const startDelay = setTimeout(() => {
      play();
      intervalId = setInterval(play, EMPTY_ORDERS_CART_LOOP_MS);
    }, landDelay);

    return () => {
      clearTimeout(startDelay);
      if (intervalId) clearInterval(intervalId);
      clearLandSchedule();
      cancelAnimation(translateY);
      translateY.value = 0;
    };
  }, [active, paused, play, translateY, clearLandSchedule]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }]
  }));

  return (
    <View
      style={[
        styles.wrap,
        embedded ? styles.wrapEmbedded : null,
        !embedded && minHeight != null ? { minHeight } : null
      ]}
      accessibilityLabel="No active orders"
    >
      <Animated.View style={[styles.cartBox, animatedStyle]}>
        <ShoppingCartGlyph size={CART_SIZE} color={CART_COLOR} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    marginTop: ABOVE_CENTRE_OFFSET
  },
  wrapEmbedded: {
    paddingVertical: 12,
    marginTop: ABOVE_CENTRE_OFFSET + 8
  },
  cartBox: {
    alignItems: "center",
    justifyContent: "center"
  }
});
