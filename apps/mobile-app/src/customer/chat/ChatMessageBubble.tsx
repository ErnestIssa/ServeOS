import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { R } from "../../theme";
import { CHAT } from "./chatTheme";
import { ChatDeliveryTicks } from "./ChatDeliveryTicks";
import type { ThreadFeedItem } from "../customerChatApi";

type Props = {
  item: ThreadFeedItem;
  groupWithNext: boolean;
  groupWithPrev: boolean;
  /** One “New” above the first bubble in a consecutive unread incoming run. */
  showNewLabel?: boolean;
  /** Purple timestamp (unread incoming). */
  timeUnread?: boolean;
};

function radii(groupWithPrev: boolean, groupWithNext: boolean, mine: boolean) {
  const t = CHAT.radiusTail;
  const m = CHAT.radiusMicro;
  if (mine) {
    return {
      borderTopLeftRadius: t,
      borderTopRightRadius: groupWithPrev ? m : t,
      borderBottomLeftRadius: t,
      borderBottomRightRadius: groupWithNext ? m : t
    };
  }
  return {
    borderTopLeftRadius: groupWithPrev ? m : t,
    borderTopRightRadius: t,
    borderBottomLeftRadius: groupWithNext ? m : t,
    borderBottomRightRadius: t
  };
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function ChatMessageBubble({ item, groupWithNext, groupWithPrev, showNewLabel, timeUnread }: Props) {
  if (item.kind === "system") return null;

  const mine = item.isMine ?? item.senderRole === "CUSTOMER";
  const r = radii(groupWithPrev, groupWithNext, mine);
  const timeLabel = formatTime(item.createdAt);
  const isImage =
    item.type === "IMAGE" &&
    (item.content.startsWith("data:image/") || item.content.startsWith("http://") || item.content.startsWith("https://"));

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      {showNewLabel && !mine ? (
        <Text style={styles.newLabel}>New</Text>
      ) : null}
      <View
        style={[
          styles.bubble,
          mine ? styles.bubbleMine : styles.bubbleTheirs,
          isImage && styles.bubbleImage,
          r
        ]}
      >
        {isImage ? (
          <Image source={{ uri: item.content }} style={styles.chatImage} resizeMode="cover" accessibilityLabel="Photo" />
        ) : (
          <Text style={[styles.body, mine && styles.bodyMine]}>{item.content}</Text>
        )}
        <View style={[styles.metaRow, mine && styles.metaRowMine]}>
          {mine ? <ChatDeliveryTicks status={item.deliveryStatus ?? "sent"} /> : null}
          <Text
            style={[
              styles.time,
              mine && styles.timeMine,
              !mine && timeUnread && styles.timeUnread
            ]}
          >
            {timeLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginVertical: 2, paddingHorizontal: 4, maxWidth: "100%" },
  rowMine: { alignItems: "flex-end" },
  rowTheirs: { alignItems: "flex-start" },
  newLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: CHAT.unreadAccent,
    letterSpacing: 0.4,
    marginBottom: 4,
    marginLeft: 4
  },
  bubble: {
    maxWidth: "82%",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: R.border
  },
  bubbleMine: { backgroundColor: CHAT.brand, borderColor: "#5B21B6" },
  bubbleTheirs: { backgroundColor: CHAT.theirsBg, borderColor: "rgba(0,0,0,0.06)" },
  bubbleImage: { paddingHorizontal: 6, paddingTop: 6 },
  chatImage: {
    width: 220,
    height: 220,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.04)"
  },
  body: { fontSize: 16, lineHeight: 22, color: R.text, fontWeight: "600" },
  bodyMine: { color: CHAT.mineText },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    alignSelf: "flex-end",
    gap: 6,
    marginTop: 4,
    maxWidth: "100%"
  },
  metaRowMine: { alignSelf: "flex-end" },
  time: { fontSize: 11, fontWeight: "600", color: R.textMuted },
  timeMine: { color: "rgba(255,255,255,0.72)" },
  timeUnread: { color: CHAT.unreadAccent, fontWeight: "700" }
});
