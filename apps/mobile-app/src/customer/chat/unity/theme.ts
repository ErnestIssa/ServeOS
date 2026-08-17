/** UNITY chat visual tokens — exact parity with the rebuild guide. */

export const CHAT_BACKGROUND = "#ECE5DD";

export const colors = {
  brand: "#175F61",
  brandDark: "#0F4547",
  brandLight: "#E6F3F3",
  brandMuted: "rgba(23, 95, 97, 0.12)",
  blue: "#3B82C4",
  green: "#22A06B",
  greenLight: "#E8F7EF",
  white: "#FFFFFF",
  background: "#F4F9F9",
  card: "#FFFFFF",
  text: "#142B2C",
  textSecondary: "#4A6365",
  textMuted: "#7A9496",
  border: "rgba(23, 95, 97, 0.1)",
  glass: "rgba(255, 255, 255, 0.78)",
  glassBorder: "rgba(255, 255, 255, 0.95)",
  shadow: "rgba(23, 95, 97, 0.18)",
  success: "#22A06B",
  warning: "#E5A100",
  danger: "#D64545",
  ownBubble: "#DCF8C6",
  primaryText: "#111B21",
  whatsAppGray: "#667781",
  ownMention: "#0B6E62",
  tickRead: "#53BDEB",
  replyOwn: "#128C7E"
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  full: 999
};

export const shadows = {
  card: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6
  },
  float: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 12
  }
};
