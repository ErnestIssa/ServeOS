export const SCREEN_TRANSITION_MS = 340;

/** +1 = forward (incoming from right), -1 = back (incoming from left). */
export function screenTransitionDirection(
  fromKey: string,
  toKey: string,
  tabOrder: readonly string[]
): number {
  const from = tabOrder.indexOf(fromKey);
  const to = tabOrder.indexOf(toKey);
  if (from < 0 || to < 0 || from === to) return 0;
  return to > from ? 1 : -1;
}

export type ScreenTransitionState = {
  from: string;
  to: string;
  direction: number;
};
