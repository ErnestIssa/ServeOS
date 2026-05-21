import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { R } from "../../theme";
import { CHAT } from "./chatTheme";
import { ChatDeliveryTicks } from "./ChatDeliveryTicks";
import type { ThreadFeedItem } from "../customerChatApi";

type Props = {
  item: ThreadFeedItem;
  groupWithNext: boolean;
  groupWithPrev: boolean;
  showNewLabel?: boolean;
};

function radii(groupWithPrev: boolean, groupWithNext: boolean, mine: boolean) {
  const t = CHAT.radiusTail;
  const i = CHAT.radiusInner;
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

export function ChatMessageBubble({ item, groupWithNext, groupWithPrev, showNewLabel }: Props) {
  if (item.kind === "system") {
    return (
      <View style={styles.systemWrap}>
        <View style={styles.systemBubble}>
          <Text style={styles.systemText}>{item.content}</Text>
        </View>
      </View>
    );
  }

  const mine = item.isMine ?? item.senderRole === "CUSTOMER";
  const r = radii(groupWithPrev, groupWithNext, mine);

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      {showNewLabel && !mine ? (
        <Text style={styles.newLabel}>New</Text>
      ) : null}
      <View
        style={[
          styles.bubble,
          mine ? styles.bubbleMine : showNewLabel ? styles.bubbleTheirsUnread : styles.bubbleTheirs,
          r
        ]}
      >
        <Text style={[styles.body, mine && styles.bodyMine]}>{item.content}</Text>
        <View style={styles.metaRow}>
          <Text style={[styles.time, mine && styles.timeMine]}>
            {new Date(item.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
          </Text>
          {mine ? (
            <ChatDeliveryTicks status={item.deliveryStatus ?? "sent"} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  systemWrap: { alignItems: "center", marginVertical: 8, paddingHorizontal: 12 },
  systemBubble: {
    maxWidth: "92%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: CHAT.systemBg,
    borderWidth: 1,
    borderColor: CHAT.systemBorder
  },
  systemText: { fontSize: 13, lineHeight: 19, color: R.textSecondary, fontWeight: "600", textAlign: "center" },
  row: { marginVertical: 2, paddingHorizontal: 4, maxWidth: "100%" },
  rowMine: { alignItems: "flex-end" },
  rowTheirs: { alignItems: "flex-start" },
  newLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: CHAT.tickSent,
    marginBottom: 4,
    marginLeft: 4
  },
  bubble: { maxWidth: "82%", paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: CHAT.brand },
  bubbleTheirs: { backgroundColor: CHAT.theirsBg },
  bubbleTheirsUnread: { backgroundColor: CHAT.theirsUnreadBg, borderWidth: 1, borderColor: "rgba(139, 92, 246, 0.2)" },
  body: { fontSize: 16, lineHeight: 22, color: R.text, fontWeight: "600" },
  bodyMine: { color: CHAT.mineText },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  time: { fontSize: 11, fontWeight: "600", color: R.textMuted },
  timeMine: { color: "rgba(255,255,255,0.72)" }
});
