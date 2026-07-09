import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useChatTheme } from "../../useChatTheme";
import type { ChatMessageViewModel } from "../types";
import { MessageMeta } from "../parts/MessageMeta";

type Props = {
  message: ChatMessageViewModel;
  timeUnread?: boolean;
  extension?: string;
  fileSize?: string;
};

export const DocumentBubble = React.memo(function DocumentBubble({
  message,
  timeUnread,
  extension = "PDF",
  fileSize = "—"
}: Props) {
  const { tokens, colors: t } = useChatTheme();
  const name = message.content.trim() || "Document";
  const ext = extension !== "PDF" ? extension : name.includes(".") ? name.split(".").pop() ?? "PDF" : "PDF";
  const url = message.caption;

  return (
    <View>
      <View style={[styles.card, { backgroundColor: message.mine ? tokens.brandSoft : t.bgSubtle, borderColor: t.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: tokens.brandSoft }]}>
          <Text style={[styles.ext, { color: tokens.brand }]}>{ext.slice(0, 4).toUpperCase()}</Text>
        </View>
        <View style={styles.meta}>
          <Text style={[styles.name, { color: message.mine ? tokens.mineText : t.text }]} numberOfLines={2}>
            {name}
          </Text>
          <Text style={[styles.size, { color: message.mine ? tokens.mineMeta : t.textMuted }]}>{fileSize}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open document"
          disabled={!url}
          onPress={() => {
            if (url) void Linking.openURL(url);
          }}
          style={({ pressed }) => [styles.dl, { borderColor: tokens.brand }, pressed && { opacity: 0.88 }, !url && styles.off]}
        >
          <Text style={{ color: tokens.brand, fontWeight: "800", fontSize: 12 }}>↓</Text>
        </Pressable>
      </View>
      <MessageMeta message={message} showStatus={message.mine} timeUnread={timeUnread} />
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 220
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  ext: { fontSize: 11, fontWeight: "900" },
  meta: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: "800" },
  size: { marginTop: 2, fontSize: 11, fontWeight: "600" },
  dl: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center"
  },
  off: { opacity: 0.4 }
});
