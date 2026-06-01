/** Gap between immersive sheet card top and bottom of floating top nav (search area). */
export const IMMERSIVE_CARD_GAP_BELOW_TOP_NAV = 10;

/** Note step (3): extra scroll range below Continue — only visible when scrolling the card up. */
export const BOOK_NOTE_FOOTER_SCROLL_REVEAL_PX = 280;

export function immersiveHeroHeight(screenHeight: number): number {
  return Math.round(Math.min(screenHeight * 0.54, 440));
}

/** Where the gradient card starts at scroll offset 0 (hero peek layout). */
export function immersiveSheetTopOffset(screenHeight: number): number {
  return immersiveHeroHeight(screenHeight) - 20;
}

/**
 * Scroll offset so the sheet card top sits `gap` px below the top nav content pad.
 * Same range as step 1: user can still scroll down to hero peek (y→0) or up further.
 */
export function immersiveRaisedScrollY(
  screenHeight: number,
  scrollTopPad: number,
  gap = IMMERSIVE_CARD_GAP_BELOW_TOP_NAV
): number {
  const sheetTop = immersiveSheetTopOffset(screenHeight);
  return Math.max(0, sheetTop - scrollTopPad - gap);
}
