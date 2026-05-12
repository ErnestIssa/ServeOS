import React from "react";
import { useWindowDimensions } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import type { SharedValue } from "react-native-reanimated";
import { runOnJS, useSharedValue, withSpring } from "react-native-reanimated";
import type { EdgeInsets } from "react-native-safe-area-context";
import { FLOATING_TAB_BAR_HEIGHT, FLOAT_MARGIN_BOTTOM } from "./navBottomMetrics";
import { FLOATING_TOP_BAR_HEIGHT, FLOATING_TOP_GAP } from "./FloatingTopBar";

/** Settle after release — velocity is applied for continuity with the finger. */
export const SHEET_SPRING_CONFIG = { damping: 24, stiffness: 460, mass: 0.48 };

/** Sheet height at or below this at pan begin counts as “collapsed” → user drag-open (cart eligible on Home). */
export const NAV_SHEET_DRAG_OPEN_COLLAPSED_MAX_H = 14;

const RUBBER = 0.42;
const VELOCITY_SNAP_SCALE = 0.11;
const MAX_VELOCITY_SNAP_FRAC = 0.3;

export function computeNavSheetSnapDims(screenH: number, insets: EdgeInsets) {
  const pillAnchorBottom = FLOAT_MARGIN_BOTTOM + insets.bottom + FLOATING_TAB_BAR_HEIGHT;
  const topReserve = insets.top + FLOATING_TOP_BAR_HEIGHT + FLOATING_TOP_GAP + 8;
  const fullH = Math.max(120, screenH - topReserve);
  const dockMaxH = Math.max(0, fullH - pillAnchorBottom);
  const hMid = Math.max(140, Math.min(dockMaxH * 0.48, fullH * 0.42)) + 3 + 15;
  return {
    snapMid: Number.isFinite(hMid) ? hMid : 200,
    snapHigh: fullH
  };
}

function clampWorklet(x: number, lo: number, hi: number): number {
  "worklet";
  return Math.min(hi, Math.max(lo, x));
}

/**
 * Two open detents: half (snapMid) and full (max). Closed (0) only when near collapsed or fling-down.
 * Released between half and full → nearer of those two. Velocity nudge applied in `x` before this runs.
 */
function resolveSheetSnapTargetWorklet(
  x: number,
  vy: number,
  snapMid: number,
  max: number,
  allowHalfDetent: boolean
): number {
  "worklet";
  const dismissSlop = Math.min(96, Math.max(44, snapMid * 0.2));
  const FLING_CLOSE = 760;
  const FLING_LIFT_OPEN = -560;

  if (!allowHalfDetent) {
    if (x <= dismissSlop) return 0;
    if (vy > FLING_CLOSE && x < max * 0.35) return 0;
    // Always resolve to full open for discovery/search mode.
    return max;
  }

  const dMid = Math.abs(x - snapMid);
  const dMax = Math.abs(x - max);
  const nearerOpen = dMid <= dMax ? snapMid : max;

  if (vy < FLING_LIFT_OPEN && x <= dismissSlop + 28) {
    return snapMid;
  }

  if (x <= dismissSlop) {
    return 0;
  }

  if (vy > FLING_CLOSE && x < snapMid * 0.46) {
    return 0;
  }

  return nearerOpen;
}

type PanDeps = {
  sheetHeightSV: SharedValue<number>;
  startH: SharedValue<number>;
  snapMidSV: SharedValue<number>;
  snapHighSV: SharedValue<number>;
  /** 1 while this pan is active (finger down, recognized); used so UI does not tear down other detectors mid-gesture */
  dragSessionSV?: SharedValue<number>;
  /** Fires on JS once when a vertical sheet pan begins while the sheet was collapsed (user drag-open). */
  onUserDragFromCollapsed?: () => void;
  /** When false, sheet can only settle at 0 or full height (no half detent). */
  allowHalfDetent: boolean;
};

