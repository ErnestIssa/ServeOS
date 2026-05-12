import React from "react";
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CartLineApi } from "./cartApi";
import { SwipePlaceOrderBar } from "./SwipePlaceOrderBar";
import { R } from "../theme";

type Props = {
  lines: CartLineApi[];
  subtotalCents: number;
  totalQuantity: number;
  money: (cents: number) => string;
  orderNote: string;
  onOrderNoteChange: (t: string) => void;
  placing: boolean;
  onPlaceOrder: () => void;
  onRemoveLine: (lineId: string) => void;
  onIncLine: (lineId: string) => void;
  onDecLine: (lineId: string) => void;
  onOpenInfo: () => void;
  userFirstName?: string | null;
  /** 0=closed-ish, 1=half-ish, 2=full-ish */
  sheetOpenStage?: 0 | 1 | 2;
  onRequestNoteFocus?: () => void;
};

function pickIndex(seed: string, modulo: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % modulo;
}

function timeBucket(hours = new Date().getHours()): "morning" | "afternoon" | "evening" | "late" {
  if (hours >= 5 && hours < 12) return "morning";
  if (hours < 17) return "afternoon";
  if (hours < 22) return "evening";
  return "late";
}

function buildNotePrompt(args: { firstName?: string | null; topItemName?: string | null; totalQuantity: number }) {
  const name = (args.firstName ?? "").trim();
  const who = name ? `, ${name}` : "";
  const item = (args.topItemName ?? "").trim();
  const hasItem = item.length > 0;
  const bucket = timeBucket();
  const dayKey = new Date().toISOString().slice(0, 10);
  const seed = `${dayKey}|${bucket}|${name}|${args.totalQuantity}|${item}`;

  const optsBase = [
    `Want to let the kitchen know something${who}?`,
    `Any notes for the kitchen${who}?`,
    `Anything we should tell the kitchen${who}?`
  ] as const;

  const optsWithItem = [
    `Anything the kitchen should know about your ${item}${who}?`,
    `Notes for your ${item}${who}?`,
    `Allergies or preferences for the ${item}${who}?`
  ] as const;

  const optsByTime =
    bucket === "morning"
      ? ([`Morning request${who}?`, `Quick note for the kitchen${who}?`] as const)
      : bucket === "evening"
        ? ([`Dinner preferences${who}?`, `Want anything adjusted${who}?`] as const)
        : bucket === "late"
          ? ([`Late-night tweaks${who}?`, `Anything to note for the kitchen${who}?`] as const)
          : ([`Anything we should tell the kitchen${who}?`, `Want to customize anything${who}?`] as const);

  const pool = hasItem ? [...optsWithItem, ...optsByTime] : [...optsBase, ...optsByTime];
  return pool[pickIndex(seed, pool.length)] ?? `Any notes for the kitchen${who}?`;
}

