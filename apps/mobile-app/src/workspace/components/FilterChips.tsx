import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../theme/AppThemeContext";

type Chip = { id: string; label: string; count?: number };

type Props = {
  chips: Chip[];
  activeId: string;
  onChange: (id: string) => void;
};

export function FilterChips(props: Props) {
  const { colors: t } = useAppTheme();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: "row", gap: 8, paddingVertical: 4 },
        chip: {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.bgElevated
        },
        chipActive: { borderColor: t.accentPurple, backgroundColor: `${t.accentPurple}22` },
        label: { fontSize: 13, fontWeight: "700", color: t.textSecondary },
        labelActive: { color: t.accentPurple }
      }),
    [t]
  );

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {props.chips.map((c) => {
        const active = c.id === props.activeId;
        return (
          <Pressable
            key={c.id}
            onPress={() => props.onChange(c.id)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {c.label}
              {typeof c.count === "number" ? ` (${c.count})` : ""}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
