import { R } from "../theme";

/** Tab strip chrome height — includes vertical padding below seam dash / above outer border. */
export const FLOATING_TAB_BAR_HEIGHT = 80;
export const FLOAT_MARGIN_SIDE = 10;
/** Negative tucks the chrome below the safe inset (closer to physical bottom). */
export const FLOAT_MARGIN_BOTTOM = -18;

export function contentBottomInset(bottomInset: number): number {
  return R.space.lg + FLOATING_TAB_BAR_HEIGHT + FLOAT_MARGIN_BOTTOM + bottomInset;
}

/** Chat composer — sits just above the floating tab bar (tighter than scroll content). */
const CHAT_COMPOSER_TAB_GAP = 4;

export function chatComposerBottomInset(bottomInset: number): number {
  return FLOATING_TAB_BAR_HEIGHT + FLOAT_MARGIN_BOTTOM + bottomInset + CHAT_COMPOSER_TAB_GAP;
}