export function CartSheetPanel({
  lines,
  subtotalCents,
  totalQuantity,
  money,
  orderNote,
  onOrderNoteChange,
  placing,
  onPlaceOrder,
  onRemoveLine,
  onIncLine,
  onDecLine,
  onOpenInfo,
  userFirstName,
  sheetOpenStage = 0,
  onRequestNoteFocus
}: Props) {
  const insets = useSafeAreaInsets();
  const orderNoteLiveRef = React.useRef(orderNote);
  orderNoteLiveRef.current = orderNote;

  React.useEffect(() => {
    const ev = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const sub = Keyboard.addListener(ev, () => {
      onOrderNoteChange(orderNoteLiveRef.current.trim());
    });
    return () => sub.remove();
  }, [onOrderNoteChange]);

  const topItemName = lines[0]?.name ?? null;
  const showNoteArea = !(lines.length > 1 && sheetOpenStage < 2);
  const noteNeedsFull = sheetOpenStage < 2;
  const notePrompt = React.useMemo(
    () => buildNotePrompt({ firstName: userFirstName, topItemName, totalQuantity }),
    [userFirstName, topItemName, totalQuantity]
  );

  return (
    <KeyboardAvoidingView
      style={[
        styles.root,
        {
          // Lift the dock a bit more as the sheet opens beyond half / full.
          paddingBottom: Math.max(
            18,
            insets.bottom +
              22 +
              (sheetOpenStage === 2 ? 30 : sheetOpenStage === 1 ? 10 : 0)
          )
        }
      ]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 64 : 0}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Your order</Text>
          <Text style={styles.sub}>
            {totalQuantity === 0
              ? "Cart is empty"
              : `${totalQuantity} item${totalQuantity === 1 ? "" : "s"} · ${money(subtotalCents)}`}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Order info"
          hitSlop={10}
          onPress={onOpenInfo}
          style={({ pressed }) => [styles.infoBtn, pressed && styles.tapPressed]}
        >
          <Text style={styles.infoText}>i</Text>
        </Pressable>
      </View>

      <View style={styles.listWrap}>
        {lines.length === 0 ? (
          <Text style={styles.empty}>Tap + on a dish on Home to add items here.</Text>
        ) : (
          <FlatList
            data={lines}
            keyExtractor={(l) => l.id}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            renderItem={({ item: line }) => (
              <View style={[styles.lineRow, line.stale ? styles.lineStale : null]}>
                <View style={styles.lineMain}>
                  <Text style={styles.lineName} numberOfLines={2}>
                    {line.name}
                  </Text>
                  <Text style={styles.lineMeta}>
                    {money(line.unitPriceCents)} each{line.stale ? " · review" : ""}
                  </Text>
                  <View style={styles.qtyRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Decrease ${line.name}`}
                      hitSlop={8}
                      style={({ pressed }) => [styles.qtyBtn, pressed && styles.tapPressed]}
                      onPress={() => onDecLine(line.id)}
                    >
                      <Text style={styles.qtyBtnText}>−</Text>
                    </Pressable>
                    <Text style={styles.qtyText}>{line.quantity}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Increase ${line.name}`}
                      hitSlop={8}
                      style={({ pressed }) => [styles.qtyBtn, pressed && styles.tapPressed]}
                      onPress={() => onIncLine(line.id)}
                    >
                      <Text style={styles.qtyBtnText}>+</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.lineRight}>
                  <Text style={styles.lineTotal}>{money(line.lineTotalCents)}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${line.name}`}
                    hitSlop={8}
                    style={({ pressed }) => [styles.deleteBtn, pressed && styles.tapPressed]}
                    onPress={() => onRemoveLine(line.id)}
                  >
                    <DeleteLineIcon />
                  </Pressable>
                </View>
              </View>
            )}
          />
        )}
      </View>

      {showNoteArea ? (
        <View style={styles.noteWrap}>
          <TextInput
            value={orderNote}
            onChangeText={onOrderNoteChange}
            onBlur={() => onOrderNoteChange(orderNote.trim())}
            placeholder={notePrompt}
            placeholderTextColor="rgba(100,116,139,0.78)"
            style={styles.noteInput}
            multiline
            textAlignVertical="top"
            editable={!noteNeedsFull}
            autoFocus={false}
          />

          {noteNeedsFull && onRequestNoteFocus ? (
            <Pressable
              style={styles.noteTapOverlay}
              onPress={onRequestNoteFocus}
              accessibilityRole="button"
              accessibilityLabel="Expand panel to add a kitchen note"
            />
          ) : null}

        </View>
      ) : null}

      <View
        style={[
          styles.footerDock,
          // Push the button up as the sheet opens further (gives breathing room above the chrome bottom).
          sheetOpenStage === 2 ? { marginBottom: 28 } : sheetOpenStage === 1 ? { marginBottom: 12 } : null
        ]}
      >
        <SwipePlaceOrderBar
          disabled={lines.length === 0}
          placing={placing}
          label={`Place order · ${money(subtotalCents)}`}
          onCommit={onPlaceOrder}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function DeleteLineIcon() {
  const stroke = "#DC2626";
  const w = 2;
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path fill="none" d="M3 6h18" stroke={stroke} strokeWidth={w} strokeLinecap="round" />
      <Path
        fill="none"
        d="M8 6V5a2 2 0 012-2h4a2 2 0 012 2v1"
        stroke={stroke}
        strokeWidth={w}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        fill="none"
        d="M19 6v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6"
        stroke={stroke}
        strokeWidth={w}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path fill="none" d="M10 11v5M14 11v5" stroke={stroke} strokeWidth={w} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 14
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 20, fontWeight: "800", color: R.text, letterSpacing: -0.4 },
  sub: { marginTop: 4, fontSize: 13, fontWeight: "600", color: R.textSecondary },
  infoBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#DC2626",
    backgroundColor: "transparent"
  },
  infoText: { fontSize: 12, fontWeight: "900", color: "#DC2626" },
  tapPressed: { opacity: 0.85 },
  listWrap: { flex: 1, marginTop: 14 },
  listContent: { paddingBottom: 10, gap: 10 },
  empty: { fontSize: 14, color: R.textMuted, lineHeight: 20, fontWeight: "500" },
  lineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: R.radius.card,
    backgroundColor: "rgba(248,250,252,0.95)",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)"
  },
  lineStale: { borderColor: "rgba(251,191,36,0.45)" },
  lineMain: { flex: 1, paddingRight: 10 },
  lineName: { fontSize: 15, fontWeight: "700", color: R.text },
  lineMeta: { marginTop: 4, fontSize: 12, fontWeight: "600", color: R.textSecondary },
  qtyRow: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  qtyBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(99,102,241,0.12)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.18)"
  },
  qtyBtnText: { fontSize: 18, fontWeight: "900", color: R.accentPurple, marginTop: -1 },
  qtyText: { minWidth: 22, textAlign: "center", fontSize: 15, fontWeight: "900", color: R.text },
  lineRight: { alignItems: "flex-end", gap: 10 },
  lineTotal: { fontSize: 15, fontWeight: "800", color: R.text },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(220,38,38,0.08)",
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.35)"
  },
  noteWrap: { marginTop: 12 },
  noteTapOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16
  },
  noteInput: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: R.text,
    backgroundColor: "rgba(255,255,255,0.92)",
    minHeight: 56,
    maxHeight: 110,
    lineHeight: 20
  },
  footerDock: { marginTop: 12, paddingTop: 2, paddingBottom: 6 }
});
