import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useChatTheme } from "../../useChatTheme";
import type { ChatMessageKind, ChatMessageViewModel } from "../types";
import { MessageMeta } from "../parts/MessageMeta";

const LABELS: Partial<Record<ChatMessageKind, { icon: string; title: string }>> = {
  video: { icon: "▶", title: "Video" },
  audio: { icon: "♪", title: "Audio" },
  voice: { icon: "🎙", title: "Voice message" },
  document: { icon: "📄", title: "Document" },
  pdf: { icon: "📕", title: "PDF" },
  zip: { icon: "🗜", title: "Archive" },
  link: { icon: "🔗", title: "Link" },
  gif: { icon: "GIF", title: "GIF" },
  sticker: { icon: "✨", title: "Sticker" },
  product: { icon: "🛍", title: "Product" },
  workout: { icon: "🏋", title: "Workout plan" },
  post: { icon: "📰", title: "Post" },
  location: { icon: "📍", title: "Location" },
  contact: { icon: "👤", title: "Contact" },
  poll: { icon: "📊", title: "Poll" },
  scheduled: { icon: "🕐", title: "Scheduled message" },
  loading: { icon: "…", title: "Loading" }
};

type Props = {
  message: ChatMessageViewModel;
  timeUnread?: boolean;
};

export const MediaPlaceholderBubble = React.memo(function MediaPlaceholderBubble({ message, timeUnread }: Props) {
  const { tokens, colors: t } = useChatTheme();
  const meta = LABELS[message.kind] ?? { icon: "📎", title: "Attachment" };

  return (
    <View>
      <View style={[styles.card, { backgroundColor: message.mine ? tokens.brandSoft : t.bgSubtle, borderColor: message.mine ? tokens.brandDeep : t.border }]}>
        <Text style={[styles.icon, { color: message.mine ? tokens.mineText : tokens.brand }]}>{meta.icon}</Text>
        <View style={styles.body}>
          <Text style={[styles.title, { color: message.mine ? tokens.mineText : t.text }]}>{meta.title}</Text>
          <Text style={[styles.sub, { color: message.mine ? tokens.mineMeta : t.textMuted }]} numberOfLines={2}>
            {message.content || "Preview unavailable on this device yet"}
          </Text>
        </View>
      </View>
      <MessageMeta message={message} showStatus={message.mine} timeUnread={timeUnread} />
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 200
  },
  icon: { fontSize: 22, fontWeight: "800", width: 32, textAlign: "center" },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: "800" },
  sub: { marginTop: 2, fontSize: 12, fontWeight: "600", lineHeight: 16 }
});
