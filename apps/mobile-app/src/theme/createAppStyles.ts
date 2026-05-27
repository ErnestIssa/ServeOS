import { Platform, StyleSheet } from "react-native";
import type { ThemeColors } from "./AppThemeContext";
import { themedCardShell, themedInputBg, themedPillGhost } from "./syncLegacyTheme";

export function createAppStyles(t: ThemeColors, isDark: boolean) {
  const card = themedCardShell(isDark, t);
  const inputBg = themedInputBg(isDark, t);
  const ghost = themedPillGhost(isDark, t);

  return StyleSheet.create({
    sheetBackdropTapClose: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 19
    },
    cartFabPortal: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 13,
      elevation: 0
    },
    splashOnly: { flex: 1, backgroundColor: "#8B5CF6" },
    sessionLoading: { flex: 1, backgroundColor: "#8B5CF6", alignItems: "center", justifyContent: "center" },
    sessionHint: { marginTop: 16, textAlign: "center", color: "rgba(255,255,255,0.88)", fontSize: 14, fontWeight: "600" },
    shell: { flex: 1, backgroundColor: "transparent" },
    main: { flex: 1, position: "relative" },
    scrollLayer: { flex: 1, zIndex: 1 },
    scrollPad: { paddingHorizontal: t.space.sm },
    scrollPadHomeBleed: { paddingHorizontal: 0 },
    customerHomeCopyInset: { paddingHorizontal: t.space.sm },

    customerHeroGreeting: {
      fontSize: 26,
      fontWeight: "800",
      color: t.text,
      letterSpacing: -0.35,
      lineHeight: 32
    },
    customerHeroSub: {
      fontSize: t.type.body,
      color: t.textSecondary,
      marginTop: t.space.sm,
      lineHeight: 22,
      fontWeight: "500"
    },
    customerCtaColumn: {
      marginTop: t.space.md,
      alignItems: "stretch",
      gap: t.space.sm
    },
    customerPrimaryCta: { alignSelf: "stretch" },
    customerSecondaryCta: {
      textAlign: "center",
      fontSize: t.type.label,
      fontWeight: "700",
      color: t.accentPurple,
      paddingVertical: 8
    },

    heroGreeting: { fontSize: t.type.label, color: t.textSecondary, fontWeight: "500" },
    heroTitle: { fontSize: t.type.hero, fontWeight: "800", color: t.text, letterSpacing: -0.5, marginTop: 4 },
    heroSub: { fontSize: t.type.body, color: t.textSecondary, marginTop: t.space.xs, lineHeight: 22 },

    cardShell: {
      ...card,
      borderRadius: t.radius.card,
      borderWidth: 1,
      ...Platform.select({
        ios: { shadowColor: "#0f172a", shadowOffset: { width: 0, height: 6 }, shadowOpacity: isDark ? 0.2 : 0.06, shadowRadius: 16 },
        android: { elevation: 3 }
      })
    },
    heroCard: { marginTop: t.space.md, padding: t.space.md },
    heroAccent: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 4,
      borderTopLeftRadius: t.radius.card,
      borderTopRightRadius: t.radius.card,
      backgroundColor: t.accentPurple
    },
    cardLabel: { fontSize: t.type.caption, color: t.textSecondary, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6 },
    heroMetric: { fontSize: 40, fontWeight: "800", color: t.text, marginTop: 8, letterSpacing: -1 },
    cardCaption: { fontSize: t.type.label, color: t.textMuted, marginTop: 4 },
    heroActions: { flexDirection: "row", gap: t.space.xs, marginTop: t.space.md, flexWrap: "wrap" },

    pillPrimary: {
      backgroundColor: t.accentPurple,
      paddingVertical: 14,
      paddingHorizontal: t.space.md,
      borderRadius: t.radius.pill,
      alignItems: "center",
      minWidth: 120
    },
    pillPrimaryText: { color: "#FFFFFF", fontSize: t.type.label, fontWeight: "700" },
    pillGhost: {
      borderWidth: 1,
      ...ghost,
      paddingVertical: 14,
      paddingHorizontal: t.space.md,
      borderRadius: t.radius.pill,
      alignItems: "center"
    },
    pillGhostText: { color: t.text, fontSize: t.type.label, fontWeight: "600" },
    pillSecondary: {
      borderWidth: 1.5,
      borderColor: t.accentBlue,
      paddingVertical: 12,
      borderRadius: t.radius.pill,
      alignItems: "center"
    },
    pillSecondaryText: { color: t.accentBlue, fontSize: t.type.label, fontWeight: "700" },
    pressed: { opacity: 0.88 },
    disabled: { opacity: 0.4 },

    sectionLabel: { fontSize: t.type.label, fontWeight: "700", color: t.text, marginTop: t.space.lg, marginBottom: t.space.xs },
    sectionLabelSmall: {
      fontSize: t.type.label,
      fontWeight: "800",
      color: t.text,
      marginBottom: t.space.xs,
      letterSpacing: 0.2
    },
    premiumBadgeRow: { marginBottom: t.space.sm },
    premiumBadge: {
      alignSelf: "flex-start",
      fontSize: 11,
      fontWeight: "800",
      color: t.accentPurple,
      textTransform: "uppercase",
      letterSpacing: 1.1,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: isDark ? "rgba(167, 139, 250, 0.2)" : "rgba(139,92,246,0.12)",
      overflow: "hidden"
    },
    cardHeadline: { fontSize: t.type.title, fontWeight: "800", color: t.text, letterSpacing: -0.3 },
    cardBodyMuted: { fontSize: t.type.body, color: t.textSecondary, marginTop: t.space.xs, lineHeight: 22 },
    tileRow: { flexDirection: "row", gap: t.space.sm, marginTop: t.space.xs },
    tile: { flex: 1, borderRadius: t.radius.tile, padding: t.space.sm },
    tileEmoji: { fontSize: 22, marginBottom: 4 },
    tileTitle: { fontSize: t.type.label, fontWeight: "700", color: t.text },
    tileSub: { fontSize: t.type.caption, color: t.textSecondary, marginTop: 4 },

    banner: { marginTop: t.space.md, fontSize: t.type.caption, color: t.danger },

    pageTitle: { fontSize: t.type.title, fontWeight: "800", color: t.text },
    pageSub: { fontSize: t.type.label, color: t.textSecondary, marginTop: 6, marginBottom: t.space.md, lineHeight: 20 },

    fieldCard: { padding: t.space.sm, marginBottom: t.space.sm },
    surfaceCard: { padding: t.space.md, marginBottom: t.space.sm },
    inputLabel: { fontSize: t.type.caption, fontWeight: "600", color: t.textSecondary, marginBottom: 6 },
    input: {
      borderWidth: 1,
      borderRadius: t.radius.input,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === "ios" ? 14 : 10,
      fontSize: t.type.body,
      ...inputBg
    },
    mtSm: { marginTop: t.space.sm },

    itemName: { fontSize: t.type.body, fontWeight: "600", color: t.text },
    itemDesc: { fontSize: t.type.caption, color: t.textSecondary, marginTop: 2 },
    itemPrice: { fontSize: t.type.body, fontWeight: "700", color: t.text },

    trackBox: {
      marginTop: t.space.sm,
      padding: t.space.sm,
      backgroundColor: isDark ? t.bgElevated : "rgba(248,250,252,0.96)",
      borderRadius: t.radius.tile,
      borderWidth: 1,
      borderColor: t.border
    },
    trackVenue: { fontSize: t.type.body, fontWeight: "700", color: t.text },
    trackLine: { fontSize: t.type.label, color: t.textSecondary, marginTop: 4 },
    orderRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.border },
    hint: { fontSize: t.type.caption, color: t.textMuted, marginTop: t.space.sm },

    venueCard: {
      padding: t.space.sm,
      borderRadius: t.radius.tile,
      marginBottom: t.space.xs
    },
    mono: { fontSize: 11, color: t.textMuted, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }
  });
}

export type AppStyles = ReturnType<typeof createAppStyles>;
