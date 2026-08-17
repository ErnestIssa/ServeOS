import Ionicons from "@expo/vector-icons/Ionicons";
import type { ReactNode } from "react";
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Text,
  View
} from "react-native";
import { ChatBubble } from "./ChatBubble";
import { InteractiveMessageRow } from "./InteractiveMessageRow";
import {
  avatarColor,
  avatarInitial,
  type ChatUiMessage,
  groupMessages,
  type MessageRenderGroup
} from "./chatUi";
import { colors, radius, spacing } from "./theme";

type Props = {
  messages: ChatUiMessage[];
  isGroupChat?: boolean;
  pinnedBanner?: string;
  listRef?: React.RefObject<FlatList<MessageRenderGroup> | null>;
  onScroll?: (y: number) => void;
  headerSpacerHeight: number;
  footerSpacerHeight: number;
  reactions: Record<string, string>;
  mentionVenueName?: string;
  listHeader?: ReactNode;
  listFooter?: ReactNode;
  onDoubleTap: (message: ChatUiMessage) => void;
  onLongPress: (message: ChatUiMessage) => void;
  onSwipeReply: (message: ChatUiMessage) => void;
  emptyText?: string;
};

function Avatar({ authorKeyValue, author }: { authorKeyValue: string; author: string }) {
  const bg = avatarColor(authorKeyValue);
  return (
    <View style={[styles.avatar, { backgroundColor: bg }]}>
      <Text style={styles.avatarText}>{avatarInitial(author)}</Text>
    </View>
  );
}

export function ChatMessageList({
  messages,
  isGroupChat = false,
  pinnedBanner,
  listRef,
  onScroll,
  headerSpacerHeight,
  footerSpacerHeight,
  reactions,
  mentionVenueName,
  listHeader,
  listFooter,
  onDoubleTap,
  onLongPress,
  onSwipeReply,
  emptyText
}: Props) {
  const groups = groupMessages(messages, isGroupChat);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    onScroll?.(e.nativeEvent.contentOffset.y);
  };

  return (
    <FlatList
      ref={listRef}
      data={groups}
      keyExtractor={(g) => g.id}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      style={styles.list}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      contentContainerStyle={[
        styles.content,
        { paddingTop: headerSpacerHeight, paddingBottom: footerSpacerHeight }
      ]}
      ListHeaderComponent={
        <>
          {pinnedBanner ? (
            <View style={styles.pinned}>
              <Ionicons name="pin" size={14} color={colors.brand} />
              <Text style={styles.pinnedText} numberOfLines={2}>
                {pinnedBanner}
              </Text>
            </View>
          ) : null}
          {listHeader}
        </>
      }
      ListFooterComponent={listFooter ? <>{listFooter}</> : null}
      ListEmptyComponent={
        emptyText ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{emptyText}</Text>
          </View>
        ) : null
      }
      renderItem={({ item: group }) => (
        <View style={styles.groupWrap}>
          {group.dateLabel ? (
            <View style={styles.dateChip}>
              <Text style={styles.dateText}>{group.dateLabel}</Text>
            </View>
          ) : null}

          {group.showSenderName ? (
            <Text style={[styles.senderName, group.isOwn && styles.senderNameOwn]}>
              {group.author} · {group.unit}
            </Text>
          ) : null}

          <View style={[styles.row, group.isOwn && styles.rowOwn]}>
            {group.messages.map((msg, mi) => (
              <View key={msg.id} style={[styles.messageRow, group.isOwn && styles.messageRowOwn]}>
                {!group.isOwn ? (
                  <View style={styles.avatarCol}>
                    {mi === group.messages.length - 1 && group.showAvatar ? (
                      <Avatar authorKeyValue={group.authorKey} author={group.author} />
                    ) : (
                      <View style={styles.avatarSpacer} />
                    )}
                  </View>
                ) : null}

                <View style={[styles.swipeCol, group.isOwn && styles.swipeColOwn]}>
                  <InteractiveMessageRow
                    isOwn={group.isOwn}
                    onDoubleTap={() => onDoubleTap(msg)}
                    onLongPress={() => onLongPress(msg)}
                    onSwipeReply={() => onSwipeReply(msg)}
                  >
                    <ChatBubble
                      message={msg}
                      isOwn={group.isOwn}
                      isFirstInGroup={mi === 0}
                      isLastInGroup={mi === group.messages.length - 1}
                      reaction={reactions[msg.id]}
                      mentionVenueName={mentionVenueName}
                    />
                  </InteractiveMessageRow>
                </View>

                {group.isOwn ? (
                  <View style={styles.avatarCol}>
                    {mi === group.messages.length - 1 && group.showAvatar ? (
                      <Avatar authorKeyValue={group.authorKey} author={group.author} />
                    ) : (
                      <View style={styles.avatarSpacer} />
                    )}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { paddingHorizontal: spacing.sm },
  pinned: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  pinnedText: { flex: 1, fontSize: 13, color: colors.brand, fontWeight: "600" },
  groupWrap: { marginBottom: spacing.sm },
  dateChip: {
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginVertical: spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 }
      },
      android: { elevation: 1 }
    })
  },
  dateText: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  senderName: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand,
    marginLeft: 40,
    marginBottom: 4
  },
  senderNameOwn: {
    marginLeft: 0,
    marginRight: 40,
    textAlign: "right"
  },
  row: { flexDirection: "column", gap: 2 },
  rowOwn: { alignItems: "flex-end" },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    width: "100%"
  },
  messageRowOwn: { justifyContent: "flex-end" },
  swipeCol: { flexShrink: 1, maxWidth: "82%" },
  swipeColOwn: { flex: 1, maxWidth: "100%", alignItems: "flex-end" },
  avatarCol: { width: 32, alignItems: "center", justifyContent: "flex-end" },
  avatarSpacer: { width: 32, height: 32 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: { fontSize: 13, fontWeight: "800", color: colors.white },
  empty: { padding: spacing.lg, alignItems: "center" },
  emptyText: { fontSize: 14, color: colors.whatsAppGray, textAlign: "center", lineHeight: 20 }
});
