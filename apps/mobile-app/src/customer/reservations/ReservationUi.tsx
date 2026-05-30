import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { R } from "../../theme";
import { useAppTheme } from "../../theme/AppThemeContext";
import { ReservationThreeDotLoader } from "./ReservationThreeDotLoader";

function useThemedTap() {
  const { colors: t, isDark } = useAppTheme();
  return {
    accent: t.ordersNavPurpleBright,
    selectedBg: isDark ? "rgba(167,139,250,0.22)" : "rgba(167,139,250,0.14)",
    border: isDark ? "rgba(148,163,184,0.26)" : R.border,
    bg: isDark ? "rgba(15,23,42,0.52)" : R.bg,
    bgElevated: isDark ? "rgba(30,41,59,0.55)" : R.bgElevated,
    text: t.text,
    textMuted: t.textSecondary
  };
}

function tapHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function ReservationSection(props: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const themed = useThemedTap();
  return (
    <View style={[styles.section, props.style]}>
      <Text style={[styles.sectionTitle, { color: themed.accent }]}>{props.title}</Text>
      {props.subtitle ? (
        <Text style={[styles.sectionSub, { color: themed.textMuted }]}>{props.subtitle}</Text>
      ) : null}
      {props.children}
    </View>
  );
}

/** Full-width tappable row — primary interaction pattern for booking. */
export function TapTile(props: {
  label: string;
  sublabel?: string;
  selected?: boolean;
  onPress: () => void;
  accent?: "default" | "success" | "muted";
}) {
  const accent = props.accent ?? "default";
  const themed = useThemedTap();
  return (
    <Pressable
      onPress={() => {
        tapHaptic();
        props.onPress();
      }}
      style={({ pressed }) => [
        styles.tapTile,
        {
          borderColor: props.selected ? themed.accent : themed.border,
          backgroundColor: props.selected ? themed.selectedBg : accent === "muted" ? themed.bgElevated : themed.bg
        },
        accent === "success" && styles.tapTileSuccess,
        pressed && styles.tapPressed
      ]}
    >
      <Text style={[styles.tapTileLabel, { color: props.selected ? themed.accent : themed.text }]}>
        {props.label}
      </Text>
      {props.sublabel ? (
        <Text style={[styles.tapTileSub, { color: props.selected ? themed.accent : themed.textMuted }]}>
          {props.sublabel}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Two-column grid of large tap targets (guests, times). */
export function TapGrid(props: {
  options: ReadonlyArray<{ id: string; label: string; sublabel?: string }>;
  selectedId: string | null;
  onSelect: (id: string, label: string) => void; // label passed for convenience
  columns?: 2 | 3;
}) {
  const cols = props.columns ?? 2;
  const themed = useThemedTap();
  return (
    <View style={styles.tapGrid}>
      {props.options.map((opt) => {
        const selected = props.selectedId === opt.id;
        return (
          <Pressable
            key={opt.id}
            onPress={() => {
              tapHaptic();
              props.onSelect(opt.id, opt.label);
            }}
            style={({ pressed }) => [
              cols === 3 ? styles.tapGridCell3 : styles.tapGridCell2,
              {
                borderColor: selected ? themed.accent : themed.border,
                backgroundColor: selected ? themed.selectedBg : themed.bg
              },
              pressed && styles.tapPressed
            ]}
          >
            <Text style={[styles.tapGridLabel, { color: selected ? themed.accent : themed.text }]}>{opt.label}</Text>
            {opt.sublabel ? (
              <Text style={[styles.tapGridSub, { color: selected ? themed.accent : themed.textMuted }]}>
                {opt.sublabel}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Compact row of large pills (still tap-only, no keyboard). */
export function TapPillRow(props: {
  options: ReadonlyArray<string>;
  selected: string | null;
  onSelect: (value: string) => void;
}) {
  const themed = useThemedTap();
  return (
    <View style={styles.pillRow}>
      {props.options.map((opt) => {
        const selected = props.selected === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => {
              tapHaptic();
              props.onSelect(opt);
            }}
            style={({ pressed }) => [
              styles.tapPill,
              {
                borderColor: selected ? themed.accent : themed.border,
                backgroundColor: selected ? themed.selectedBg : themed.bg
              },
              pressed && styles.tapPressed
            ]}
          >
            <Text style={[styles.tapPillText, { color: selected ? themed.accent : themed.textMuted }]}>{opt}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** On/off as a big card (replaces small switches). */
export function TapToggleCard(props: { label: string; sublabel?: string; on: boolean; onPress: () => void }) {
  const themed = useThemedTap();
  return (
    <Pressable
      onPress={() => {
        tapHaptic();
        props.onPress();
      }}
      style={({ pressed }) => [
        styles.toggleCard,
        {
          borderColor: props.on ? themed.accent : themed.border,
          backgroundColor: props.on ? themed.selectedBg : themed.bgElevated
        },
        pressed && styles.tapPressed
      ]}
    >
      <View style={styles.toggleCardInner}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.toggleLabel, { color: props.on ? themed.accent : themed.text }]}>{props.label}</Text>
          {props.sublabel ? (
            <Text style={[styles.toggleSub, { color: themed.textMuted }]}>{props.sublabel}</Text>
          ) : null}
        </View>
        <View style={[styles.toggleDot, { backgroundColor: props.on ? themed.accent : themed.border }]}>
          <Text style={styles.toggleDotText}>{props.on ? "On" : "Off"}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function ReservationPrimaryButton(props: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "default" | "purple";
}) {
  const purple = props.variant === "purple";
  const blocked = props.disabled || props.loading;
  return (
    <Pressable
      disabled={blocked}
      onPress={() => {
        if (props.loading) return;
        tapHaptic();
        props.onPress();
      }}
      style={({ pressed }) => [
        styles.primaryBtn,
        purple && styles.primaryBtnPurple,
        blocked && styles.primaryBtnDisabled,
        pressed && !blocked && styles.tapPressed
      ]}
    >
      {props.loading ? (
        <ReservationThreeDotLoader color="#FFFFFF" />
      ) : (
        <Text style={styles.primaryBtnText}>{props.label}</Text>
      )}
    </Pressable>
  );
}

export function ReservationGhostButton(props: { label: string; onPress: () => void; danger?: boolean }) {
  const themed = useThemedTap();
  return (
    <Pressable
      onPress={() => {
        tapHaptic();
        props.onPress();
      }}
      style={({ pressed }) => [
        styles.ghostBtn,
        { borderColor: props.danger ? "rgba(239, 68, 68, 0.45)" : themed.border, backgroundColor: themed.bg },
        props.danger && styles.ghostBtnDanger,
        pressed && styles.tapPressed
      ]}
    >
      <Text style={[styles.ghostBtnText, { color: props.danger ? R.danger : themed.text }]}>{props.label}</Text>
    </Pressable>
  );
}

export function ReservationMapPlaceholder(props: { onSelectTable: (id: string, label: string) => void; selectedId: string | null }) {
  const themed = useThemedTap();
  return (
    <View style={[styles.mapBox, { borderColor: themed.border, backgroundColor: themed.bgElevated }]}>
      <Text style={[styles.mapHint, { color: themed.textMuted }]}>Tap a zone</Text>
      <View style={styles.mapRow}>
        {["Window", "Booth", "Bar"].map((zone) => {
          const selected = props.selectedId === zone.toLowerCase();
          return (
            <Pressable
              key={zone}
              onPress={() => {
                tapHaptic();
                props.onSelectTable(zone.toLowerCase(), zone);
              }}
              style={({ pressed }) => [
                styles.mapZone,
                {
                  borderColor: selected ? themed.accent : themed.border,
                  backgroundColor: selected ? themed.selectedBg : themed.bg
                },
                pressed && styles.tapPressed
              ]}
            >
              <Text style={[styles.mapZoneText, { color: selected ? themed.accent : themed.text }]}>{zone}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const TILE_MIN = 56;
const BTN_MIN = 56;

const styles = StyleSheet.create({
  section: { marginTop: R.space.md },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.35,
    marginBottom: 12
  },
  sectionSub: {
    fontSize: R.type.caption,
    fontWeight: "600",
    color: R.textSecondary,
    marginBottom: 12,
    lineHeight: 17
  },
  tapPressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  tapTile: {
    minHeight: TILE_MIN,
    borderRadius: R.radius.tile,
    borderWidth: 2,
    borderColor: R.border,
    backgroundColor: R.bg,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 10,
    justifyContent: "center"
  },
  tapTileSuccess: { borderColor: "rgba(16, 185, 129, 0.35)", backgroundColor: "rgba(16, 185, 129, 0.06)" },
  tapTileMuted: { backgroundColor: R.bgElevated },
  tapTileSelected: {
    borderColor: R.accentBlue,
    backgroundColor: "rgba(59, 130, 246, 0.12)"
  },
  tapTileLabel: { fontSize: 18, fontWeight: "800", color: R.text },
  tapTileLabelSelected: { color: R.accentBlue },
  tapTileSub: { marginTop: 4, fontSize: R.type.label, fontWeight: "600", color: R.textSecondary },
  tapTileSubSelected: { color: R.accentBlue },
  tapGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -5
  },
  tapGridCell2: {
    width: "50%",
    paddingHorizontal: 5,
    marginBottom: 10,
    minHeight: TILE_MIN,
    borderRadius: R.radius.tile,
    borderWidth: 2,
    borderColor: R.border,
    backgroundColor: R.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14
  },
  tapGridCell3: {
    width: "33.333%",
    paddingHorizontal: 4,
    marginBottom: 8,
    minHeight: 52,
    borderRadius: R.radius.tile,
    borderWidth: 2,
    borderColor: R.border,
    backgroundColor: R.bg,
    alignItems: "center",
    justifyContent: "center"
  },
  tapGridCellSelected: {
    borderColor: R.accentBlue,
    backgroundColor: "rgba(59, 130, 246, 0.12)"
  },
  tapGridLabel: { fontSize: 20, fontWeight: "900", color: R.text },
  tapGridLabelSelected: { color: R.accentBlue },
  tapGridSub: { marginTop: 2, fontSize: 11, fontWeight: "700", color: R.textMuted },
  tapGridSubSelected: { color: R.accentBlue },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tapPill: {
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: R.radius.pill,
    borderWidth: 2,
    borderColor: R.border,
    backgroundColor: R.bg,
    justifyContent: "center"
  },
  tapPillSelected: {
    borderColor: R.accentBlue,
    backgroundColor: "rgba(59, 130, 246, 0.12)"
  },
  tapPillText: { fontSize: 16, fontWeight: "800", color: R.textSecondary },
  tapPillTextSelected: { color: R.accentBlue },
  toggleCard: {
    minHeight: TILE_MIN,
    borderRadius: R.radius.tile,
    borderWidth: 2,
    borderColor: R.border,
    backgroundColor: R.bgElevated,
    padding: 16,
    marginBottom: 10
  },
  toggleCardOn: {
    borderColor: R.accentBlue,
    backgroundColor: "rgba(59, 130, 246, 0.1)"
  },
  toggleCardInner: { flexDirection: "row", alignItems: "center" },
  toggleLabel: { fontSize: 17, fontWeight: "800", color: R.text },
  toggleLabelOn: { color: R.accentBlue },
  toggleSub: { marginTop: 4, fontSize: R.type.caption, fontWeight: "600", color: R.textMuted },
  toggleSubOn: { color: R.textSecondary },
  toggleDot: {
    minWidth: 52,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: R.radius.pill,
    backgroundColor: R.border,
    alignItems: "center"
  },
  toggleDotOn: { backgroundColor: R.accentBlue },
  toggleDotText: { fontSize: 13, fontWeight: "900", color: R.bg },
  primaryBtn: {
    minHeight: BTN_MIN,
    backgroundColor: R.text,
    borderRadius: R.radius.tile,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8
  },
  primaryBtnPurple: {
    backgroundColor: R.ordersNavPurpleBright
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: {
    color: R.bg,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.2
  },
  ghostBtn: {
    minHeight: 52,
    borderRadius: R.radius.tile,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: R.border,
    backgroundColor: R.bg,
    marginTop: 10
  },
  ghostBtnDanger: { borderColor: "rgba(239, 68, 68, 0.45)", backgroundColor: "rgba(239, 68, 68, 0.06)" },
  ghostBtnText: { fontSize: 17, fontWeight: "800", color: R.text },
  ghostBtnTextDanger: { color: R.danger },
  mapBox: {
    borderRadius: R.radius.card,
    borderWidth: 2,
    borderColor: R.border,
    borderStyle: "dashed",
    backgroundColor: R.bgElevated,
    padding: R.space.sm,
    marginBottom: 10
  },
  mapHint: {
    fontSize: R.type.label,
    fontWeight: "700",
    color: R.textMuted,
    textAlign: "center",
    marginBottom: 12
  },
  mapRow: { flexDirection: "row", gap: 10 },
  mapZone: {
    flex: 1,
    minHeight: 72,
    borderRadius: R.radius.tile,
    borderWidth: 2,
    borderColor: R.border,
    backgroundColor: R.bg,
    alignItems: "center",
    justifyContent: "center"
  },
  mapZoneSelected: {
    borderColor: R.accentBlue,
    backgroundColor: "rgba(59, 130, 246, 0.12)"
  },
  mapZoneText: { fontSize: 16, fontWeight: "800", color: R.text }
});
