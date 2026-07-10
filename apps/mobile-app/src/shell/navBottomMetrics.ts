import { R } from "../theme";

/** Compact floating dock height (icons only). */
export const FLOATING_TAB_BAR_HEIGHT = 58;
/** Horizontal inset for the bottom tab bar only (top bar keeps `FLOAT_MARGIN_SIDE`). */
export const FLOATING_TAB_BAR_MARGIN_SIDE = 22;
/** Compact floating top search / chrome bar — staff default chrome. */
export const FLOATING_TOP_BAR_HEIGHT = 54;
/** Customer home — thin split search + venue chips. */
export const FLOATING_HOME_TOP_BAR_HEIGHT = 40;
export const FLOATING_HOME_VENUE_CHIP_SIZE = 36;
export const FLOAT_MARGIN_SIDE = 16;
/** Gap above the home-indicator safe area — `0` sits the dock at the safe-area edge. */
export const FLOAT_MARGIN_BOTTOM = 0;

export function floatingDockBottomY(bottomInset: number): number {
  return Math.max(0, bottomInset + FLOAT_MARGIN_BOTTOM);
}

/** Scroll padding so content can run under the glass dock; small tail when scrolled to end. */
export function contentBottomInset(bottomInset: number): number {
  return FLOATING_TAB_BAR_HEIGHT + floatingDockBottomY(bottomInset) + 8;
}

/** Home — content runs under the floating dock; only safe-area tail (no extra nav band). */
export function homeScrollBottomInset(bottomInset: number): number {
  return floatingDockBottomY(bottomInset) + 12;
}

/** Float below the safe-area top — top dock does not hug screen edges. */
export const FLOAT_MARGIN_TOP = 10;
/** Customer home top row — sits slightly higher than the default top margin. */
export const FLOAT_MARGIN_TOP_HOME = 6;
/** Gap between dock top and sheet panel bottom. */
export const DOCK_SHEET_GAP = 10;
/** Scroll content gap below the floating top bar. */
export const CONTENT_GAP_BELOW_TOP_NAV = 12;

export function contentTopInset(topInset: number): number {
  return R.space.sm + FLOATING_TOP_BAR_HEIGHT + FLOAT_MARGIN_TOP + topInset + CONTENT_GAP_BELOW_TOP_NAV;
}

/** Customer home — thin floating search row + gap below. */
export function homeContentTopInset(topInset: number): number {
  return (
    R.space.sm + FLOATING_HOME_TOP_BAR_HEIGHT + FLOAT_MARGIN_TOP_HOME + topInset + CONTENT_GAP_BELOW_TOP_NAV
  );
}

/** Tabs without the home top nav — safe area + small breathing room only. */
export function contentTopInsetWithoutTopNav(topInset: number): number {
  return topInset + R.space.sm;
}

/** Y coordinate of the floating top bar's bottom edge. */
export function floatingTopBarBottomY(topInset: number): number {
  return topInset + FLOAT_MARGIN_TOP + FLOATING_TOP_BAR_HEIGHT;
}

/** Customer home top bar bottom edge. */
export function floatingHomeTopBarBottomY(topInset: number): number {
  return topInset + FLOAT_MARGIN_TOP_HOME + FLOATING_HOME_TOP_BAR_HEIGHT;
}

/** Shared full-height sheet modals (experience switcher, home search). */
export const SHEET_MODAL_TOP_RADIUS = 30;
export const SHEET_MODAL_MIN_HEIGHT = 280;

export function experienceStyleSheetModalHeight(screenH: number, topInset: number): number {
  const modalTop = floatingTopBarBottomY(topInset);
  return Math.max(SHEET_MODAL_MIN_HEIGHT, screenH - modalTop);
}

/** Chat composer — sits just above the floating tab bar (tighter than scroll content). */
const CHAT_COMPOSER_TAB_GAP = 4;

export function chatComposerBottomInset(bottomInset: number): number {
  return FLOATING_TAB_BAR_HEIGHT + floatingDockBottomY(bottomInset) + CHAT_COMPOSER_TAB_GAP;
}

/** Immersive chat (no tab bar) — composer flush above home indicator. */
export function chatImmersiveComposerBottomInset(bottomInset: number): number {
  return Math.max(8, bottomInset + 8);
}

/** Height reserved for the back chevron row in immersive chat. */
export const CHAT_IMMERSIVE_BACK_ROW = 44;

/** Sticky thread nav (back + venue + online status). */
export const CHAT_THREAD_NAV_HEIGHT = 50;
/** Gap below safe area before the chat thread nav capsule. */
export const CHAT_THREAD_NAV_TOP_MARGIN = 4;
/** Scroll gap below the chat thread nav capsule. */
export const CHAT_THREAD_GAP_BELOW_NAV = 10;

/** Bottom edge of chat thread top chrome (safe area + margin + bar + gap). */
export function chatThreadNavChromeBottom(topInset: number): number {
  return topInset + CHAT_THREAD_NAV_TOP_MARGIN + CHAT_THREAD_NAV_HEIGHT + CHAT_THREAD_GAP_BELOW_NAV;
}

export function chatImmersiveContentTop(safeTop: number): number {
  return safeTop + CHAT_IMMERSIVE_BACK_ROW;
}

export function chatThreadNavTop(safeTop: number): number {
  return safeTop + CHAT_THREAD_NAV_HEIGHT + 6;
}
