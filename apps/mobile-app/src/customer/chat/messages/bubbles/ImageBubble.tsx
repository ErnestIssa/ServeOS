import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useChatTheme } from "../../useChatTheme";
import { formatMessageTime } from "../formatters";
import type { ChatMessageViewModel } from "../types";
import { MessageMeta } from "../parts/MessageMeta";

type Props = {
  message: ChatMessageViewModel;
  timeUnread?: boolean;
  onPressImage?: (uri: string) => void;
};

export const ImageBubble = React.memo(function ImageBubble({ message, timeUnread, onPressImage }: Props) {
  const { tokens, colors: t } = useChatTheme();
  const [failed, setFailed] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const uri = message.content;

  return (
    <View>
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel="Open image"
        onPress={() => onPressImage?.(uri)}
        style={({ pressed }) => [pressed && { opacity: 0.92 }]}
      >
        {loading ? (
          <View style={[styles.skeleton, { backgroundColor: t.bgSubtle }]} />
        ) : null}
        {failed ? (
          <View style={[styles.skeleton, { backgroundColor: t.bgSubtle, alignItems: "center", justifyContent: "center" }]}>
            <Text style={{ color: t.textMuted, fontWeight: "700" }}>Image unavailable</Text>
          </View>
        ) : (
          <Image
            source={{ uri }}
            style={styles.image}
            resizeMode="cover"
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setFailed(true);
            }}
            accessibilityLabel="Shared photo"
          />
        )}
        <View style={[styles.timeBadge, { backgroundColor: tokens.shadow }]}>
          <Text style={[styles.timeBadgeText, { color: t.bg }]}>{formatMessageTime(message.createdAt)}</Text>
        </View>
      </Pressable>
      {message.caption ? (
        <Text style={[styles.caption, { color: message.mine ? tokens.mineText : t.text }]}>{message.caption}</Text>
      ) : null}
      <MessageMeta message={message} showStatus timeUnread={timeUnread} />
    </View>
  );
});

const styles = StyleSheet.create({
  image: { width: 240, height: 240, borderRadius: 16 },
  skeleton: { width: 240, height: 240, borderRadius: 16 },
  caption: { marginTop: 6, fontSize: 14, fontWeight: "600", lineHeight: 20 },
  timeBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  timeBadgeText: { fontSize: 10, fontWeight: "700" }
});
