import React from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useChatTheme } from "../useChatTheme";
import { DocumentBubble } from "./bubbles/DocumentBubble";
import { FailedBubble } from "./bubbles/FailedBubble";
import { ImageBubble } from "./bubbles/ImageBubble";
import { MediaPlaceholderBubble } from "./bubbles/MediaPlaceholderBubble";
import { TextBubble } from "./bubbles/TextBubble";
import { VideoBubble } from "./bubbles/VideoBubble";
import { VoiceMessageBubble } from "./bubbles/VoiceMessageBubble";
import { DateSeparator } from "./DateSeparator";
import { BubbleTail, bubbleShadow } from "./parts/BubbleTail";
import { bubbleCornerRadii } from "./parts/bubbleRadii";
import { MessageAvatar } from "./parts/MessageAvatar";
import { ReplyPreview } from "./parts/ReplyPreview";
import type { ChatMessageViewModel } from "./types";

export type ChatMessageProps = {
  message: ChatMessageViewModel;
  groupWithPrev: boolean;
  groupWithNext: boolean;
  showAvatar: boolean;
  showNewLabel?: boolean;
  timeUnread?: boolean;
  selected?: boolean;
  authorAvatarUri?: string | null;
  authorInitial: string;
  onLongPress?: (message: ChatMessageViewModel) => void;
  onRetry?: (message: ChatMessageViewModel) => void;
};

function isImageUri(content: string): boolean {
  return (
    content.startsWith("data:image/") || content.startsWith("http://") || content.startsWith("https://")
  );
}

function BubbleBody(props: ChatMessageProps) {
  const { message, timeUnread, onRetry } = props;
  if (message.deleted) {
    return <TextBubble message={{ ...message, content: "Message deleted" }} largeEmoji={false} />;
  }
  if (message.failed || message.deliveryStatus === "failed") {
    return <FailedBubble message={message} onRetry={onRetry ? () => onRetry(message) : undefined} />;
  }
  if (message.kind === "image" || (message.kind === "text" && isImageUri(message.content))) {
    return <ImageBubble message={message} timeUnread={timeUnread} />;
  }
  if (message.kind === "text" || message.kind === "emoji_only" || message.kind === "edited" || message.kind === "reply") {
    return <TextBubble message={message} timeUnread={timeUnread} largeEmoji={message.kind === "emoji_only"} />;
  }
  if (message.kind === "video") {
    return <VideoBubble message={message} timeUnread={timeUnread} />;
  }
  if (message.kind === "audio" || message.kind === "voice") {
    return <VoiceMessageBubble message={message} timeUnread={timeUnread} />;
  }
  if (message.kind === "document" || message.kind === "pdf" || message.kind === "zip") {
    const ext = message.kind === "pdf" ? "PDF" : message.kind === "zip" ? "ZIP" : "DOC";
    return <DocumentBubble message={message} timeUnread={timeUnread} extension={ext} />;
  }
  if (
    message.kind === "link" ||
    message.kind === "gif" ||
    message.kind === "sticker" ||
    message.kind === "product" ||
    message.kind === "workout" ||
    message.kind === "post" ||
    message.kind === "location" ||
    message.kind === "contact" ||
    message.kind === "poll" ||
    message.kind === "scheduled" ||
    message.kind === "loading"
  ) {
    return <MediaPlaceholderBubble message={message} timeUnread={timeUnread} />;
  }
  return <TextBubble message={message} timeUnread={timeUnread} />;
}

export const ChatMessage = React.memo(function ChatMessage(props: ChatMessageProps) {
  const { message, groupWithPrev, groupWithNext, showAvatar, showNewLabel, selected, onLongPress } = props;
  const { tokens, colors: t } = useChatTheme();

  if (message.kind === "system") {
    return (
      <Animated.View entering={FadeInDown.duration(220)} style={styles.systemWrap}>
        <View style={[styles.systemPill, { backgroundColor: tokens.systemBg, borderColor: tokens.systemBorder }]}>
          <Text style={[styles.systemText, { color: tokens.systemText }]}>{message.content}</Text>
        </View>
      </Animated.View>
    );
  }

  const mine = message.mine;
  const bubbleBg = mine ? tokens.mineBg : tokens.theirsBg;
  const bubbleBorder = mine ? tokens.brandDeep : tokens.theirsBorder;
  const isImage = message.kind === "image" || isImageUri(message.content);
  const showTail = !groupWithNext;
  const cornerRadii = bubbleCornerRadii({
    mine,
    showTail,
    groupWithPrev,
    groupWithNext,
    radius: tokens.radiusBubble,
    grouped: tokens.radiusGrouped,
    tailCorner: tokens.radiusTail
  });

  return (
    <Animated.View
      entering={FadeInDown.duration(260).springify().damping(20)}
      style={[
        styles.row,
        mine ? styles.rowMine : styles.rowTheirs,
        groupWithNext ? styles.rowGroupedNext : null,
        selected ? { backgroundColor: tokens.brandSoft, borderRadius: 12 } : null
      ]}
    >
      {!mine ? (
        showAvatar ? (
          <MessageAvatar uri={props.authorAvatarUri} initial={props.authorInitial} mine={false} />
        ) : (
          <View style={styles.avatarSpacer} />
        )
      ) : null}

      <View style={styles.col}>
        {showNewLabel && !mine ? (
          <Text style={[styles.newLabel, { color: tokens.theirsUnreadAccent }]}>New</Text>
        ) : null}
        <Pressable
          onLongPress={() => onLongPress?.(message)}
          delayLongPress={320}
          accessibilityRole="text"
        >
          <View style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs]}>
            <View
              style={[
                styles.bubble,
                bubbleShadow(tokens),
                cornerRadii,
                {
                  backgroundColor: bubbleBg,
                  borderColor: bubbleBorder,
                  borderWidth: 1
                },
                isImage && styles.bubbleImagePad
              ]}
            >
              {message.replyTo ? (
                <ReplyPreview
                  senderLabel={message.replyTo.senderLabel}
                  preview={message.replyTo.preview}
                  mine={mine}
                />
              ) : null}
              <BubbleBody {...props} />
            </View>
            {showTail ? <BubbleTail mine={mine} fill={bubbleBg} stroke={bubbleBorder} /> : null}
          </View>
        </Pressable>
      </View>

      {mine ? (
        showAvatar ? (
          <MessageAvatar uri={props.authorAvatarUri} initial={props.authorInitial} mine />
        ) : (
          <View style={styles.avatarSpacer} />
        )
      ) : null}
    </Animated.View>
  );
});

export { DateSeparator };

const AVATAR = 30;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginVertical: 3,
    paddingHorizontal: 8,
    gap: 8
  },
  rowGroupedNext: { marginBottom: 1 },
  rowMine: { justifyContent: "flex-end" },
  rowTheirs: { justifyContent: "flex-start" },
  avatarSpacer: { width: AVATAR, height: AVATAR },
  col: { minWidth: 0, maxWidth: "75%" },
  bubbleWrap: { position: "relative" },
  bubbleWrapMine: { alignItems: "flex-end" },
  bubbleWrapTheirs: { alignItems: "flex-start" },
  bubble: {
    paddingHorizontal: 15,
    paddingTop: 11,
    paddingBottom: 9
  },
  bubbleImagePad: { paddingHorizontal: 5, paddingTop: 5, paddingBottom: 5 },
  newLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4, marginBottom: 4, marginLeft: 4 },
  systemWrap: { alignItems: "center", marginVertical: 10, paddingHorizontal: 24 },
  systemPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6
  },
  systemText: { fontSize: 12, fontWeight: "700", textAlign: "center", lineHeight: 17 }
});
