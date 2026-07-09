import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useChatTheme } from "../../useChatTheme";
import type { ChatMessageViewModel } from "../types";
import { MessageMeta } from "../parts/MessageMeta";

const URL_RE = /(https?:\/\/[^\s]+)/g;

type Props = {
  message: ChatMessageViewModel;
  showMeta?: boolean;
  timeUnread?: boolean;
  largeEmoji?: boolean;
};

function RichText({ text, mine, large }: { text: string; mine: boolean; large?: boolean }) {
  const { tokens, colors: t } = useChatTheme();
  const parts = text.split(URL_RE);
  return (
    <Text
      style={[
        styles.body,
        large && styles.emojiBody,
        { color: mine ? tokens.mineText : t.text }
      ]}
    >
      {parts.map((part, i) => {
        const isUrl = part.startsWith("http://") || part.startsWith("https://");
        return isUrl ? (
          <Text
            key={`${i}-${part}`}
            style={{ color: mine ? tokens.mineMeta : t.accentBlue, textDecorationLine: "underline" }}
            onPress={() => void Linking.openURL(part)}
          >
            {part}
          </Text>
        ) : (
          <Text key={`${i}-t`}>{part}</Text>
        );
      })}
    </Text>
  );
}

export const TextBubble = React.memo(function TextBubble({ message, showMeta, timeUnread, largeEmoji }: Props) {
  return (
    <View>
      <RichText text={message.content} mine={message.mine} large={largeEmoji || message.kind === "emoji_only"} />
      {showMeta !== false ? (
        <MessageMeta message={message} showStatus timeUnread={timeUnread} />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  body: { fontSize: 15.5, lineHeight: 22, fontWeight: "600" },
  emojiBody: { fontSize: 34, lineHeight: 40, fontWeight: "400" }
});
