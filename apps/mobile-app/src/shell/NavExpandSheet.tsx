import React from "react";
import { useWindowDimensions } from "react-native";
import { Gesture, type NativeGesture } from "react-native-gesture-handler";
import type { SharedValue } from "react-native-reanimated";
import { runOnJS, useAnimatedReaction, useSharedValue, withSpring } from "react-native-reanimated";
import type { EdgeInsets } from "react-native-safe-area-context";
import { FLOATING_TAB_BAR_HEIGHT, DOCK_SHEET_GAP, floatingDockBottomY } from "./navBottomMetrics";
import { FLOATING_TOP_BAR_HEIGHT, FLOAT_MARGIN_TOP, FLOATING_HOME_TOP_BAR_HEIGHT, FLOAT_MARGIN_TOP_HOME } from "./FloatingTopBar";
import { NAV_SHEET_SNAP_IMPACT_BAND_PX, onNavSheetSnapSettled } from "./navSheetSnapHaptics";

/** Settle after release — velocity is applied for continuity with the finger. */
export const SHEET_SPRING_CONFIG = { damping: 24, stiffness: 460, mass: 0.48 };

/** Sheet height at or below this at pan begin counts as “collapsed” → user drag-open (cart eligible on Home). */
export const NAV_SHEET_DRAG_OPEN_COLLAPSED_MAX_H = 14;

const RUBBER = 0.42;
const VELOCITY_SNAP_SCALE = 0.11;
const MAX_VELOCITY_SNAP_FRAC = 0.3;

export function computeNavSheetSnapDims(screenH: number, insets: EdgeInsets, customerHome = true) {
  const pillAnchorBottom = floatingDockBottomY(insets.bottom) + FLOATING_TAB_BAR_HEIGHT + DOCK_SHEET_GAP;
  const topMargin = customerHome ? FLOAT_MARGIN_TOP_HOME : FLOAT_MARGIN_TOP;
  const topBarHeight = customerHome ? FLOATING_HOME_TOP_BAR_HEIGHT : FLOATING_TOP_BAR_HEIGHT;
  const topReserve = insets.top + topMargin + topBarHeight + 8;
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
  /** When false, finger pans cannot raise sheet height from collapsed (programmatic open only). */
  allowDragOpen?: boolean;
  /** When false, sheet can only settle at 0 or full height (no half detent). */
  allowHalfDetent: boolean;
  /** Set on pan end before spring so snap-impact reaction can fire on first band entry. */
  snapImpactTargetSV: SharedValue<number>;
  snapImpactArmedSV: SharedValue<number>;
  /** When set, sheet pan defers to in-sheet scroll until top/bottom overscroll. */
  sheetContentScrollYSV?: SharedValue<number>;
  sheetContentScrollAtEndSV?: SharedValue<number>;
  nativeScrollGesture?: NativeGesture;
};

const SCROLL_TOP_HANDOFF_PX = 10;

function sheetPanShouldDeferToScroll(
  scrollY: number,
  atEnd: boolean,
  translationY: number
): boolean {
  "worklet";
  if (scrollY > SCROLL_TOP_HANDOFF_PX && translationY < 0 && !atEnd) return true;
  if (scrollY > SCROLL_TOP_HANDOFF_PX && translationY > 0) return true;
  return false;
}

export function buildSheetPan({
  sheetHeightSV,
  startH,
  snapMidSV,
  snapHighSV,
  dragSessionSV,
  allowDragOpen = false,
  allowHalfDetent,
  snapImpactTargetSV,
  snapImpactArmedSV,
  sheetContentScrollYSV,
  sheetContentScrollAtEndSV,
  nativeScrollGesture
}: PanDeps) {
  const pan = Gesture.Pan()
    .maxPointers(1)
    /** Prevent accidental sheet close while scrolling inside the sheet. */
    .minDistance(10)
    .activeOffsetY([-10, 10])
    .failOffsetX([-48, 48])
    .onBegin(() => {
      const h0 = sheetHeightSV.value;
      startH.value = h0;
      if (dragSessionSV) dragSessionSV.value = 1;
    })
    .onUpdate((e) => {
      const max = snapHighSV.value;
      if (max <= 0) return;
      const scrollY = sheetContentScrollYSV?.value ?? 0;
      const atEnd = (sheetContentScrollAtEndSV?.value ?? 0) > 0.5;
      if (sheetPanShouldDeferToScroll(scrollY, atEnd, e.translationY)) return;
      let next = startH.value - e.translationY;
      if (!allowDragOpen && startH.value <= NAV_SHEET_DRAG_OPEN_COLLAPSED_MAX_H && next > startH.value) {
        return;
      }
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
      const snapMid = snapMidSV.value;

      if (cur < 0) {
        snapImpactTargetSV.value = 0;
        snapImpactArmedSV.value = 1;
        sheetHeightSV.value = withSpring(0, {
          ...SHEET_SPRING_CONFIG,
          velocity: -vy
        });
        return;
      }

      const h = cur > max ? max : cur;
      if (!allowDragOpen && startH.value <= NAV_SHEET_DRAG_OPEN_COLLAPSED_MAX_H && h < snapMid * 0.42) {
        snapImpactTargetSV.value = 0;
        snapImpactArmedSV.value = 1;
        sheetHeightSV.value = withSpring(0, {
          ...SHEET_SPRING_CONFIG,
          velocity: -vy
        });
        return;
      }

      const maxNudge = max * MAX_VELOCITY_SNAP_FRAC;
      const nudge = clampWorklet(vy * VELOCITY_SNAP_SCALE, -maxNudge, maxNudge);
      const biasedH = clampWorklet(h - nudge, 0, max);
      const t = resolveSheetSnapTargetWorklet(biasedH, vy, snapMid, max, allowHalfDetent);

      snapImpactTargetSV.value = t;
      snapImpactArmedSV.value = 1;
      sheetHeightSV.value = withSpring(t, {
        ...SHEET_SPRING_CONFIG,
        velocity: -vy
      });
    })
    .onFinalize(() => {
      if (dragSessionSV) dragSessionSV.value = 0;
    });

  if (nativeScrollGesture) {
    pan.simultaneousWithExternalGesture(nativeScrollGesture);
  }
  return pan;
}

