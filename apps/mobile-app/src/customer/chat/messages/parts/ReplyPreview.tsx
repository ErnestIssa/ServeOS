import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useChatTheme } from "../../useChatTheme";

type Props = {
  senderLabel: string;
  preview: string;
  mine?: boolean;
};

export function ReplyPreview({ senderLabel, preview, mine }: Props) {
  const { tokens, colors: t } = useChatTheme();
  return (
    <View
        style={[
          styles.wrap,
          {
            borderLeftColor: mine ? tokens.mineText : tokens.brand,
            backgroundColor: mine ? tokens.brandSoft : tokens.brandSoft
          }
        ]}
    >
      <Text style={[styles.sender, { color: mine ? tokens.mineText : tokens.brand }]} numberOfLines={1}>
        {senderLabel}
      </Text>
      <Text style={[styles.preview, { color: mine ? tokens.mineMeta : t.textSecondary }]} numberOfLines={2}>
        {preview}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 6
  },
  sender: { fontSize: 11, fontWeight: "800", marginBottom: 2 },
  preview: { fontSize: 12, fontWeight: "600", lineHeight: 16 }
});
