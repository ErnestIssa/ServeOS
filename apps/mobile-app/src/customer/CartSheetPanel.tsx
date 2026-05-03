import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { CartLineApi } from "./cartApi";
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
};

export function CartSheetPanel({
  lines,
  subtotalCents,
  totalQuantity,
  money,
  orderNote,
  onOrderNoteChange,
  placing,
  onPlaceOrder,
  onRemoveLine
}: Props) {
  return (
    <View style={styles.root} accessibilityLabel="Cart contents">
      <Text style={styles.title}>Your order</Text>
      <Text style={styles.sub}>
        {totalQuantity === 0 ? "Cart is empty" : `${totalQuantity} item${totalQuantity === 1 ? "" : "s"} · ${money(subtotalCents)}`}
      </Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {lines.length === 0 ? (
          <Text style={styles.empty}>Tap + on a dish on Home to add items here.</Text>
        ) : (
          lines.map((line) => (
            <View key={line.id} style={[styles.lineRow, line.stale ? styles.lineStale : null]}>
              <View style={styles.lineMain}>
                <Text style={styles.lineName} numberOfLines={2}>
                  {line.name}
                </Text>
                <Text style={styles.lineMeta}>
                  {line.quantity}× {money(line.unitPriceCents)}
                  {line.stale ? " · review" : ""}
                </Text>
              </View>
              <View style={styles.lineRight}>
                <Text style={styles.lineTotal}>{money(line.lineTotalCents)}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${line.name}`}
                  hitSlop={8}
                  style={({ pressed }) => [styles.removeBtn, pressed && styles.removeBtnPressed]}
                  onPress={() => onRemoveLine(line.id)}
                >
                  <Text style={styles.removeBtnText}>−</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Text style={styles.noteLabel}>Kitchen note</Text>
      <TextInput
        value={orderNote}
        onChangeText={onOrderNoteChange}
        placeholder="Optional"
        placeholderTextColor={R.textMuted}
        style={styles.noteInput}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Place order"
        disabled={placing || lines.length === 0}
        style={({ pressed }) => [
          styles.placeBtn,
          (placing || lines.length === 0) && styles.placeBtnDisabled,
          pressed && lines.length > 0 && !placing && styles.placeBtnPressed
        ]}
        onPress={onPlaceOrder}
      >
        {placing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.placeBtnText}>Place order · {money(subtotalCents)}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 10
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: R.text,
    letterSpacing: -0.4
  },
  sub: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "600",
    color: R.textSecondary
  },
  scroll: {
    flexGrow: 0,
    maxHeight: 220,
    marginTop: 14
  },
  scrollContent: {
    paddingBottom: 8,
    gap: 8
  },
  empty: {
    fontSize: 14,
    color: R.textMuted,
    lineHeight: 20,
    fontWeight: "500"
  },
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
  lineStale: {
    borderColor: "rgba(251,191,36,0.45)"
  },
  lineMain: { flex: 1, paddingRight: 10 },
  lineName: { fontSize: 15, fontWeight: "700", color: R.text },
  lineMeta: { marginTop: 4, fontSize: 12, fontWeight: "600", color: R.textSecondary },
  lineRight: { alignItems: "flex-end", gap: 6 },
  lineTotal: { fontSize: 15, fontWeight: "800", color: R.text },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(99,102,241,0.12)"
  },
  removeBtnPressed: { opacity: 0.85 },
  removeBtnText: { fontSize: 20, fontWeight: "700", color: R.accentPurple, marginTop: -2 },
  noteLabel: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: "700",
    color: R.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  noteInput: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: R.text,
    backgroundColor: "rgba(255,255,255,0.9)"
  },
  placeBtn: {
    marginTop: 14,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: R.accentPurple
  },
  placeBtnDisabled: { opacity: 0.45 },
  placeBtnPressed: { opacity: 0.92 },
  placeBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" }
});
