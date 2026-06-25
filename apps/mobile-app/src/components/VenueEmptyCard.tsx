import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../theme/AppThemeContext";

type Props = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: object;
};

export function VenueEmptyCard({ title, message, actionLabel, onAction, style }: Props) {
  const { colors: t } = useAppTheme();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderRadius: 18,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.bgElevated,
          padding: 18
        },
        title: { fontSize: 17, fontWeight: "900", color: t.text },
        message: { marginTop: 8, fontSize: 14, lineHeight: 21, fontWeight: "600", color: t.textSecondary },
        action: {
          marginTop: 14,
          alignSelf: "flex-start",
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 10,
          backgroundColor: t.accentPurple
        },
        actionText: { color: "#fff", fontSize: 14, fontWeight: "800" },
        pressed: { opacity: 0.9 }
      }),
    [t]
  );

  return (
    <View style={[styles.card, style]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