export function useNavSheetPanGestures(
  insets: EdgeInsets,
  sheetHeightSV: SharedValue<number>,
  options?: {
    allowDragOpen?: boolean;
    allowHalfDetent?: boolean;
    snapImpactTargetSV?: SharedValue<number>;
    snapImpactArmedSV?: SharedValue<number>;
    sheetContentScrollYSV?: SharedValue<number>;
    sheetContentScrollAtEndSV?: SharedValue<number>;
    nativeScrollGesture?: NativeGesture;
  }
) {
  const { height: H } = useWindowDimensions();

  const allowDragOpen = options?.allowDragOpen ?? false;
  const allowHalfDetent = options?.allowHalfDetent ?? true;

  const fallbackSnapImpactTargetSV = useSharedValue(-1);
  const fallbackSnapImpactArmedSV = useSharedValue(0);
  const snapImpactTargetSV = options?.snapImpactTargetSV ?? fallbackSnapImpactTargetSV;
  const snapImpactArmedSV = options?.snapImpactArmedSV ?? fallbackSnapImpactArmedSV;

  const allowHalfDetentSV = useSharedValue(allowHalfDetent ? 1 : 0);
  React.useLayoutEffect(() => {
    allowHalfDetentSV.value = allowHalfDetent ? 1 : 0;
  }, [allowHalfDetent, allowHalfDetentSV]);

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

  const sheetContentScrollYSV = options?.sheetContentScrollYSV;
  const sheetContentScrollAtEndSV = options?.sheetContentScrollAtEndSV;
  const nativeScrollGesture = options?.nativeScrollGesture;

  const deps: PanDeps = {
    sheetHeightSV,
    startH,
    snapMidSV,
    snapHighSV,
    dragSessionSV: sheetPanDragSessionSV,
    allowDragOpen,
    allowHalfDetent,
    snapImpactTargetSV,
    snapImpactArmedSV,
    sheetContentScrollYSV,
    sheetContentScrollAtEndSV,
    nativeScrollGesture
  };

  const panMemoDeps: unknown[] = [
    sheetHeightSV,
    startH,
    snapMidSV,
    snapHighSV,
    sheetPanDragSessionSV,
    allowDragOpen,
    allowHalfDetent,
    snapImpactTargetSV,
    snapImpactArmedSV,
    sheetContentScrollYSV,
    sheetContentScrollAtEndSV,
    nativeScrollGesture
  ];

  const panVerticalOnSheetBody = React.useMemo(() => buildSheetPan(deps), panMemoDeps);

  useAnimatedReaction(
    () => sheetHeightSV.value,
    (h, prevH) => {
      if (snapImpactArmedSV.value < 0.5) return;
      const t = snapImpactTargetSV.value;
      if (t < -0.5) return;
      const prev = typeof prevH === "number" ? prevH : h + 1e6;
      const band = NAV_SHEET_SNAP_IMPACT_BAND_PX;
      const hit = Math.abs(h - t) < band;
      const wasOutside = Math.abs(prev - t) >= band;
      if (hit && wasOutside) {
        snapImpactArmedSV.value = 0;
        snapImpactTargetSV.value = -1;
        const sm = snapMidSV.value;
        const sh = snapHighSV.value;
        const allow = allowHalfDetentSV.value > 0.5;
        runOnJS(onNavSheetSnapSettled)(h, sm, sh, allow);
      }
    }
  );

  return {
    panVerticalOnSheetBody,
    sheetPanDragSessionSV
  };
}

/** @deprecated Use useNavSheetPanGestures().panVerticalOnSheetBody */
export function useNavSheetPanGesture(insets: EdgeInsets, sheetHeightSV: SharedValue<number>) {
  return useNavSheetPanGestures(insets, sheetHeightSV).panVerticalOnSheetBody;
}
