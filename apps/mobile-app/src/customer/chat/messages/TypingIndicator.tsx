import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { ChatTypingDots } from "../ChatTypingDots";
import { useChatTheme } from "../useChatTheme";

export const TypingIndicator = React.memo(function TypingIndicator() {
  const { tokens, colors: t } = useChatTheme();
  return (
    <View style={styles.row} accessibilityLiveRegion="polite" accessibilityLabel="Restaurant is typing">
      <View style={[styles.bubble, { backgroundColor: tokens.theirsBg, borderColor: tokens.theirsBorder }]}>
        <ChatTypingDots />
      </View>
      <Text style={[styles.label, { color: t.textMuted }]}>typing…</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 6 },
  bubble: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  label: { fontSize: 12, fontWeight: "700" }
});
