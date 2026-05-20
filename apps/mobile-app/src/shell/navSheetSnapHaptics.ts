import * as Haptics from "expo-haptics";

/** Shared with `NavExpandSheet` snap-impact reaction so “hit” and haptic classification use the same band. */
export const NAV_SHEET_SNAP_IMPACT_BAND_PX = 24;

const EPS = NAV_SHEET_SNAP_IMPACT_BAND_PX;

/**
 * Fires when the nav bottom sheet **crosses into** a snap target band (first frame inside), not when Reanimated marks the animation finished — so haptics line up with the perceived impact.
 * - **First stop** (half detent): lighter tap — `Light`
 * - **Last stop** (full height or fully closed): softer cushion — `Soft`
 */
export function onNavSheetSnapSettled(settledHeight: number, snapMid: number, snapHigh: number, allowHalfDetent: boolean): void {
  const t = settledHeight;
  const near0 = t <= EPS;
  const nearMid = allowHalfDetent && Math.abs(t - snapMid) < EPS;
  const nearHigh = Math.abs(t - snapHigh) < EPS;

  if (nearMid) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    return;
  }
  if (nearHigh || near0) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
  }
}
