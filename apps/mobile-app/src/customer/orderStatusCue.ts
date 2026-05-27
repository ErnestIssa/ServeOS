import { playCartAddCue } from "./cartCueSound";

/** Last live milestone (0–2) we already cued per order — survives screen revisits. */
const lastMilestoneByOrderId = new Map<string, number>();

/**
 * Play cart cue only on real step advances: start of step 1 (milestone 0), then 0→1, 1→2 (end of step 3).
 * No sound when revisiting Orders with the same status.
 */
export function syncOrderStatusCue(orderId: string, milestone: number): void {
  const id = orderId.trim();
  if (!id || milestone < 0 || milestone > 2) return;

  const prev = lastMilestoneByOrderId.get(id);
  if (prev === milestone) return;

  if (prev === undefined) {
    lastMilestoneByOrderId.set(id, milestone);
    if (milestone === 0) void playCartAddCue();
    return;
  }

  if (milestone > prev) {
    lastMilestoneByOrderId.set(id, milestone);
    void playCartAddCue();
  }
}

export function clearOrderStatusCue(orderId: string): void {
  const id = orderId.trim();
  if (id) lastMilestoneByOrderId.delete(id);
}
