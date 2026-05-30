const FRIENDLY: Record<string, string> = {
  directory_failed: "We couldn't load your venues right now. Check your connection and try again.",
  session_failed: "Your session couldn't be verified. Please sign in again.",
  failed_to_list_restaurants: "We couldn't load your restaurants. Try again in a moment.",
  failed_to_fetch_orders: "We couldn't load your orders. Pull to refresh or try again.",
  menu_failed: "This menu couldn't be loaded. Try another venue or retry.",
  order_failed: "Your order wasn't placed. Nothing was charged — try again.",
  cart_remove_failed: "We couldn't update your cart. Try again.",
  failed_to_connect: "We couldn't reach ServeOS. Check your internet and try again."
};

export function formatAppError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (typeof error === "string") {
    const key = error.trim();
    if (!key) return fallback;
    return FRIENDLY[key] ?? key;
  }
  if (error instanceof Error && error.message.trim()) {
    const msg = error.message.trim();
    return FRIENDLY[msg] ?? msg;
  }
  if (error && typeof error === "object") {
    const rec = error as Record<string, unknown>;
    if (typeof rec.error === "string" && rec.error.trim()) {
      const key = rec.error.trim();
      return FRIENDLY[key] ?? key;
    }
    if (typeof rec.message === "string" && rec.message.trim()) {
      return rec.message.trim();
    }
  }
  return fallback;
}

export function isLikelyErrorStatus(status: string): boolean {
  const s = status.trim().toLowerCase();
  if (!s || s === "loading…" || s === "placing…") return false;
  if (s.includes("placed") || s.includes("added")) return false;
  return /failed|error|could not|unable|invalid|denied|timeout|unauthorized|forbidden/.test(s);
}
