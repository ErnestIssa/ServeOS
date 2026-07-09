import { Easing, withTiming, type WithTimingConfig } from "react-native-reanimated";

/** Minimum uniform scale for the bottom dock while scrolling down. */
export const BOTTOM_NAV_MIN_SCALE = 0.88;

/** Scroll delta (px) before direction is recognized. */
export const BOTTOM_NAV_SCROLL_DIR_THRESHOLD = 4;

/** Position jumps larger than this sync baseline only (tab switch, programmatic restore). */
export const BOTTOM_NAV_SCROLL_JUMP_SYNC_THRESHOLD = 96;

/** Smooth ease-out restore / shrink (~200–300 ms). */
export const BOTTOM_NAV_FOCUS_TIMING: WithTimingConfig = {
  duration: 250,
  easing: Easing.out(Easing.cubic)
};

/** Uniform scale boost while the user taps or drags the bottom nav. */
export const BOTTOM_NAV_PRESS_SCALE = 1.06;

export const BOTTOM_NAV_PRESS_TIMING: WithTimingConfig = {
  duration: 220,
  easing: Easing.out(Easing.cubic)
};

export function restoreBottomNavFocusWorklet(focusSV: { value: number }) {
  "worklet";
  focusSV.value = withTiming(1, BOTTOM_NAV_FOCUS_TIMING);
}
