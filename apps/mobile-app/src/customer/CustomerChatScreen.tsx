import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  type ViewToken,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { chatComposerBottomInset, FLOAT_MARGIN_SIDE } from "../shell/navBottomMetrics";
import { R } from "../theme";
import {
  mergeThreadFeed,
  readChatSnapshot,
  refreshChatHubSilent,
  writeChatSnapshot
} from "../data/customerDataCache";
import {
  fetchCustomerChatHub,
  postCustomerChatImages,
  postCustomerChatMessage,
  type CustomerChatHubResponse,
  type CustomerChatQuickActionId,
  type ThreadFeedItem
} from "./customerChatApi";
import { ChatComposerBar } from "./chat/ChatComposerBar";
import { ChatMessageBubble } from "./chat/ChatMessageBubble";
import { ChatVenueInfoModal } from "./chat/ChatVenueInfoModal";
import { ChatCollapsingHeader, chatListTopInset } from "./chat/ChatCollapsingHeader";
import { playCartAddCue } from "./cartCueSound";
import { confirmSendChatImages, pickChatImages, type PreparedChatImage } from "./chat/chatImageAttach";
import { ChatTypingDots } from "./chat/ChatTypingDots";
import { isIncomingMessage, isMessageUnread } from "./chat/chatUnreadHelpers";
import { joinChatRoom, sendChatRead, sendChatTyping, subscribeChatRelay } from "./chat/customerChatSocket";
import { ScreenErrorState } from "../errors";

const TYPING_EMIT_MS = 400;
const TYPING_IDLE_MS = 2800;
const TYPING_CLEAR_MS = 6500;
const NEW_LABEL_DISMISS_MS = 10_000;

type Props = {
  token: string;
  restaurantId: string;
  money: (cents: number) => string;
  scrollY: Animated.Value;
  onScroll: ReturnType<typeof Animated.event>;
  scrollTopPad: number;
  scrollBottom: number;
  userId?: string | null;
  chatFocused: boolean;
  onUnreadCountChange?: (count: number) => void;
  onViewMenu: () => void;
  onPopularItems: () => void;
  onOpenCart: () => void;
  onPlaceOrder: () => void;
  onChooseVenue: () => void;
  onReorder: () => void;
};

function patchMyDeliveryStatus(
  items: ThreadFeedItem[],
  status: "sent" | "delivered" | "read",
  messageId?: string
): ThreadFeedItem[] {
  return items.map((item) => {
    if (item.kind !== "message" || !item.isMine) return item;
    if (messageId && item.id !== messageId) return item;
    const rank = { sent: 0, delivered: 1, read: 2 };
    const cur = item.deliveryStatus ?? "sent";
    if (rank[status] < rank[cur]) return item;
    return { ...item, deliveryStatus: status };
  });
}

function sameGroup(a: ThreadFeedItem, b: ThreadFeedItem | undefined): boolean {
  if (!b || a.kind !== b.kind || b.kind !== "message" || a.kind !== "message") return false;
  return a.senderRole === b.senderRole;
}

