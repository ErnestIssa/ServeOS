import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatDisplayMoney } from "../../formatMoney";
import { useAppTheme } from "../../theme/AppThemeContext";

export type OrderCardData = {
  id: string;
  status: string;
  statusLabel: string;
  totalCents: number;
  serviceLabel: string;
  tableLabel: string | null;
  elapsedMinutes: number;
  delayed: boolean;
  lineCount: number;
  note?: string | null;
  nextStatus: string | null;
  nextStatusLabel: string | null;
  lines: Array<{ name: string; quantity: number; lineTotalCents: number; modifiers: unknown[] }>;
};

type Props = {
  order: OrderCardData;
  selected?: boolean;
  onPress: () => void;
  onAdvance?: () => void;
};

export function OrderCard(props: Props) {
  const { colors: t } = useAppTheme();
  const o = props.order;
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderWidth: 1,
          borderColor: props.selected ? t.accentPurple : o.delayed ? t.danger : t.border,
          borderRadius: t.radius.card,
          padding: t.space.md,
          marginBottom: t.space.sm,
          backgroundColor: t.bgElevated
        },
        top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
        id: { fontSize: 12, fontWeight: "700", color: t.textMuted },
        status: {
          fontSize: 12,
          fontWeight: "800",
          color: o.delayed ? t.danger : t.accentPurple,
          textTransform: "uppercase"
        },
        title: { marginTop: 6, fontSize: 17, fontWeight: "900", color: t.text },
        sub: { marginTop: 4, fontSize: 13, fontWeight: "600", color: t.textSecondary },
        item: { marginTop: 6, fontSize: 14, fontWeight: "600", color: t.text },
        note: { marginTop: 8, fontSize: 13, fontStyle: "italic", color: t.textMuted },
        btn: {
          marginTop: 12,
          alignSelf: "flex-start",
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderRadius: 12,
          backgroundColor: t.accentPurple
        },
        btnText: { color: "#fff", fontWeight: "800", fontSize: 13 }
      }),
    [t, o.delayed, props.selected]
  );

  return (
    <Pressable style={styles.card} onPress={props.onPress}>
      <View style={styles.top}>
        <Text style={styles.id}>#{o.id.slice(-6).toUpperCase()}</Text>
        <Text style={styles.status}>{o.statusLabel}</Text>
      </View>
      <Text style={styles.title}>
        {o.serviceLabel}
        {o.tableLabel ? ` · ${o.tableLabel}` : ""} · {formatDisplayMoney(o.totalCents)}
      </Text>
      <Text style={styles.sub}>
        {o.lineCount} item{o.lineCount === 1 ? "" : "s"} · {o.elapsedMinutes}m ago
        {o.delayed ? " · delayed" : ""}
      </Text>
      {o.lines.slice(0, 4).map((l, i) => (
        <Text key={`${l.name}-${i}`} style={styles.item}>
          {l.quantity}× {l.name}
        </Text>
      ))}
      {o.note ? <Text style={styles.note}>Note: {o.note}</Text> : null}
      {o.nextStatus && props.onAdvance ? (
        <Pressable
          style={styles.btn}
          onPress={(e) => {
            e.stopPropagation?.();
            props.onAdvance?.();
          }}
        >
          <Text style={styles.btnText}>{o.nextStatusLabel ?? `Mark ${o.nextStatus}`}</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}
