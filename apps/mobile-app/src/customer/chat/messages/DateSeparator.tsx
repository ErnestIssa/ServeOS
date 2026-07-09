import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useChatTheme } from "../useChatTheme";

type Props = { label: string };

export const DateSeparator = React.memo(function DateSeparator({ label }: Props) {
  const { tokens, colors: t } = useChatTheme();
  return (
    <View style={styles.wrap} accessibilityRole="text">
      <View style={[styles.pill, { backgroundColor: tokens.systemBg, borderColor: tokens.systemBorder }]}>
        <Text style={[styles.label, { color: t.textSecondary }]}>{label}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { alignItems: "center", marginVertical: 14, paddingHorizontal: 16 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1
  },
  label: { fontSize: 12, fontWeight: "800", letterSpacing: 0.2 }
});
