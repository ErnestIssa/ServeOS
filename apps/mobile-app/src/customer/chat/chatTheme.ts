import { R } from "../../theme";

/** KeyGo-inspired operational chat tokens mapped to ServeOS purple brand. */
export const CHAT = {
  brand: R.accentPurple,
  brandSoft: "rgba(139, 92, 246, 0.14)",
  mineText: "#FFFFFF",
  theirsBg: R.bgSubtle,
  theirsUnreadBg: "rgba(139, 92, 246, 0.1)",
  systemBg: "rgba(59, 130, 246, 0.08)",
  systemBorder: "rgba(59, 130, 246, 0.18)",
  /** Receipt ticks on purple bubbles (WhatsApp-style). */
  tickSent: "rgba(255,255,255,0.65)",
  tickDelivered: "rgba(255,255,255,0.72)",
  tickRead: "#53BDEB",
  radiusTail: 18,
  radiusInner: 6,
  radiusMicro: 4
} as const;

export function deliveryTickColor(status?: string): string {
  if (status === "read") return CHAT.tickRead;
  if (status === "delivered") return CHAT.tickDelivered;
  return CHAT.tickSent;
}
