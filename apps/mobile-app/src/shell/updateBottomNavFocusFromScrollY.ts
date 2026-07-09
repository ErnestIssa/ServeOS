import type { MutableRefObject } from "react";
import type { SharedValue } from "react-native-reanimated";
import { withTiming } from "react-native-reanimated";
import {
  BOTTOM_NAV_FOCUS_TIMING,
  BOTTOM_NAV_SCROLL_DIR_THRESHOLD,
  BOTTOM_NAV_SCROLL_JUMP_SYNC_THRESHOLD
} from "./navBottomFocus";

/** Direction-aware bottom nav focus from a vertical scroll offset. */
export function updateBottomNavFocusFromScrollY(
  focusSV: SharedValue<number>,
  lastYRef: MutableRefObject<number>,
  y: number
) {
  const safeY = Math.max(0, y);
  const delta = safeY - lastYRef.current;
  if (Math.abs(delta) > BOTTOM_NAV_SCROLL_JUMP_SYNC_THRESHOLD) {
    lastYRef.current = safeY;
    return;
  }
  lastYRef.current = safeY;
  if (delta > BOTTOM_NAV_SCROLL_DIR_THRESHOLD) {
    focusSV.value = withTiming(0, BOTTOM_NAV_FOCUS_TIMING);
  } else if (delta < -BOTTOM_NAV_SCROLL_DIR_THRESHOLD) {
    focusSV.value = withTiming(1, BOTTOM_NAV_FOCUS_TIMING);
  }
}