export function buildSheetPan({
  sheetHeightSV,
  startH,
  snapMidSV,
  snapHighSV,
  dragSessionSV,
  onUserDragFromCollapsed,
  allowHalfDetent
}: PanDeps) {
  return Gesture.Pan()
    .maxPointers(1)
    /** Prevent accidental sheet close while scrolling inside the sheet. */
    .minDistance(14)
    .activeOffsetY([-14, 14])
    .failOffsetX([-140, 140])
    .onBegin(() => {
      const h0 = sheetHeightSV.value;
      startH.value = h0;
      if (dragSessionSV) dragSessionSV.value = 1;
      if (onUserDragFromCollapsed && h0 <= NAV_SHEET_DRAG_OPEN_COLLAPSED_MAX_H) {
        runOnJS(onUserDragFromCollapsed)();
      }
    })
    .onUpdate((e) => {
      const max = snapHighSV.value;
      if (max <= 0) return;
      let next = startH.value - e.translationY;
      if (next < 0) {
        next *= RUBBER;
      } else if (next > max) {
        next = max + (next - max) * RUBBER;
      }
      sheetHeightSV.value = next;
    })
    .onEnd((e) => {
      const max = snapHighSV.value;
      const vy = e.velocityY ?? 0;
      if (max <= 0) return;

      const cur = sheetHeightSV.value;

      if (cur < 0) {
        sheetHeightSV.value = withSpring(0, {
          ...SHEET_SPRING_CONFIG,
          velocity: -vy
        });
        return;
      }

      const h = cur > max ? max : cur;
      const snapMid = snapMidSV.value;
      const maxNudge = max * MAX_VELOCITY_SNAP_FRAC;
      const nudge = clampWorklet(vy * VELOCITY_SNAP_SCALE, -maxNudge, maxNudge);
      const biasedH = clampWorklet(h - nudge, 0, max);
      const t = resolveSheetSnapTargetWorklet(biasedH, vy, snapMid, max, allowHalfDetent);

      sheetHeightSV.value = withSpring(t, {
        ...SHEET_SPRING_CONFIG,
        velocity: -vy
      });
    })
    .onFinalize(() => {
      if (dragSessionSV) dragSessionSV.value = 0;
    });
}

export function useNavSheetPanGestures(
  insets: EdgeInsets,
  sheetHeightSV: SharedValue<number>,
  options?: { onUserDragFromCollapsed?: () => void; allowHalfDetent?: boolean }
) {
  const { height: H } = useWindowDimensions();

  const onUserDragFromCollapsed = options?.onUserDragFromCollapsed;
  const allowHalfDetent = options?.allowHalfDetent ?? true;

  const { snapMid, snapHigh } = React.useMemo(
    () => computeNavSheetSnapDims(H, insets),
    [H, insets.bottom, insets.top]
  );

  const startH = useSharedValue(0);
  const snapMidSV = useSharedValue(snapMid);
  const snapHighSV = useSharedValue(snapHigh);

  React.useLayoutEffect(() => {
    const v = computeNavSheetSnapDims(H, insets);
    snapMidSV.value = v.snapMid;
    snapHighSV.value = v.snapHigh;
  }, [H, insets.bottom, insets.top, snapMidSV, snapHighSV]);

  const sheetPanDragSessionSV = useSharedValue(0);

  const deps: PanDeps = {
    sheetHeightSV,
    startH,
    snapMidSV,
    snapHighSV,
    dragSessionSV: sheetPanDragSessionSV,
    onUserDragFromCollapsed,
    allowHalfDetent
  };

  const panVerticalOnSheetBody = React.useMemo(
    () => buildSheetPan(deps),
    [sheetHeightSV, startH, snapMidSV, snapHighSV, sheetPanDragSessionSV, onUserDragFromCollapsed, allowHalfDetent]
  );

  /** Same logic; separate instance so RNGH allows a second GestureDetector (seam strip when sheet height is 0). */
  const panVerticalSeamGrab = React.useMemo(
    () => buildSheetPan(deps),
    [sheetHeightSV, startH, snapMidSV, snapHighSV, sheetPanDragSessionSV, onUserDragFromCollapsed, allowHalfDetent]
  );

  const panVerticalWithTabsDuplicate = React.useMemo(
    () => buildSheetPan(deps),
    [sheetHeightSV, startH, snapMidSV, snapHighSV, sheetPanDragSessionSV, onUserDragFromCollapsed, allowHalfDetent]
  );

  return {
    panVerticalOnSheetBody,
    panVerticalSeamGrab,
    panVerticalWithTabsDuplicate,
    sheetPanDragSessionSV
  };
}

/** @deprecated Use useNavSheetPanGestures().panVerticalOnSheetBody */
export function useNavSheetPanGesture(insets: EdgeInsets, sheetHeightSV: SharedValue<number>) {
  return useNavSheetPanGestures(insets, sheetHeightSV).panVerticalOnSheetBody;
}
