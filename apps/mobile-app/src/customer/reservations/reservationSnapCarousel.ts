const SNAP_VELOCITY = 0.18;
const SNAP_DRAG_FRAC = 0.07;

/** Horizontal snap index from scroll offset (live status / accessibility carousel). */
export function resolveSnapCarouselIndex(
  offsetX: number,
  velocityX: number,
  stride: number,
  count: number
): number {
  const max = Math.max(0, count - 1);
  if (stride <= 0) return 0;
  const raw = offsetX / stride;
  if (velocityX > SNAP_VELOCITY) {
    return Math.max(0, Math.min(max, Math.ceil(raw - 1e-4)));
  }
  if (velocityX < -SNAP_VELOCITY) {
    return Math.max(0, Math.min(max, Math.floor(raw + 1e-4)));
  }
  const base = Math.floor(raw + 1e-4);
  const frac = raw - base;
  if (frac > SNAP_DRAG_FRAC) return Math.min(max, base + 1);
  return Math.max(0, Math.min(max, base));
}
