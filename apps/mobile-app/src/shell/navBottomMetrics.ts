import { R } from "../theme";

/** Compact floating dock height (icons only). */
export const FLOATING_TAB_BAR_HEIGHT = 54;
/** Compact floating top search / chrome bar — matches bottom dock height. */
export const FLOATING_TOP_BAR_HEIGHT = 54;
export const FLOAT_MARGIN_SIDE = 16;
/** Gap above the home-indicator safe area — `0` sits the dock at the safe-area edge. */
export const FLOAT_MARGIN_BOTTOM = 0;

export function floatingDockBottomY(bottomInset: number): number {
  return Math.max(0, bottomInset + FLOAT_MARGIN_BOTTOM);
}

export function contentBottomInset(bottomInset: number): number {
  return R.space.lg + FLOATING_TAB_BAR_HEIGHT + floatingDockBottomY(bottomInset);
}

/** Float below the safe-area top — top dock does not hug screen edges. */
export const FLOAT_MARGIN_TOP = 10;
/** Gap between dock top and sheet panel bottom. */
export const DOCK_SHEET_GAP = 10;
/** Scroll content gap below the floating top bar. */
export const CONTENT_GAP_BELOW_TOP_NAV = 12;

export function contentTopInset(topInset: number): number {
  return R.space.sm + FLOATING_TOP_BAR_HEIGHT + FLOAT_MARGIN_TOP + topInset + CONTENT_GAP_BELOW_TOP_NAV;
}

/** Y coordinate of the floating top bar's bottom edge. */
export function floatingTopBarBottomY(topInset: number): number {
  return topInset + FLOAT_MARGIN_TOP + FLOATING_TOP_BAR_HEIGHT;
}

/** Chat composer — sits just above the floating tab bar (tighter than scroll content). */
const CHAT_COMPOSER_TAB_GAP = 4;

export function chatComposerBottomInset(bottomInset: number): number {
  return FLOATING_TAB_BAR_HEIGHT + floatingDockBottomY(bottomInset) + CHAT_COMPOSER_TAB_GAP;
}
