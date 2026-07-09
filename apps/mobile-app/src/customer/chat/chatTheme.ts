import type { ThemeColors } from "../../theme/AppThemeContext";
import { R } from "../../theme";

export type ChatTokens = {
  brand: string;
  brandDeep: string;
  brandSoft: string;
  mineBg: string;
  mineText: string;
  mineMeta: string;
  theirsBg: string;
  theirsBorder: string;
  theirsUnreadAccent: string;
  systemBg: string;
  systemBorder: string;
  systemText: string;
  tickSent: string;
  tickDelivered: string;
  tickRead: string;
  shadow: string;
  radiusBubble: number;
  radiusGrouped: number;
  radiusTail: number;
  maxBubbleWidthPct: number;
};

/** Chat palette derived from the app theme — no ad-hoc hex outside theme tokens. */
export function createChatTokens(t: ThemeColors, isDark: boolean): ChatTokens {
  const mineText = isDark ? t.text : t.bg;
  const brandSoftAlpha = isDark ? "33" : "24";
  return {
    brand: t.ordersNavPurpleBright,
    brandDeep: t.ordersNavPurple,
    brandSoft: `${t.accentPurple}${brandSoftAlpha}`,
    mineBg: t.ordersNavPurpleBright,
    mineText,
    mineMeta: isDark ? t.textMuted : t.bg,
    theirsBg: isDark ? t.bgElevated : t.bg,
    theirsBorder: t.border,
    theirsUnreadAccent: t.ordersNavPurpleBright,
    systemBg: isDark ? t.bgSubtle : t.bgElevated,
    systemBorder: t.border,
    systemText: t.textSecondary,
    tickSent: isDark ? t.textMuted : mineText,
    tickDelivered: isDark ? t.textSecondary : mineText,
    tickRead: t.accentBlue,
    shadow: t.shadow,
    radiusBubble: 18,
    radiusGrouped: 7,
    radiusTail: 5,
    maxBubbleWidthPct: 0.75
  };
}

export function deliveryTickColor(tokens: ChatTokens, status?: string): string {
  if (status === "read") return tokens.tickRead;
  if (status === "delivered") return tokens.tickDelivered;
  return tokens.tickSent;
}

/** @deprecated Use `createChatTokens` / `useChatTheme` */
export const CHAT = {
  brand: R.ordersNavPurpleBright,
  brandSoft: `${R.accentPurple}24`,
  mineText: R.bg,
  theirsBg: R.bg,
  theirsUnreadBg: R.bg,
  unreadAccent: R.ordersNavPurpleBright,
  systemBg: R.bgElevated,
  systemBorder: R.border,
  tickSent: R.textMuted,
  tickDelivered: R.textSecondary,
  tickRead: R.accentBlue,
  radiusTail: 18,
  radiusInner: 6,
  radiusMicro: 4
} as const;
