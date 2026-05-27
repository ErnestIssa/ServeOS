/** Rubber-band resistance when pulling past the max scroll (never reveals card tail). */
export function rubberBandOffsetPastMax(excess: number, cap = 26): number {
  if (excess <= 0) return 0;
  return cap * (1 - 1 / (excess / cap + 1));
}
