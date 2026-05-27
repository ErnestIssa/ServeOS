import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { R } from "../../theme";
import { ReservationThreeDotLoader } from "./ReservationThreeDotLoader";

function tapHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function ReservationSection(props: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.section, props.style]}>
      <Text style={styles.sectionTitle}>{props.title}</Text>
      {props.subtitle ? <Text style={styles.sectionSub}>{props.subtitle}</Text> : null}
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
  return (
    <Pressable
      onPress={() => {
        tapHaptic();
        props.onPress();
      }}
      style={({ pressed }) => [
        styles.tapTile,
        accent === "success" && styles.tapTileSuccess,
        accent === "muted" && styles.tapTileMuted,
        props.selected && styles.tapTileSelected,
        pressed && styles.tapPressed
      ]}
    >
      <Text style={[styles.tapTileLabel, props.selected && styles.tapTileLabelSelected]}>{props.label}</Text>
      {props.sublabel ? (
        <Text style={[styles.tapTileSub, props.selected && styles.tapTileSubSelected]}>{props.sublabel}</Text>
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
  return (
    <View style={styles.tapGrid}>
      {props.options.map((opt) => (
        <Pressable
          key={opt.id}
          onPress={() => {
            tapHaptic();
            props.onSelect(opt.id, opt.label);
          }}
          style={({ pressed }) => [
            cols === 3 ? styles.tapGridCell3 : styles.tapGridCell2,
            props.selectedId === opt.id && styles.tapGridCellSelected,
            pressed && styles.tapPressed
          ]}
        >
          <Text style={[styles.tapGridLabel, props.selectedId === opt.id && styles.tapGridLabelSelected]}>
            {opt.label}
          </Text>
          {opt.sublabel ? (
            <Text style={[styles.tapGridSub, props.selectedId === opt.id && styles.tapGridSubSelected]}>{opt.sublabel}</Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

/** Compact row of large pills (still tap-only, no keyboard). */
export function TapPillRow(props: {
  options: ReadonlyArray<string>;
  selected: string | null;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.pillRow}>
      {props.options.map((opt) => (
        <Pressable
          key={opt}
          onPress={() => {
            tapHaptic();
            props.onSelect(opt);
          }}
          style={({ pressed }) => [
            styles.tapPill,
            props.selected === opt && styles.tapPillSelected,
            pressed && styles.tapPressed
          ]}
        >
          <Text style={[styles.tapPillText, props.selected === opt && styles.tapPillTextSelected]}>{opt}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** On/off as a big card (replaces small switches). */
export function TapToggleCard(props: { label: string; sublabel?: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        tapHaptic();
        props.onPress();
      }}
      style={({ pressed }) => [styles.toggleCard, props.on && styles.toggleCardOn, pressed && styles.tapPressed]}
    >
      <View style={styles.toggleCardInner}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.toggleLabel, props.on && styles.toggleLabelOn]}>{props.label}</Text>
          {props.sublabel ? (
            <Text style={[styles.toggleSub, props.on && styles.toggleSubOn]}>{props.sublabel}</Text>
          ) : null}
        </View>
        <View style={[styles.toggleDot, props.on && styles.toggleDotOn]}>
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
  return (
    <Pressable
      onPress={() => {
        tapHaptic();
        props.onPress();
      }}
      style={({ pressed }) => [
        styles.ghostBtn,
        props.danger && styles.ghostBtnDanger,
        pressed && styles.tapPressed
      ]}
    >
      <Text style={[styles.ghostBtnText, props.danger && styles.ghostBtnTextDanger]}>{props.label}</Text>
    </Pressable>
  );
}

export function ReservationMapPlaceholder(props: { onSelectTable: (id: string, label: string) => void; selectedId: string | null }) {
  return (
    <View style={styles.mapBox}>
      <Text style={styles.mapHint}>Tap a zone</Text>
      <View style={styles.mapRow}>
        {["Window", "Booth", "Bar"].map((zone) => (
          <Pressable
            key={zone}
            onPress={() => {
              tapHaptic();
              props.onSelectTable(zone.toLowerCase(), zone);
            }}
            style={({ pressed }) => [
              styles.mapZone,
              props.selectedId === zone.toLowerCase() && styles.mapZoneSelected,
              pressed && styles.tapPressed
            ]}
          >
            <Text style={styles.mapZoneText}>{zone}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const TILE_MIN = 56;
const BTN_MIN = 56;

const styles = StyleSheet.create({
  section: { marginTop: R.space.md },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: R.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 8
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
