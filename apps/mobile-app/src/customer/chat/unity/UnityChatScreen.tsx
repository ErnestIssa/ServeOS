import Ionicons from "@expo/vector-icons/Ionicons";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BadgePill } from "./BadgePill";
import { ChatAttachmentModal, type UnityAttachChoice } from "./ChatAttachmentModal";
import { ChatFloatingComposer } from "./ChatFloatingComposer";
import { ChatMessageList } from "./ChatMessageList";
import { ChatReactionBar } from "./ChatReactionBar";
import { ChatReactionPickerModal } from "./ChatReactionPickerModal";
import { GlassChip } from "./GlassChip";
import { DEFAULT_LOVE_REACTION } from "./chatReactions";
import { CHAT_BACKGROUND, colors, spacing } from "./theme";
import type { ChatReplyPreview, ChatUiMessage, MessageRenderGroup } from "./chatUi";
import { hapticSelection } from "./haptics";

export type UnityNavAction = {
  icon: "chevron-back" | "call-outline" | "information-circle-outline" | "chatbubbles-outline";
  accessibilityLabel: string;
  onPress?: () => void;
  badge?: number;
};

type Props = {
  title: string;
  subtitle?: string;
  messages: ChatUiMessage[];
  onSend: (text: string) => void;
  onBack: () => void;
  isGroupChat?: boolean;
  pinnedBanner?: string;
  rightActions?: UnityNavAction[];
  listHeader?: ReactNode;
  listFooter?: ReactNode;
  emptyText?: string;
  disabledComposer?: boolean;
  onAttachChoice?: (choice: UnityAttachChoice) => void;
  onComposerDraftChange?: (text: string) => void;
  overlay?: ReactNode;
};

type MessageMeta = {
  reaction?: string;
  replyPreview?: ChatReplyPreview;
};

const TOP_BAR_HEIGHT = 52;
const COMPACT_THRESHOLD = 40;

