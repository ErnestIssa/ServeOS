import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { WorkspaceMembership } from "../mobile/workspaceApi";
import { useAppTheme } from "../theme/AppThemeContext";
import { hapticSelect } from "../customer/profile/ProfileUi";

type Props = {
  memberships: WorkspaceMembership[];
  activeRestaurantId: string | null;
  onSelect: (restaurantId: string) => void;
};

export function WorkspaceVenuePicker(props: Props) {
  const { colors: t } = useAppTheme();
  const { memberships, activeRestaurantId } = props;

  if (memberships.length <= 1) return null;

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        wrap: { marginBottom: t.space.md },
        label: { fontSize: 12, fontWeight: "800", color: t.textMuted, marginBottom: 8, letterSpacing: 0.4 },
        row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
        chip: {
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.bgElevated
        },
        chipActive: {
          borderColor: t.accentPurple,
          backgroundColor: t.bgElevated
        },
        chipText: { fontSize: 13, fontWeight: "700", color: t.textSecondary },
        chipTextActive: { color: t.accentPurple }
      }),
    [t]
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>ACTIVE VENUE</Text>
      <View style={styles.row}>
        {memberships.map((m) => {
          const active = m.restaurantId === activeRestaurantId;
          return (
            <Pressable
              key={m.restaurantId}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => {
                hapticSelect();
                props.onSelect(m.restaurantId);
              }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{m.restaurantName}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