export function CustomerChatScreen(props: Props) {
  const {
    token,
    restaurantId,
    money,
    scrollY,
    onScroll,
    scrollTopPad,
    scrollBottom,
    userId,
    chatFocused,
    onUnreadCountChange,
    onViewMenu,
    onPopularItems,
    onOpenCart,
    onPlaceOrder,
    onChooseVenue,
    onReorder
  } = props;

  const [hub, setHub] = React.useState<CustomerChatHubResponse | null>(null);
  const [feed, setFeed] = React.useState<ThreadFeedItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [revalidating, setRevalidating] = React.useState(false);
  const [loadErr, setLoadErr] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [pickingImage, setPickingImage] = React.useState(false);
  const [venueTyping, setVenueTyping] = React.useState(false);
  const [keyboardOpen, setKeyboardOpen] = React.useState(false);
  const [venueInfoOpen, setVenueInfoOpen] = React.useState(false);
  const inputRef = React.useRef<TextInput>(null);
  const listRef = React.useRef<FlatList<ThreadFeedItem>>(null);
  const typingStopRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingClearRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmitRef = React.useRef(0);
  const roomIdRef = React.useRef<string | null>(null);
  const customerLastReadAtRef = React.useRef<string | null>(null);
  const dismissedNewRef = React.useRef<Set<string>>(new Set());
  const newDismissTimersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [newDismissTick, setNewDismissTick] = React.useState(0);
  const insets = useSafeAreaInsets();

  const feedMessagesOnly = React.useCallback((items: ThreadFeedItem[]) => {
    return items.filter((x) => x.kind === "message");
  }, []);

  const syncUnreadBadge = React.useCallback(
    (count: number) => {
      onUnreadCountChange?.(count);
    },
    [onUnreadCountChange]
  );

  const dismissKeyboard = React.useCallback(() => {
    Keyboard.dismiss();
    inputRef.current?.blur();
  }, []);

  const applyHubResponse = React.useCallback(
    (res: CustomerChatHubResponse, nextFeed: ThreadFeedItem[], resetNewLabels: boolean) => {
      if (!res.ok) return false;
      setHub(res);
      customerLastReadAtRef.current = res.customerLastReadAt ?? null;
      if (resetNewLabels) {
        dismissedNewRef.current = new Set();
        for (const t of newDismissTimersRef.current.values()) clearTimeout(t);
        newDismissTimersRef.current.clear();
      }
      setFeed(nextFeed);
      roomIdRef.current = res.chatRoomId ?? null;
      if (res.chatRoomId) joinChatRoom(res.chatRoomId);
      syncUnreadBadge(res.roomUnreadCount ?? 0);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 80);
      return true;
    },
    [syncUnreadBadge]
  );

  const loadHub = React.useCallback(
    async (opts?: { force?: boolean }) => {
      const force = opts?.force === true;
      const rid = restaurantId.trim();
      setLoadErr(null);

      const cached = !force ? await readChatSnapshot(userId, rid) : null;
      if (cached?.hub.ok) {
        applyHubResponse(cached.hub, cached.feed, false);
        setLoading(false);
        setRevalidating(true);
        refreshChatHubSilent(token, rid, userId, (hub) => {
          setRevalidating(false);
          if (!hub.ok) return;
          const serverFeed = feedMessagesOnly(hub.threadFeed ?? []);
          setFeed((prev) => {
            const merged = mergeThreadFeed(prev, serverFeed);
            void writeChatSnapshot(userId, rid, hub, merged);
            return merged;
          });
          setHub((h) => (h ? { ...h, ...hub } : hub));
          if (hub.customerLastReadAt !== undefined) {
            customerLastReadAtRef.current = hub.customerLastReadAt;
          }
          if (hub.chatRoomId) {
            roomIdRef.current = hub.chatRoomId;
            joinChatRoom(hub.chatRoomId);
          }
          if (hub.roomUnreadCount != null) syncUnreadBadge(hub.roomUnreadCount);
        });
        return;
      }

      setLoading(true);
      const res = await fetchCustomerChatHub(token, rid || undefined);
      setLoading(false);

      if (!res.ok) {
        const raw = typeof res.error === "string" ? res.error : "";
        const friendly =
          /ChatRoom|does not exist|migration/i.test(raw)
            ? "The server database is still updating. Pull to refresh in a minute, or redeploy the API if this persists."
            : raw || "Could not load assistance.";
        setLoadErr(friendly);
        setHub(null);
        setFeed([]);
        return;
      }

      const serverFeed = feedMessagesOnly(res.threadFeed ?? []);
      applyHubResponse(res, serverFeed, true);
      void writeChatSnapshot(userId, rid, res, serverFeed);
    },
    [token, restaurantId, userId, feedMessagesOnly, applyHubResponse]
  );

  const tryMarkThreadRead = React.useCallback(() => {
    const roomId = roomIdRef.current;
    if (!roomId || !chatFocused) return;
    const readAt = customerLastReadAtRef.current;
    const unreadIncoming = feed.filter((m) => isMessageUnread(m, readAt));
    if (unreadIncoming.length === 0) return;
    const allDismissed = unreadIncoming.every((m) => dismissedNewRef.current.has(m.id));
    if (!allDismissed) return;
    sendChatRead(roomId);
    const nowIso = new Date().toISOString();
    customerLastReadAtRef.current = nowIso;
    setHub((h) => (h ? { ...h, customerLastReadAt: nowIso, roomUnreadCount: 0 } : h));
    syncUnreadBadge(0);
  }, [chatFocused, feed, syncUnreadBadge]);

  const scheduleNewDismiss = React.useCallback(
    (messageId: string) => {
      if (dismissedNewRef.current.has(messageId)) return;
      if (newDismissTimersRef.current.has(messageId)) return;
      const t = setTimeout(() => {
        dismissedNewRef.current.add(messageId);
        newDismissTimersRef.current.delete(messageId);
        setNewDismissTick((n) => n + 1);
        tryMarkThreadRead();
      }, NEW_LABEL_DISMISS_MS);
      newDismissTimersRef.current.set(messageId, t);
    },
    [tryMarkThreadRead]
  );

  const onViewableItemsChanged = React.useCallback(
    ({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
      if (!chatFocused) return;
      const readAt = customerLastReadAtRef.current;
      for (const v of viewableItems) {
        const item = v.item as ThreadFeedItem | undefined;
        if (!item || !isMessageUnread(item, readAt)) continue;
        scheduleNewDismiss(item.id);
      }
    },
    [chatFocused, scheduleNewDismiss]
  );

  const viewabilityConfig = React.useRef({ itemVisiblePercentThreshold: 55 }).current;

  React.useEffect(() => {
    void loadHub();
  }, [loadHub]);

  React.useEffect(() => {
    if (!hub?.ok) return;
    const rid = restaurantId.trim();
    if (!rid) return;
    const t = setTimeout(() => {
      void writeChatSnapshot(userId, rid, hub, feed);
    }, 350);
    return () => clearTimeout(t);
  }, [hub, feed, userId, restaurantId]);

  const refreshPresence = React.useCallback(async () => {
    if (!restaurantId.trim()) return;
    const res = await fetchCustomerChatHub(token, restaurantId.trim());
    if (res.ok) {
      setHub((h) =>
        h
          ? {
              ...h,
              venueStatus: res.venueStatus ?? h.venueStatus,
              roomUnreadCount: res.roomUnreadCount ?? h.roomUnreadCount,
              customerLastReadAt: res.customerLastReadAt ?? h.customerLastReadAt
            }
          : h
      );
      if (res.customerLastReadAt !== undefined) {
        customerLastReadAtRef.current = res.customerLastReadAt;
      }
      if (res.roomUnreadCount != null) syncUnreadBadge(res.roomUnreadCount);
    }
  }, [token, restaurantId, syncUnreadBadge]);

  React.useEffect(() => {
    if (!hub?.restaurant?.id) return;
    const t = setInterval(() => void refreshPresence(), 12000);
    return () => clearInterval(t);
  }, [hub?.restaurant?.id, refreshPresence]);

  React.useEffect(() => {
    const showEv = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEv = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEv, () => {
      setKeyboardOpen(true);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    });
    const hideSub = Keyboard.addListener(hideEv, () => setKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  React.useEffect(() => {
    const off = subscribeChatRelay((payload) => {
      const roomId = roomIdRef.current;
      if (!roomId) return;
      if (payload.type === "message_delivery" && payload.chatRoomId === roomId) {
        setFeed((prev) => patchMyDeliveryStatus(prev, "delivered", payload.messageId));
        return;
      }
      if (payload.type === "messages_read" && payload.chatRoomId === roomId && payload.readerRole !== "CUSTOMER") {
        setFeed((prev) => patchMyDeliveryStatus(prev, "read"));
        return;
      }
      if (payload.type === "new_message" && payload.message.chatRoomId === roomId) {
        setFeed((prev) => {
          if (prev.some((x) => x.kind === "message" && x.id === payload.message.id)) return prev;
          const msg: ThreadFeedItem = {
            ...payload.message,
            kind: "message",
            deliveryStatus:
              payload.message.senderRole === "CUSTOMER"
                ? payload.message.deliveryStatus ?? "sent"
                : undefined
          };
          return [...prev, msg];
        });
        if (payload.message.senderRole !== "CUSTOMER") {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setHub((h) => {
            if (!h) return h;
            const next = (h.roomUnreadCount ?? 0) + 1;
            syncUnreadBadge(next);
            return { ...h, roomUnreadCount: next };
          });
        }
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
        return;
      }
      if (payload.type === "user_typing" && payload.chatRoomId === roomId && payload.role !== "CUSTOMER") {
        setVenueTyping(payload.isTyping);
        if (typingClearRef.current) clearTimeout(typingClearRef.current);
        if (payload.isTyping) {
          typingClearRef.current = setTimeout(() => setVenueTyping(false), TYPING_CLEAR_MS);
        }
      }
    });
    return off;
  }, []);

  const onDraftChange = React.useCallback((text: string) => {
    setDraft(text);
    const roomId = roomIdRef.current;
    if (!roomId) return;
    const now = Date.now();
    if (now - lastTypingEmitRef.current >= TYPING_EMIT_MS) {
      lastTypingEmitRef.current = now;
      sendChatTyping(roomId, true);
    }
    if (typingStopRef.current) clearTimeout(typingStopRef.current);
    typingStopRef.current = setTimeout(() => sendChatTyping(roomId, false), TYPING_IDLE_MS);
  }, []);

  function focusComposer(hint?: string) {
    if (hint) setDraft((d) => (d.trim().length ? d : hint));
    setTimeout(() => inputRef.current?.focus(), 80);
  }

  function runQuickAction(id: CustomerChatQuickActionId) {
    void Haptics.selectionAsync();
    switch (id) {
      case "view_menu":
      case "browse_menu":
        onViewMenu();
        break;
      case "popular_items":
        onPopularItems();
        break;
      case "opening_hours":
      case "call_staff":
        break;
      case "ask_ingredients":
        focusComposer("Hi — can you confirm ingredients for ");
        break;
      case "request_customization":
        focusComposer("I'd like to request a customization: ");
        break;
      case "open_cart":
        onOpenCart();
        break;
      case "place_order":
        onPlaceOrder();
        break;
      case "reorder":
        onReorder();
        break;
      case "contact_support":
        focusComposer("Hi — I need help with a previous order. ");
        break;
      default:
        break;
    }
  }

  async function uploadChatImages(images: PreparedChatImage[]) {
    const rid = hub?.restaurant?.id ?? restaurantId.trim();
    if (!rid || !images.length) return;
    setPickingImage(true);
    const res = await postCustomerChatImages(token, {
      restaurantId: rid,
      orderId: hub?.activeOrder?.id,
      images
    });
    setPickingImage(false);
    if (!res.ok) {
      const msg =
        res.error === "image_quota_exceeded"
          ? "You have reached the photo limit for this chat."
          : typeof res.error === "string"
            ? res.error
            : "Could not send photos.";
      Alert.alert("Photos not sent", msg);
      return;
    }
    void playCartAddCue();
    if (res.messages?.length) {
      setFeed((prev) => {
        const ids = new Set(prev.filter((x) => x.kind === "message").map((x) => x.id));
        const added = res.messages!
          .filter((m) => !ids.has(m.id))
          .map((m) => ({
            ...m,
            kind: "message" as const,
            isMine: true,
            deliveryStatus: m.deliveryStatus ?? "sent"
          }));
        return [...prev, ...added];
      });
    }
    if (res.chatImageQuota) {
      setHub((h) => (h ? { ...h, chatImageQuota: res.chatImageQuota } : h));
    }
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }

  function pickAndSendImages() {
    const rid = hub?.restaurant?.id ?? restaurantId.trim();
    if (!rid || pickingImage || sending) return;
    const quota = hub?.chatImageQuota ?? { used: 0, max: 10, perSend: 3 };
    const remaining = Math.max(0, quota.max - quota.used);
    void (async () => {
      setPickingImage(true);
      const picked = await pickChatImages(remaining);
      setPickingImage(false);
      if (!picked?.length) return;
      const venue = hub?.restaurant?.name ?? "Restaurant";
      confirmSendChatImages(picked.length, venue, remaining - picked.length, () => {
        void uploadChatImages(picked);
      });
    })();
  }

  async function sendMessage() {
    const rid = hub?.restaurant?.id ?? restaurantId.trim();
    if (!rid || !draft.trim() || sending) return;
    const roomId = roomIdRef.current;
    if (roomId) sendChatTyping(roomId, false);
    setSending(true);
    const res = await postCustomerChatMessage(token, {
      restaurantId: rid,
      content: draft.trim(),
      orderId: hub?.activeOrder?.id
    });
    setSending(false);
    if (!res.ok) {
      Alert.alert("Message not sent", typeof res.error === "string" ? res.error : "Try again.");
      return;
    }
    void playCartAddCue();
    if (res.message) {
      setFeed((prev) => {
        if (prev.some((x) => x.kind === "message" && x.id === res.message!.id)) return prev;
        return [
          ...prev,
          {
            ...res.message!,
            kind: "message",
            isMine: true,
            deliveryStatus: res.message!.deliveryStatus ?? "sent"
          }
        ];
      });
    }
    setDraft("");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
      inputRef.current?.focus();
    }, 60);
  }

  const needsVenue = hub?.needsVenue === true;

  const listFooter = venueTyping ? (
    <View style={styles.footerPad}>
      <View style={styles.typingRow}>
        <ChatTypingDots />
        <Text style={styles.typingLabel}>Restaurant is typing</Text>
      </View>
    </View>
  ) : null;

  /** Just above floating tab bar when keyboard closed; flush when open. */
  const composerBottomPad = keyboardOpen ? 0 : chatComposerBottomInset(insets.bottom);

  const listTopInset = chatListTopInset(scrollTopPad);
  const showVenueStatus = Boolean(hub?.ok && !needsVenue);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <ChatCollapsingHeader
        scrollY={scrollY}
        topInset={scrollTopPad}
        showStatus={showVenueStatus}
        openingHours={hub?.restaurant?.openingHours}
        venueStatus={hub?.venueStatus}
        onInfoPress={showVenueStatus ? () => setVenueInfoOpen(true) : undefined}
      />

      <ChatVenueInfoModal
        visible={venueInfoOpen}
        onClose={() => setVenueInfoOpen(false)}
        venueName={hub?.restaurant?.name ?? "Restaurant"}
        openingHours={hub?.restaurant?.openingHours}
        onAddItems={() => runQuickAction("view_menu")}
      />

      {loading && !hub?.ok ? (
        <Pressable style={styles.loadingRow} onPress={dismissKeyboard}>
          <ActivityIndicator color={R.accentPurple} />
          <Text style={styles.loadingText}>Loading thread…</Text>
        </Pressable>
      ) : null}
      {revalidating && hub?.ok ? (
        <View style={[styles.syncDotRow, { top: listTopInset - 28 }]} pointerEvents="none">
          <ActivityIndicator size="small" color={R.accentPurple} />
        </View>
      ) : null}

      {loadErr && !loading ? (
        <ScreenErrorState
          style={{ flex: 1, marginTop: listTopInset }}
          title="Could not connect"
          message={loadErr}
          onRetry={() => void loadHub({ force: true })}
        />
      ) : null}

      {!loading && hub?.ok && !loadErr ? (
        <View style={styles.threadColumn}>
          <Animated.FlatList
            ref={listRef as React.RefObject<FlatList<ThreadFeedItem>>}
            data={feed}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={[styles.listContent, { paddingTop: listTopInset }]}
            onScroll={onScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="never"
            keyboardDismissMode="on-drag"
            ListFooterComponent={listFooter}
            onScrollBeginDrag={dismissKeyboard}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            renderItem={({ item, index }) => {
              const prev = feed[index - 1];
              const next = feed[index + 1];
              void newDismissTick;
              const readAt = customerLastReadAtRef.current;
              const itemUnread =
                isMessageUnread(item, readAt) && !dismissedNewRef.current.has(item.id);
              const prevUnreadIncoming =
                !!prev &&
                isIncomingMessage(prev) &&
                isMessageUnread(prev, readAt) &&
                !dismissedNewRef.current.has(prev.id);
              const incomingUnread = itemUnread && isIncomingMessage(item);
              const showNew = incomingUnread && !prevUnreadIncoming;
              return (
                <ChatMessageBubble
                  item={item}
                  groupWithPrev={sameGroup(item, prev)}
                  groupWithNext={sameGroup(item, next)}
                  showNewLabel={showNew}
                  timeUnread={incomingUnread}
                />
              );
            }}
            ListEmptyComponent={
              <Pressable style={styles.emptyHint} onPress={dismissKeyboard}>
                <Text style={styles.emptyText}>
                  {needsVenue
                    ? "Choose a venue in Orders to start messaging."
                    : "No messages yet — ask about your order, ingredients, or pickup."}
                </Text>
                {needsVenue ? (
                  <Pressable style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]} onPress={onChooseVenue}>
                    <Text style={styles.retryText}>Choose venue</Text>
                  </Pressable>
                ) : null}
              </Pressable>
            }
          />

          {!needsVenue ? (
            <View style={[styles.composerDock, { paddingBottom: composerBottomPad }]}>
              <ChatComposerBar
                value={draft}
                onChange={onDraftChange}
                onSend={() => void sendMessage()}
                onPickImages={pickAndSendImages}
                sending={sending}
                pickingImage={pickingImage}
                inputRef={inputRef}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, zIndex: 1, backgroundColor: "transparent" },
  threadColumn: { flex: 1, minHeight: 0 },
  composerDock: {
    paddingTop: 2,
    paddingHorizontal: FLOAT_MARGIN_SIDE,
    backgroundColor: "transparent"
  },
  list: { flex: 1 },
  listContent: { paddingBottom: 12, flexGrow: 1 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 24 },
  syncDotRow: { position: "absolute", right: 16, zIndex: 14 },
  loadingText: { fontSize: R.type.label, color: R.textSecondary, fontWeight: "600" },
  retryBtn: {
    marginTop: 12,
    alignSelf: "center",
    backgroundColor: R.accentPurple,
    borderRadius: R.radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  retryText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  footerPad: { paddingHorizontal: 8, paddingTop: 8 },
  typingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, paddingLeft: 8 },
  typingLabel: { fontSize: 13, fontWeight: "700", color: R.accentPurple },
  emptyHint: { padding: 24, alignItems: "center" },
  emptyText: { textAlign: "center", fontSize: 15, lineHeight: 22, color: R.textSecondary, fontWeight: "600" },
  pressed: { opacity: 0.88 }
});
