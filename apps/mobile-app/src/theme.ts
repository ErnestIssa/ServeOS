/** Revolut-inspired fintech surface (light, premium, data-forward). */
export const R = {
  bg: "#FFFFFF",
  bgSubtle: "#F3F4F6",
  bgElevated: "#F9FAFB",
  text: "#111111",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  /** Tab bar: inactive icons/labels read clearly without looking “disabled”. */
  navIconIdle: "#475569",
  navLabelIdle: "#475569",
  border: "#E5E7EB",
  borderStrong: "#D1D5DB",
  accentBlue: "#3B82F6",
  accentPurple: "#8B5CF6",
  /** Distinct tab accent for Orders (fork-in-circle mark) */
  ordersNavPurple: "#6D28D9",
  ordersNavPurpleBright: "#7C3AED",
  success: "#10B981",
  danger: "#EF4444",
  shadow: "rgba(17, 24, 39, 0.06)",
  space: { xs: 8, sm: 16, md: 24, lg: 32 },
  radius: { card: 20, tile: 16, input: 14, pill: 999 },
  type: {
    hero: 32,
    title: 20,
    body: 16,
    label: 13,
    caption: 12
  }
} as const;