export function UnityChatScreen({
  title,
  subtitle,
  messages,
  onSend,
  onBack,
  isGroupChat = false,
  pinnedBanner,
  rightActions = [],
  listHeader,
  listFooter,
  emptyText,
  disabledComposer,
  onAttachChoice,
  onComposerDraftChange,
  overlay
}: Props) {
  const insets = useSafeAreaInsets();
  const [attachOpen, setAttachOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [messageMeta, setMessageMeta] = useState<Record<string, MessageMeta>>({});
  const [replyTarget, setReplyTarget] = useState<ChatReplyPreview | null>(null);
  const [activeReactionMessageId, setActiveReactionMessageId] = useState<string | null>(null);
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [reactionPickerForId, setReactionPickerForId] = useState<string | null>(null);

  const scrollY = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList<MessageRenderGroup>>(null);
  const pendingReplyRef = useRef<ChatReplyPreview | null>(null);
  const prevMessageCount = useRef(messages.length);

  const topBarTotal = insets.top + TOP_BAR_HEIGHT;
  const composerBaseHeight = 72 + (replyTarget ? 48 : 0);
  const footerSpacerHeight =
    composerBaseHeight + keyboardHeight + (keyboardHeight > 0 ? 4 : Math.max(insets.bottom, spacing.sm));

  const displayMessages = useMemo(
    () =>
      messages.map((m) => ({
        ...m,
        replyPreview: messageMeta[m.id]?.replyPreview ?? m.replyPreview
      })),
    [messages, messageMeta]
  );

  const reactions = useMemo(() => {
    const map: Record<string, string> = {};
    Object.entries(messageMeta).forEach(([id, meta]) => {
      if (meta.reaction) map[id] = meta.reaction;
    });
    return map;
  }, [messageMeta]);

  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      const last = messages[messages.length - 1];
      if (last?.isOwn && pendingReplyRef.current) {
        setMessageMeta((prev) => ({
          ...prev,
          [last.id]: { ...prev[last.id], replyPreview: pendingReplyRef.current ?? undefined }
        }));
        pendingReplyRef.current = null;
      }
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    }
    prevMessageCount.current = messages.length;
  }, [messages]);

  useEffect(() => {
    if (keyboardHeight > 0) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [keyboardHeight]);

  const titleOpacity = scrollY.interpolate({
    inputRange: [0, COMPACT_THRESHOLD],
    outputRange: [1, 0],
    extrapolate: "clamp"
  });

  const compactOpacity = scrollY.interpolate({
    inputRange: [COMPACT_THRESHOLD * 0.35, COMPACT_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp"
  });

  const sendText = useCallback(
    (text: string) => {
      if (replyTarget) {
        pendingReplyRef.current = replyTarget;
        setReplyTarget(null);
      }
      onSend(text);
    },
    [onSend, replyTarget]
  );

  const setReaction = useCallback((messageId: string, emoji: string) => {
    setMessageMeta((prev) => ({
      ...prev,
      [messageId]: { ...prev[messageId], reaction: emoji }
    }));
  }, []);

  const handleDoubleTap = useCallback(
    (message: ChatUiMessage) => {
      setReaction(message.id, DEFAULT_LOVE_REACTION);
    },
    [setReaction]
  );

  const handleLongPress = useCallback((message: ChatUiMessage) => {
    setActiveReactionMessageId(message.id);
  }, []);

  const handleSwipeReply = useCallback((message: ChatUiMessage) => {
    setReplyTarget({
      author: message.isOwn ? "You" : message.author,
      text: message.text
    });
    setActiveReactionMessageId(null);
  }, []);

  const handleReactionPick = useCallback(
    (messageId: string, emoji: string) => {
      setReaction(messageId, emoji);
      setActiveReactionMessageId(null);
    },
    [setReaction]
  );

  const openReactionPicker = useCallback((messageId: string) => {
    setReactionPickerForId(messageId);
    setActiveReactionMessageId(null);
    setReactionPickerOpen(true);
  }, []);

  const closeReactionBar = useCallback(() => {
    setActiveReactionMessageId(null);
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <StatusBar barStyle="dark-content" backgroundColor={CHAT_BACKGROUND} />

      <View style={[styles.headerFloat, { top: insets.top + spacing.xs }]} pointerEvents="box-none">
        <GlassChip style={styles.headerChip}>
          <Pressable
            style={styles.chipBtn}
            onPress={() => {
              hapticSelection();
              onBack();
            }}
            hitSlop={8}
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color={colors.brand} />
          </Pressable>
        </GlassChip>

        <Animated.View style={[styles.titleChipWrap, { opacity: titleOpacity }]} pointerEvents="none">
          <GlassChip style={styles.titleChip}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </GlassChip>
        </Animated.View>

        <View style={styles.rightChips}>
          {rightActions.length > 0 ? (
            rightActions.map((action) => (
              <GlassChip key={action.accessibilityLabel} style={styles.headerChip}>
                <Pressable
                  style={styles.chipBtn}
                  onPress={() => {
                    hapticSelection();
                    action.onPress?.();
                  }}
                  accessibilityLabel={action.accessibilityLabel}
                >
                  <Ionicons name={action.icon} size={18} color={colors.brand} />
                  <BadgePill count={action.badge ?? 0} style={styles.headerBadge} compact />
                </Pressable>
              </GlassChip>
            ))
          ) : (
            <View style={styles.headerChipPlaceholder} />
          )}
        </View>
      </View>

      <Animated.View
        pointerEvents="none"
        style={[styles.compactWrap, { top: insets.top + spacing.xs, opacity: compactOpacity }]}
      >
        <GlassChip style={styles.compactChip}>
          <Text style={styles.compactTitle} numberOfLines={1}>
            {title}
          </Text>
        </GlassChip>
      </Animated.View>

      <View style={styles.mainColumn}>
        <View style={styles.body}>
          <ChatMessageList
            messages={displayMessages}
            isGroupChat={isGroupChat}
            pinnedBanner={pinnedBanner}
            listRef={listRef}
            headerSpacerHeight={topBarTotal + spacing.sm}
            footerSpacerHeight={footerSpacerHeight}
            reactions={reactions}
            mentionVenueName={title}
            listHeader={listHeader}
            listFooter={listFooter}
            emptyText={emptyText}
            onScroll={(y) => scrollY.setValue(y)}
            onDoubleTap={handleDoubleTap}
            onLongPress={handleLongPress}
            onSwipeReply={handleSwipeReply}
          />
        </View>

        <ChatFloatingComposer
          onSend={sendText}
          onVoiceSend={sendText}
          placeholder={`Message ${title}…`}
          onAttachPress={() => setAttachOpen(true)}
          replyTo={replyTarget}
          onClearReply={() => setReplyTarget(null)}
          onKeyboardHeightChange={setKeyboardHeight}
          venueName={title}
          disabled={disabledComposer}
          onDraftChange={onComposerDraftChange}
        />
      </View>

      {activeReactionMessageId ? (
        <>
          <Pressable
            style={styles.reactionBackdrop}
            onPress={closeReactionBar}
            accessibilityLabel="Dismiss reactions"
          />
          <View style={styles.reactionBarOverlay} pointerEvents="box-none">
            <ChatReactionBar
              onPick={(emoji) => handleReactionPick(activeReactionMessageId, emoji)}
              onOpenFullPicker={() => openReactionPicker(activeReactionMessageId)}
              onClose={closeReactionBar}
            />
          </View>
        </>
      ) : null}

      <ChatAttachmentModal
        open={attachOpen}
        onClose={() => setAttachOpen(false)}
        onChoose={(choice) => onAttachChoice?.(choice)}
      />

      <ChatReactionPickerModal
        open={reactionPickerOpen}
        onPick={(emoji) => {
          if (reactionPickerForId) setReaction(reactionPickerForId, emoji);
        }}
        onClose={() => {
          setReactionPickerOpen(false);
          setReactionPickerForId(null);
        }}
      />

      {overlay}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: CHAT_BACKGROUND
  },
  mainColumn: {
    flex: 1,
    justifyContent: "flex-end"
  },
  reactionBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 45,
    backgroundColor: "transparent"
  },
  reactionBarOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "38%",
    alignItems: "center",
    zIndex: 46
  },
  headerFloat: {
    position: "absolute",
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    zIndex: 30,
    gap: spacing.xs
  },
  headerChip: {
    borderRadius: 999
  },
  chipBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center"
  },
  headerBadge: {
    position: "absolute",
    top: 0,
    right: 0
  },
  titleChipWrap: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: spacing.xs
  },
  titleChip: {
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    maxWidth: "100%",
    alignItems: "center"
  },
  title: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111B21",
    letterSpacing: -0.2,
    textAlign: "center"
  },
  subtitle: {
    fontSize: 10,
    fontWeight: "600",
    color: "#667781",
    marginTop: 1,
    textAlign: "center"
  },
  rightChips: {
    flexDirection: "row",
    gap: spacing.xs
  },
  headerChipPlaceholder: { width: 36, height: 36 },
  compactWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 29,
    paddingHorizontal: 72
  },
  compactChip: {
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
    maxWidth: "70%"
  },
  compactTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111B21",
    textAlign: "center"
  },
  body: {
    flex: 1,
    backgroundColor: CHAT_BACKGROUND
  }
});
