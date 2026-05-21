import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { R } from "../theme";
import { formatOpeningHoursLines } from "./venueHoursDisplay";
import {
  fetchCustomerChatHub,
  postCustomerChatMessage,
  type CustomerChatHubResponse,
  type CustomerChatQuickActionId,
  type ThreadFeedItem
} from "./customerChatApi";
import { ChatComposerBar } from "./chat/ChatComposerBar";
import { ChatMessageBubble } from "./chat/ChatMessageBubble";
import { ChatThreadHeader } from "./chat/ChatThreadHeader";
import { ChatVenueStatusRow } from "./chat/ChatVenueStatusRow";
import { ChatTypingDots } from "./chat/ChatTypingDots";
import {
  connectCustomerChatSocket,
  disconnectCustomerChatSocket,
  joinChatRoom,
  sendChatRead,
  sendChatTyping,
  subscribeChatRelay
} from "./chat/customerChatSocket";

const TYPING_EMIT_MS = 400;
const TYPING_IDLE_MS = 2800;
const TYPING_CLEAR_MS = 6500;

type Props = {
  token: string;
  restaurantId: string;
  money: (cents: number) => string;
  onScroll: ReturnType<typeof Animated.event>;
  scrollTopPad: number;
  scrollBottom: number;
  refreshKey: number;
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
    onScroll,
    scrollTopPad,
    scrollBottom,
    refreshKey,
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
  const [loadErr, setLoadErr] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [venueTyping, setVenueTyping] = React.useState(false);
  const [keyboardOpen, setKeyboardOpen] = React.useState(false);
  const inputRef = React.useRef<TextInput>(null);
  const listRef = React.useRef<FlatList<ThreadFeedItem>>(null);
  const typingStopRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingClearRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmitRef = React.useRef(0);
  const roomIdRef = React.useRef<string | null>(null);

  const dismissKeyboard = React.useCallback(() => {
    Keyboard.dismiss();
    inputRef.current?.blur();
  }, []);

  const loadHub = React.useCallback(async () => {
    setLoading(true);
    setLoadErr(null);
    const res = await fetchCustomerChatHub(token, restaurantId.trim() || undefined);
    if (!res.ok) {
      const raw = typeof res.error === "string" ? res.error : "";
      const friendly =
        /ChatRoom|does not exist|migration/i.test(raw)
          ? "The server database is still updating. Pull to refresh in a minute, or redeploy the API if this persists."
          : raw || "Could not load assistance.";
      setLoadErr(friendly);
      setHub(null);
      setFeed([]);
      setLoading(false);
      return;
    }
    setHub(res);
    setFeed(res.threadFeed ?? []);
    roomIdRef.current = res.chatRoomId ?? null;
    if (res.chatRoomId) {
      joinChatRoom(res.chatRoomId);
      sendChatRead(res.chatRoomId);
    }
    setLoading(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 80);
  }, [token, restaurantId]);

  React.useEffect(() => {
    connectCustomerChatSocket(token);
    return () => disconnectCustomerChatSocket();
  }, [token]);

  React.useEffect(() => {
    void loadHub();
  }, [loadHub, refreshKey]);

  const refreshPresence = React.useCallback(async () => {
    if (!restaurantId.trim()) return;
    const res = await fetchCustomerChatHub(token, restaurantId.trim());
    if (res.ok && res.venueStatus) {
      setHub((h) => (h ? { ...h, venueStatus: res.venueStatus } : h));
    }
  }, [token, restaurantId]);

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
            kind: "message",
            ...payload.message,
            deliveryStatus:
              payload.message.senderRole === "CUSTOMER"
                ? payload.message.deliveryStatus ?? "sent"
                : undefined
          };
          return [...prev, msg];
        });
        if (payload.message.senderRole !== "CUSTOMER") {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

  function showOpeningHours() {
    const lines = formatOpeningHoursLines(hub?.restaurant?.openingHours);
    const name = hub?.restaurant?.name?.trim() || "This venue";
    Alert.alert(`${name} — hours`, lines.join("\n"), [{ text: "OK" }]);
  }

  function showCallStaff() {
    const name = hub?.restaurant?.name?.trim() || "the restaurant";
    Alert.alert(
      "Call staff",
      `Visit the counter or service area at ${name}. Your messages here reach the team when they are online.`,
      [{ text: "OK" }]
    );
  }

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
        showOpeningHours();
        break;
      case "call_staff":
        showCallStaff();
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
    if (res.message) {
      setFeed((prev) => {
        if (prev.some((x) => x.kind === "message" && x.id === res.message!.id)) return prev;
        return [
          ...prev,
          {
            kind: "message",
            ...res.message!,
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

  const listHeader = hub?.ok ? (
    <ChatThreadHeader hub={hub} venueTyping={venueTyping} money={money} onQuickAction={(id) => runQuickAction(id as CustomerChatQuickActionId)} />
  ) : null;

  const listFooter = (
    <View style={styles.footerPad}>
      {venueTyping ? (
        <View style={styles.typingRow}>
          <ChatTypingDots />
          <Text style={styles.typingLabel}>Restaurant is typing</Text>
        </View>
      ) : null}
      {hub?.scene === "completed_only" && (hub.recentOrders?.length ?? 0) > 0 ? (
        <View style={styles.recentCard}>
          <Text style={styles.recentTitle}>Recent orders</Text>
          {hub.recentOrders!.map((o) => (
            <Text key={o.id} style={styles.recentLine}>
              #{o.id.slice(-6).toUpperCase()} · {o.status} · {money(o.totalCents)}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );

  /** Tab-bar clearance only when keyboard is closed; flush to keyboard when open. */
  const composerBottomPad = keyboardOpen ? 0 : scrollBottom;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: scrollTopPad }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <Pressable style={styles.titleRow} onPress={dismissKeyboard} accessibilityRole="button">
        <Text style={styles.pageTitle}>Chat</Text>
        <ChatVenueStatusRow
          openingHours={hub?.restaurant?.openingHours}
          venueStatus={hub?.venueStatus}
        />
      </Pressable>

      {loading ? (
        <Pressable style={styles.loadingRow} onPress={dismissKeyboard}>
          <ActivityIndicator color={R.accentPurple} />
          <Text style={styles.loadingText}>Loading thread…</Text>
        </Pressable>
      ) : null}

      {loadErr ? (
        <Pressable style={[styles.errCard, { marginHorizontal: R.space.sm }]} onPress={dismissKeyboard}>
          <Text style={styles.errTitle}>Could not connect</Text>
          <Text style={styles.errBody}>{loadErr}</Text>
          <Pressable style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]} onPress={() => void loadHub()}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </Pressable>
      ) : null}

      {!loading && hub?.ok && !loadErr ? (
        <View style={styles.threadColumn}>
          <Animated.FlatList
            ref={listRef as React.RefObject<FlatList<ThreadFeedItem>>}
            data={feed}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            onScroll={onScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="never"
            keyboardDismissMode="on-drag"
            ListHeaderComponent={listHeader}
            ListFooterComponent={listFooter}
            onScrollBeginDrag={dismissKeyboard}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item, index }) => {
              const prev = feed[index - 1];
              const next = feed[index + 1];
              const showNew =
                item.kind === "message" &&
                item.senderRole !== "CUSTOMER" &&
                !sameGroup(item, prev) &&
                index === feed.findIndex((x) => x.kind === "message" && x.senderRole !== "CUSTOMER");
              return (
                <ChatMessageBubble
                  item={item}
                  groupWithPrev={sameGroup(item, prev)}
                  groupWithNext={sameGroup(item, next)}
                  showNewLabel={showNew}
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
                sending={sending}
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
    paddingTop: 6,
    paddingHorizontal: 0,
    backgroundColor: "transparent"
  },
  titleRow: { paddingHorizontal: R.space.sm, paddingBottom: 6 },
  pageTitle: { fontSize: 26, fontWeight: "800", color: R.text, letterSpacing: -0.35 },
  list: { flex: 1 },
  listContent: { paddingBottom: 12, flexGrow: 1 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 24 },
  loadingText: { fontSize: R.type.label, color: R.textSecondary, fontWeight: "600" },
  errCard: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: R.radius.card,
    borderWidth: 1,
    borderColor: R.border,
    padding: R.space.sm
  },
  errTitle: { fontSize: 17, fontWeight: "800", color: R.text },
  errBody: { marginTop: 6, fontSize: 15, lineHeight: 22, color: R.textSecondary },
  retryBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: R.accentPurple,
    borderRadius: R.radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  retryText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  footerPad: { paddingHorizontal: 8, paddingTop: 8 },
  typingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, paddingLeft: 8 },
  typingLabel: { fontSize: 13, fontWeight: "700", color: R.accentPurple },
  recentCard: {
    marginTop: 8,
    padding: 12,
    borderRadius: R.radius.card,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderWidth: 1,
    borderColor: R.border
  },
  recentTitle: { fontSize: 11, fontWeight: "800", color: R.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
  recentLine: { marginTop: 8, fontSize: 14, fontWeight: "600", color: R.textSecondary },
  emptyHint: { padding: 24, alignItems: "center" },
  emptyText: { textAlign: "center", fontSize: 15, lineHeight: 22, color: R.textSecondary, fontWeight: "600" },
  pressed: { opacity: 0.88 }
});
