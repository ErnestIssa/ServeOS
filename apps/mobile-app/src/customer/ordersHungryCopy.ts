/** Warm, appetite-forward lines — rotate by time + visit + day. */
const EMPTY_LINES = [
  "Something delicious is only a tap away.",
  "Your next favorite bite is waiting on the menu.",
  "Good food hits different when you are ready for it.",
  "Treat yourself — you have earned a proper meal.",
  "The kitchen is quiet, but the menu is full of possibilities.",
  "Hungry is a mood. Ordering is the cure.",
  "Warm plates, cold drinks, and zero rush — whenever you are ready.",
  "A little flavor goes a long way tonight.",
  "Let the menu do the talking.",
  "Comfort food loves good company — even if that company is just you."
] as const;

const CART_REMINDER_LEADS = [
  "Your cart is holding something good for you.",
  "Those picks in your cart are not going to taste themselves.",
  "You already chose the hard part — the fun part is next.",
  "Your future self will thank you for finishing what you started in that cart.",
  "A few taps stand between you and that first bite.",
  "The flavors you saved are still yours — ready when you are.",
  "Nothing wrong with pausing — just do not forget what you were craving."
] as const;

function mixIndex(base: number, mod: number, len: number): number {
  return ((base % 9973) + mod * 13 + len * 7) % len;
}

export function pickHungryEmptyLine(params: {
  hour: number;
  dayOfWeek: number;
  ordersSectionVisitKey: number;
}): string {
  const idx = mixIndex(params.hour * 31 + params.dayOfWeek * 5, params.ordersSectionVisitKey, EMPTY_LINES.length);
  return EMPTY_LINES[idx] ?? EMPTY_LINES[0];
}

export function pickHungryCartReminderLine(params: {
  hour: number;
  dayOfWeek: number;
  ordersSectionVisitKey: number;
  leadItemName: string | null;
  lineCount: number;
  totalQty: number;
}): string {
  const base = mixIndex(
    params.hour * 17 + params.dayOfWeek * 11 + params.lineCount * 3 + params.totalQty,
    params.ordersSectionVisitKey,
    CART_REMINDER_LEADS.length
  );
  const line = CART_REMINDER_LEADS[base] ?? CART_REMINDER_LEADS[0];
  if (params.leadItemName && params.lineCount === 1 && params.totalQty <= 3) {
    return `${line} (${params.leadItemName} is still in your cart.)`;
  }
  if (params.lineCount > 1) {
    return `${line} (${params.lineCount} items · ${params.totalQty} in your cart.)`;
  }
  return line;
}
