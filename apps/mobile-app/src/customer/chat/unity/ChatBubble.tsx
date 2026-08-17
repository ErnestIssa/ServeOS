import { Platform, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { MessageStatusTicks } from "./MessageStatusTicks";
import type { ChatUiMessage } from "./chatUi";
import { splitMentionText } from "./mentions";
import { colors } from "./theme";

type Props = {
  message: ChatUiMessage;
  isOwn: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  reaction?: string;
  mentionVenueName?: string;
};

const R = 16;
const STACK = 4;
const TAIL = 2;

function bubbleRadii(isOwn: boolean, isFirst: boolean, isLast: boolean): ViewStyle {
  if (isOwn) {
    return {
      borderTopLeftRadius: R,
      borderTopRightRadius: isFirst ? R : STACK,
      borderBottomLeftRadius: R,
      borderBottomRightRadius: isLast ? TAIL : STACK
    };
  }
  return {
    borderTopLeftRadius: isFirst ? R : STACK,
    borderTopRightRadius: R,
    borderBottomLeftRadius: isLast ? TAIL : STACK,
    borderBottomRightRadius: R
  };
}

export function ChatBubble({
  message,
  isOwn,
  isFirstInGroup,
  isLastInGroup,
  reaction,
  mentionVenueName = "Venue"
}: Props) {
  return (
    <View style={styles.wrap}>
      {message.replyPreview ? (
        <View style={[styles.replyPreview, isOwn && styles.replyPreviewOwn]}>
          <View style={[styles.replyBar, isOwn && styles.replyBarOwn]} />
          <View style={styles.replyBody}>
            <Text style={[styles.replyAuthor, isOwn && styles.replyAuthorOwn]} numberOfLines={1}>
              {message.replyPreview.author}
            </Text>
            <Text style={[styles.replyText, isOwn && styles.replyTextOwn]} numberOfLines={1}>
              {message.replyPreview.text}
            </Text>
          </View>
        </View>
      ) : null}

      <View
        style={[
          styles.bubble,
          isOwn ? styles.bubbleOwn : styles.bubbleOther,
          bubbleRadii(isOwn, isFirstInGroup, isLastInGroup),
          !isLastInGroup && styles.stackGap
        ]}
      >
        <Text style={[styles.text, isOwn && styles.textOwn]}>
          {splitMentionText(message.text, mentionVenueName).map((part, i) => (
            <Text
              key={`${part.text}-${i}`}
              style={part.mention ? [styles.mention, isOwn && styles.mentionOwn] : undefined}
            >
              {part.text}
            </Text>
          ))}
        </Text>
        <View style={styles.meta}>
          <Text style={[styles.time, isOwn && styles.timeOwn]}>{message.timeLabel}</Text>
          {isOwn && message.status ? <MessageStatusTicks status={message.status} /> : null}
        </View>
      </View>

      {reaction ? (
        <View style={[styles.reactionBadge, isOwn ? styles.reactionOwn : styles.reactionOther]}>
          <Text style={styles.reactionEmoji}>{reaction}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative" },
  replyPreview: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.06)",
    borderRadius: 8,
    padding: 6,
    marginBottom: 4,
    maxWidth: "100%"
  },
  replyPreviewOwn: { backgroundColor: "rgba(0,0,0,0.08)" },
  replyBar: { width: 3, borderRadius: 2, backgroundColor: colors.brand, marginRight: 6 },
  replyBarOwn: { backgroundColor: "#128C7E" },
  replyBody: { flex: 1 },
  replyAuthor: { fontSize: 11, fontWeight: "800", color: colors.brand },
  replyAuthorOwn: { color: "#128C7E" },
  replyText: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  replyTextOwn: { color: "rgba(17,27,33,0.6)" },
  bubble: {
    maxWidth: "100%",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6
  },
  bubbleOwn: { backgroundColor: "#DCF8C6", alignSelf: "flex-end" },
  bubbleOther: {
    backgroundColor: colors.white,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)"
  },
  stackGap: { marginBottom: 2 },
  text: { fontSize: 15, color: colors.text, lineHeight: 21 },
  textOwn: { color: "#111B21" },
  mention: { color: colors.brand, fontWeight: "800" },
  mentionOwn: { color: "#0B6E62" },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 2,
    gap: 2
  },
  time: { fontSize: 11, color: colors.textMuted },
  timeOwn: { color: "rgba(17,27,33,0.55)" },
  reactionBadge: {
    position: "absolute",
    bottom: -6,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 }
      },
      android: { elevation: 2 }
    })
  },
  reactionOwn: { right: 4 },
  reactionOther: { left: 4 },
  reactionEmoji: { fontSize: 14 }
});
