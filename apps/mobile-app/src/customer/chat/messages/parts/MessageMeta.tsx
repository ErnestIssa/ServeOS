import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useChatTheme } from "../../useChatTheme";
import { formatMessageTime } from "../formatters";
import type { ChatMessageViewModel } from "../types";
import { MessageStatus } from "./MessageStatus";

type Props = {
  message: ChatMessageViewModel;
  showStatus?: boolean;
  timeUnread?: boolean;
};

export function MessageMeta({ message, showStatus, timeUnread }: Props) {
  const { tokens, colors: t } = useChatTheme();
  const mine = message.mine;
  const timeColor = mine ? tokens.mineMeta : timeUnread ? tokens.theirsUnreadAccent : t.textMuted;

  return (
    <View style={styles.row}>
      {message.forwarded ? (
        <Text style={[styles.tag, { color: timeColor }]}>Forwarded</Text>
      ) : null}
      {message.edited ? <Text style={[styles.tag, { color: timeColor }]}>Edited</Text> : null}
      {mine && showStatus ? (
        <MessageStatus status={message.deliveryStatus} tokens={tokens} light />
      ) : null}
      <Text style={[styles.time, { color: timeColor }]}>{formatMessageTime(message.createdAt)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 4,
    alignSelf: "flex-end"
  },
  time: { fontSize: 10.5, fontWeight: "600" },
  tag: { fontSize: 10, fontWeight: "700", fontStyle: "italic" }
});
