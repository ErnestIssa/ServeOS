import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useChatTheme } from "../../useChatTheme";
import type { ChatMessageViewModel } from "../types";
import { MessageMeta } from "../parts/MessageMeta";

type Props = {
  message: ChatMessageViewModel;
  timeUnread?: boolean;
  duration?: string;
};

export const VideoBubble = React.memo(function VideoBubble({ message, timeUnread, duration = "0:00" }: Props) {
  const { tokens, colors: t } = useChatTheme();

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Play video"
        style={({ pressed }) => [styles.thumbWrap, pressed && { opacity: 0.92 }]}
      >
        <View style={[styles.thumb, { backgroundColor: t.bgSubtle }]}>
          <View style={[styles.play, { backgroundColor: tokens.brandSoft, borderColor: tokens.brand }]}>
            <Text style={{ color: tokens.brand, fontSize: 18, fontWeight: "900" }}>▶</Text>
          </View>
          <View style={[styles.durationBadge, { backgroundColor: tokens.shadow }]}>
            <Text style={[styles.durationText, { color: t.bg }]}>{duration}</Text>
          </View>
        </View>
      </Pressable>
      {message.caption ? (
        <Text style={[styles.caption, { color: message.mine ? tokens.mineText : t.text }]}>{message.caption}</Text>
      ) : null}
      <MessageMeta message={message} showStatus={message.mine} timeUnread={timeUnread} />
    </View>
  );
});

const styles = StyleSheet.create({
  thumbWrap: { borderRadius: 16, overflow: "hidden" },
  thumb: {
    width: 240,
    height: 160,
    alignItems: "center",
    justifyContent: "center"
  },
  play: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center"
  },
  durationBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  durationText: { fontSize: 10, fontWeight: "700" },
  caption: { marginTop: 6, fontSize: 14, fontWeight: "600", lineHeight: 20 }
});
