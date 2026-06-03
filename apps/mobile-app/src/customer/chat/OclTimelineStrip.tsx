import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../theme/AppThemeContext";

type Row = { key: string; content: string; kind: string; at?: string };

type Props = {
  rows: Row[];
};

/** Compact system timeline above chat messages (customer — active order only). */
export function OclTimelineStrip(props: Props) {
  const { colors: t } = useAppTheme();
  if (!props.rows.length) return null;

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          marginBottom: 12,
          padding: 12,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.bgElevated
        },
        label: {
          fontSize: 11,
          fontWeight: "800",
          letterSpacing: 0.5,
          color: t.textMuted,
          marginBottom: 8,
          textTransform: "uppercase"
        },
        row: { flexDirection: "row", gap: 8, marginBottom: 6, alignItems: "flex-start" },
        dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.accentPurple, marginTop: 6 },
        text: { flex: 1, fontSize: 13, fontWeight: "600", color: t.text }
      }),
    [t]
  );

  const recent = props.rows.slice(-4);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Order updates</Text>
      {recent.map((r) => (
        <View key={r.key} style={styles.row}>
          <View style={styles.dot} />
          <Text style={styles.text}>{r.content}</Text>
        </View>
      ))}
    </View>
  );
}
