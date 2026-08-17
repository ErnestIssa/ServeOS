import * as Haptics from "expo-haptics";
import React from "react";
import {
  Alert,
  Animated,
  FlatList,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  mergeThreadFeed,
  readChatSnapshot,
  refreshChatHubSilent,
  writeChatSnapshot
} from "../data/customerDataCache";
import {
  fetchCustomerChatHub,
  fetchCustomerChatVenueCallLine,
  postCustomerChatDocument,
  postCustomerChatImages,
  postCustomerChatMessage,
  type CustomerChatHubResponse,
  type CustomerChatQuickActionId,
  type ThreadFeedItem
} from "./customerChatApi";
import { ChatVenueCallModal } from "./chat/ChatVenueCallModal";
import { ChatVenueInfoModal } from "./chat/ChatVenueInfoModal";
import { TypingIndicator } from "./chat/messages/TypingIndicator";
import { ChatCameraCapture } from "./chat/ChatCameraCapture";
import { pickChatImagesFromLibrary, prepareChatImageFromUri, type PreparedChatImage } from "./chat/chatImageAttach";
import { pickChatDocument, type PreparedChatDocument } from "./chat/chatDocumentAttach";
import { OclTimelineStrip } from "./chat/OclTimelineStrip";
import { isMessageUnread } from "./chat/chatUnreadHelpers";
import { joinChatRoom, sendChatRead, sendChatTyping, subscribeChatRelay } from "./chat/customerChatSocket";
import { ChatVenueTypeRotator } from "./chat/ChatVenueTypeRotator";
import { ScreenErrorState } from "../errors";
import { SkeletonChatThread, SkeletonSyncDot } from "../components/skeleton/SkeletonUi";
import { noMenuAtVenueMessage } from "./venueContentHelpers";
import { playCartAddCue } from "./cartCueSound";
import {
  CHAT_BACKGROUND,
  feedToUnityMessages,
  UnityChatScreen,
  type UnityAttachChoice
} from "./chat/unity";
import { GlassChip } from "./chat/unity/GlassChip";
import { colors as unityColors, spacing as unitySpacing } from "./chat/unity/theme";
import { hapticSelection } from "./chat/unity/haptics";

const TYPING_EMIT_MS = 400;
const TYPING_IDLE_MS = 2800;
const TYPING_CLEAR_MS = 6500;
const NEW_LABEL_DISMISS_MS = 10_000;

const NO_VENUE_HUB: CustomerChatHubResponse = {
  ok: true,
  needsVenue: true,
  scene: "new"
};

function isVenueUnavailableError(error: unknown): boolean {
  const raw = typeof error === "string" ? error : "";
  return raw === "restaurant_not_found" || raw === "venue_not_selected";
}

type Props = {
  token: string;
  restaurantId: string;
  money: (cents: number) => string;
  scrollY: Animated.Value;
  onScroll: ReturnType<typeof Animated.event>;
  onScrollEndDrag?: () => void;
  onMomentumScrollEnd?: () => void;
  userId?: string | null;
  chatFocused: boolean;
  onUnreadCountChange?: (count: number) => void;
  onViewMenu: () => void;
  onPopularItems: () => void;
  onOpenCart: () => void;
  onPlaceOrder: () => void;
  onReorder: () => void;
  hasBrowsableMenu?: boolean;
  venueDisplayName?: string;
  onSwitchVenue?: () => void;
  onBack: () => void;
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

const OPTIMISTIC_PREFIX = "opt-";

function isOptimisticMessageId(id: string): boolean {
  return id.startsWith(OPTIMISTIC_PREFIX);
}

function createOptimisticMessage(
  content: string,
  chatRoomId: string,
  senderUserId: string | null | undefined
): ThreadFeedItem {
  return {
    kind: "message",
    id: `${OPTIMISTIC_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    chatRoomId,
    senderUserId: senderUserId ?? null,
    senderRole: "CUSTOMER",
    content,
    type: "TEXT",
    createdAt: new Date().toISOString(),
    deliveryStatus: "sent",
    isMine: true
  };
}

function reconcileSentMessage(
  prev: ThreadFeedItem[],
  serverMsg: Extract<ThreadFeedItem, { kind: "message" }>,
  optimisticId?: string
): ThreadFeedItem[] {
  const normalized: ThreadFeedItem = {
    ...serverMsg,
    kind: "message",
    isMine: true,
    deliveryStatus: serverMsg.deliveryStatus ?? "sent"
  };

  if (prev.some((x) => x.kind === "message" && x.id === serverMsg.id)) {
    return prev.filter((x) => !(optimisticId && x.id === optimisticId));
  }

  let replaced = false;
  const next = prev.map((item) => {
    if (item.kind !== "message" || !item.isMine) return item;
    if (optimisticId && item.id === optimisticId) {
      replaced = true;
      return normalized;
    }
    if (!replaced && isOptimisticMessageId(item.id) && item.content.trim() === serverMsg.content.trim()) {
      replaced = true;
      return normalized;
    }
    return item;
  });

  return replaced ? next : [...next, normalized];
}

export function CustomerChatScreen(props: Props) {
  const {
    token,
    restaurantId,
    userId,
    chatFocused,
    onUnreadCountChange,
    onViewMenu,
    onPopularItems,
    onOpenCart,
    onPlaceOrder,
    onReorder,
    hasBrowsableMenu = true,
    venueDisplayName = "",
    onSwitchVenue,
    onBack
  } = props;

  const [hub, setHub] = React.useState<CustomerChatHubResponse | null>(null);
  const [feed, setFeed] = React.useState<ThreadFeedItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [revalidating, setRevalidating] = React.useState(false);
  const [loadErr, setLoadErr] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [pickingImage, setPickingImage] = React.useState(false);
  const [venueTyping, setVenueTyping] = React.useState(false);
  const [venueInfoOpen, setVenueInfoOpen] = React.useState(false);
  const [venueInfoPanel, setVenueInfoPanel] = React.useState<"menu" | "opening_hours">("menu");
  const [venueCallOpen, setVenueCallOpen] = React.useState(false);
  const [callingVenue, setCallingVenue] = React.useState(false);
  const [cameraOpen, setCameraOpen] = React.useState(false);
  const listRef = React.useRef<FlatList<unknown>>(null);
  const typingStopRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingClearRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmitRef = React.useRef(0);
  const roomIdRef = React.useRef<string | null>(null);
  const customerLastReadAtRef = React.useRef<string | null>(null);
  const dismissedNewRef = React.useRef<Set<string>>(new Set());
  const newDismissTimersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const insets = useSafeAreaInsets();
  const loadGenRef = React.useRef(0);

  const hasVenueSelected = Boolean(restaurantId.trim());

  const listRows = React.useMemo(
    () =>
      feedToUnityMessages(feed, {
        venueName: hub?.restaurant?.name?.trim() || venueDisplayName.trim() || "Venue"
      }),
    [feed, hub?.restaurant?.name, venueDisplayName]
  );

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
  }, []);

  // Keep prop surface for App shell; immersive UNITY chat owns scroll internally.
  void props.money;
  void props.scrollY;
  void props.onScroll;
  void props.onScrollEndDrag;
  void props.onMomentumScrollEnd;
  void dismissKeyboard;

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

  const resetNoVenueState = React.useCallback(() => {
    loadGenRef.current += 1;
    setLoading(false);
    setRevalidating(false);
    setLoadErr(null);
    setHub(null);
    setFeed([]);
    roomIdRef.current = null;
    syncUnreadBadge(0);
  }, [syncUnreadBadge]);

  const loadHub = React.useCallback(
    async (opts?: { force?: boolean }) => {
      const rid = restaurantId.trim();
      if (!rid) {
        resetNoVenueState();
        return;
      }
      if (!hasBrowsableMenu) {
        resetNoVenueState();
        return;
      }

      const gen = ++loadGenRef.current;
      const force = opts?.force === true;
      setLoadErr(null);

      const cached = !force ? await readChatSnapshot(userId, rid) : null;
      if (gen !== loadGenRef.current) return;

      if (cached?.hub.ok) {
        if (cached.hub.needsVenue) {
          resetNoVenueState();
          setHub(NO_VENUE_HUB);
          return;
        }
        applyHubResponse(cached.hub, cached.feed, false);
        setLoading(false);
        setRevalidating(true);
        refreshChatHubSilent(token, rid, userId, (hub) => {
          if (gen !== loadGenRef.current) return;
          setRevalidating(false);
          if (!hub.ok) {
            if (isVenueUnavailableError(hub.error)) {
              resetNoVenueState();
              setHub(NO_VENUE_HUB);
            }
            return;
          }
          if (hub.needsVenue) {
            resetNoVenueState();
            setHub(NO_VENUE_HUB);
            return;
          }
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
      const res = await fetchCustomerChatHub(token, rid);
      if (gen !== loadGenRef.current) return;
      setLoading(false);

      if (!res.ok) {
        if (isVenueUnavailableError(res.error)) {
          resetNoVenueState();
          setHub(NO_VENUE_HUB);
          return;
        }
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

      if (res.needsVenue) {
        resetNoVenueState();
        setHub(NO_VENUE_HUB);
        return;
      }

      const serverFeed = feedMessagesOnly(res.threadFeed ?? []);
      applyHubResponse(res, serverFeed, true);
      void writeChatSnapshot(userId, rid, res, serverFeed);
    },
    [token, restaurantId, userId, feedMessagesOnly, applyHubResponse, resetNoVenueState, syncUnreadBadge, hasBrowsableMenu]
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
        tryMarkThreadRead();
      }, NEW_LABEL_DISMISS_MS);
      newDismissTimersRef.current.set(messageId, t);
    },
    [tryMarkThreadRead]
  );

  React.useEffect(() => {
    if (!chatFocused) return;
    const readAt = customerLastReadAtRef.current;
    for (const m of feed) {
      if (m.kind !== "message") continue;
      if (!isMessageUnread(m, readAt)) continue;
      scheduleNewDismiss(m.id);
    }
  }, [chatFocused, feed, scheduleNewDismiss]);

  React.useEffect(() => {
    if (!hasVenueSelected) {
      resetNoVenueState();
      return;
    }
    if (!hasBrowsableMenu) {
      resetNoVenueState();
      return;
    }
    void loadHub();
  }, [loadHub, hasVenueSelected, hasBrowsableMenu, resetNoVenueState]);

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
    const showSub = Keyboard.addListener(showEv, () => {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    });
    return () => showSub.remove();
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
          const incoming: ThreadFeedItem = {
            ...payload.message,
            kind: "message",
            deliveryStatus:
              payload.message.senderRole === "CUSTOMER"
                ? payload.message.deliveryStatus ?? "sent"
                : undefined
          };
          if (payload.message.senderRole === "CUSTOMER") {
            return reconcileSentMessage(prev, incoming as Extract<ThreadFeedItem, { kind: "message" }>);
          }
          return [...prev, incoming];
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
        openVenueInfo("opening_hours");
        break;
      case "call_staff":
        setVenueCallOpen(true);
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
    if (!rid || pickingImage) return;
    const quota = hub?.chatImageQuota ?? { used: 0, max: 10, perSend: 3 };
    const remaining = Math.max(0, quota.max - quota.used);
    void (async () => {
      const picked = await pickChatImagesFromLibrary(remaining);
      if (!picked?.length) return;
      void uploadChatImages(picked);
    })();
  }

  function sendCapturedImage(uri: string) {
    const rid = hub?.restaurant?.id ?? restaurantId.trim();
    if (!rid || pickingImage) return;
    void (async () => {
      setPickingImage(true);
      const prepared = await prepareChatImageFromUri(uri);
      setPickingImage(false);
      if (!prepared) {
        Alert.alert("Could not use photo", "Try taking another picture.");
        return;
      }
      void uploadChatImages([prepared]);
    })();
  }

  function openVenueInfo(panel: "menu" | "opening_hours") {
    setVenueInfoPanel(panel);
    setVenueInfoOpen(true);
  }

  async function confirmVenueCall() {
    const rid = hub?.restaurant?.id ?? restaurantId.trim();
    if (!rid || callingVenue) return;
    setCallingVenue(true);
    try {
      const res = await fetchCustomerChatVenueCallLine(token, rid);
      if (!res.ok || !res.dialUri) {
        Alert.alert(
          "Cannot call venue",
          res.error === "no_call_line_configured"
            ? "This venue has not set up a phone number yet."
            : "Could not start a call right now. Try again later."
        );
        return;
      }
      const telUrl = `tel:${res.dialUri}`;
      const canOpen = await Linking.canOpenURL(telUrl);
      if (!canOpen) {
        Alert.alert("Cannot call", "Phone calls are not available on this device.");
        return;
      }
      await Linking.openURL(telUrl);
      setVenueCallOpen(false);
    } catch {
      Alert.alert("Cannot call", "Could not start a call right now. Try again later.");
    } finally {
      setCallingVenue(false);
    }
  }

  function pickAndSendDocument() {
    const rid = hub?.restaurant?.id ?? restaurantId.trim();
    if (!rid || pickingImage) return;
    void (async () => {
      const picked = await pickChatDocument();
      if (!picked) return;
      void uploadChatDocument(picked);
    })();
  }

  async function uploadChatDocument(doc: PreparedChatDocument) {
    const rid = hub?.restaurant?.id ?? restaurantId.trim();
    if (!rid) return;
    setPickingImage(true);
    const res = await postCustomerChatDocument(token, {
      restaurantId: rid,
      orderId: hub?.activeOrder?.id,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      dataBase64: doc.dataBase64
    });
    setPickingImage(false);
    if (!res.ok) {
      Alert.alert(
        "Document not sent",
        typeof res.error === "string" ? res.error : "Could not send document."
      );
      return;
    }
    void playCartAddCue();
    if (res.message) {
      setFeed((prev) => {
        if (prev.some((x) => x.kind === "message" && x.id === res.message!.id)) return prev;
        const added: ThreadFeedItem = {
          ...res.message!,
          kind: "message",
          isMine: true,
          deliveryStatus: res.message!.deliveryStatus ?? "sent"
        };
        return [...prev, added];
      });
    }
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }

  function handleAttachChoice(choice: UnityAttachChoice) {
    const timer = setTimeout(() => {
      if (choice === "camera") {
        setCameraOpen(true);
        return;
      }
      if (choice === "photos" || choice === "video") {
        pickAndSendImages();
        return;
      }
      if (choice === "file") {
        pickAndSendDocument();
      }
    }, 280);
    // Fire-and-forget delay so the UNITY attach modal can finish dismissing.
    void timer;
  }

  function handleCallVenue() {
    setVenueCallOpen(true);
  }

  async function sendMessage(contentOverride?: string) {
    const rid = hub?.restaurant?.id ?? restaurantId.trim();
    const content = (contentOverride ?? draft).trim();
    if (!rid || !content) return;
    const roomId = roomIdRef.current;
    if (roomId) sendChatTyping(roomId, false);

    const optimistic = createOptimisticMessage(content, roomId ?? "", userId);
    const optimisticId = optimistic.id;

    setDraft("");
    setFeed((prev) => [...prev, optimistic]);
    void playCartAddCue();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 40);

    const res = await postCustomerChatMessage(token, {
      restaurantId: rid,
      content,
      orderId: hub?.activeOrder?.id
    });

    if (!res.ok) {
      setFeed((prev) => prev.filter((x) => x.id !== optimisticId));
      setDraft(content);
      Alert.alert("Message not sent", typeof res.error === "string" ? res.error : "Try again.");
      return;
    }

    if (res.message) {
      setFeed((prev) => reconcileSentMessage(prev, res.message!, optimisticId));
    }
  }

  const needsVenue = !hasVenueSelected || hub?.needsVenue === true;
  const needsMenu = hasVenueSelected && !hasBrowsableMenu;

  const oclTimeline =
    hub?.scene === "active_order" && (hub.timeline?.length ?? 0) > 0 ? (
      <OclTimelineStrip rows={hub.timeline ?? []} />
    ) : null;

  const listFooter = venueTyping ? <TypingIndicator /> : null;

  const showVenueCall = Boolean(hub?.ok && !needsVenue);
  const threadVenueName = hub?.restaurant?.name?.trim() || venueDisplayName.trim() || "Venue";
  const subtitle = showVenueCall
    ? hub?.restaurantOnline
      ? "Online · Venue chat"
      : "Offline · Venue chat"
    : undefined;

  const shellHeader = (title: string, sub?: string) => (
    <View style={[styles.shellHeader, { top: insets.top + unitySpacing.xs }]} pointerEvents="box-none">
      <GlassChip style={styles.shellChip}>
        <Pressable
          style={styles.shellChipBtn}
          onPress={() => {
            hapticSelection();
            onBack();
          }}
          hitSlop={8}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={unityColors.brand} />
        </Pressable>
      </GlassChip>
      <GlassChip style={styles.shellTitleChip}>
        <Text style={styles.shellTitle} numberOfLines={1}>
          {title}
        </Text>
        {sub ? (
          <Text style={styles.shellSubtitle} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </GlassChip>
      <View style={styles.shellChipPlaceholder} />
    </View>
  );

  const sharedModals = (
    <>
      <ChatCameraCapture
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onSend={(uri) => {
          setCameraOpen(false);
          sendCapturedImage(uri);
        }}
      />
      <ChatVenueCallModal
        visible={venueCallOpen}
        venueName={threadVenueName}
        calling={callingVenue}
        onClose={() => {
          if (callingVenue) return;
          setVenueCallOpen(false);
        }}
        onCall={() => void confirmVenueCall()}
      />
      <ChatVenueInfoModal
        visible={venueInfoOpen}
        onClose={() => setVenueInfoOpen(false)}
        venueName={hub?.restaurant?.name ?? "Restaurant"}
        openingHours={hub?.restaurant?.openingHours}
        onAddItems={() => runQuickAction("view_menu")}
        initialPanel={venueInfoPanel}
      />
    </>
  );

  if (!needsVenue && !needsMenu && !loading && hub?.ok && !loadErr) {
    return (
      <View style={styles.unityRoot}>
        <UnityChatScreen
          title={threadVenueName}
          subtitle={subtitle}
          messages={listRows}
          onSend={(text) => void sendMessage(text)}
          onBack={onBack}
          isGroupChat={false}
          listHeader={oclTimeline}
          listFooter={listFooter}
          emptyText="No messages yet — ask about your order, ingredients, or pickup."
          disabledComposer={pickingImage}
          onAttachChoice={handleAttachChoice}
          onComposerDraftChange={onDraftChange}
          rightActions={
            showVenueCall
              ? [
                  {
                    icon: "call-outline",
                    accessibilityLabel: `Call ${threadVenueName}`,
                    onPress: handleCallVenue
                  },
                  {
                    icon: "information-circle-outline",
                    accessibilityLabel: "Venue info",
                    onPress: () => {
                      setVenueInfoPanel("menu");
                      setVenueInfoOpen(true);
                    }
                  }
                ]
              : []
          }
          overlay={
            <>
              {revalidating ? (
                <View style={[styles.syncDotRow, { top: insets.top + 56 }]} pointerEvents="none">
                  <SkeletonSyncDot size={7} />
                </View>
              ) : null}
              {sharedModals}
            </>
          }
        />
      </View>
    );
  }

  return (
    <View style={styles.unityRoot}>
      <StatusBar barStyle="dark-content" backgroundColor={CHAT_BACKGROUND} />
      {shellHeader(threadVenueName, subtitle)}

      {loading && !hub?.ok && !needsVenue && !needsMenu ? (
        <View style={[styles.threadColumn, { paddingTop: insets.top + 60 }]}>
          <SkeletonChatThread count={7} style={{ flex: 1 }} />
        </View>
      ) : null}

      {loadErr && !loading && hasVenueSelected && !needsVenue && !needsMenu ? (
        <ScreenErrorState
          style={{ flex: 1, marginTop: insets.top + 60 }}
          title="Could not connect"
          message={loadErr}
          onRetry={() => void loadHub({ force: true })}
        />
      ) : null}

      {needsVenue && !loadErr && !needsMenu ? (
        <View
          style={[
            styles.noVenueColumn,
            { paddingTop: insets.top + 60, paddingBottom: Math.max(insets.bottom, 8) }
          ]}
        >
          <View style={styles.noVenueCenter}>
            <ChatVenueTypeRotator />
            <Text style={styles.noVenueSub}>Choose a venue to proceed</Text>
          </View>
        </View>
      ) : null}

      {needsMenu && !loadErr ? (
        <View
          style={[
            styles.noVenueColumn,
            { paddingTop: insets.top + 60, paddingBottom: Math.max(insets.bottom, 8) }
          ]}
        >
          <View style={styles.noVenueCenter}>
            <Text style={styles.noMenuHeadline}>{noMenuAtVenueMessage(venueDisplayName)}</Text>
            <Text style={styles.noVenueSub}>
              Switch venue to message a location with a published menu and ordering.
            </Text>
            {onSwitchVenue ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Switch venue"
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onSwitchVenue();
                }}
                style={({ pressed }) => [styles.switchVenueBtn, pressed && styles.pressed]}
              >
                <Text style={styles.switchVenueBtnText}>Switch venue</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {sharedModals}
    </View>
  );
}

const styles = StyleSheet.create({
  unityRoot: { flex: 1, backgroundColor: CHAT_BACKGROUND },
  threadColumn: { flex: 1, minHeight: 0 },
  syncDotRow: { position: "absolute", right: 16, zIndex: 40 },
  shellHeader: {
    position: "absolute",
    left: unitySpacing.sm,
    right: unitySpacing.sm,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    zIndex: 30,
    gap: unitySpacing.xs
  },
  shellChip: { borderRadius: 999 },
  shellChipBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center"
  },
  shellTitleChip: {
    flex: 1,
    borderRadius: 18,
    paddingHorizontal: unitySpacing.md,
    paddingVertical: 6,
    alignItems: "center",
    maxWidth: "70%"
  },
  shellTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111B21",
    letterSpacing: -0.2,
    textAlign: "center"
  },
  shellSubtitle: {
    fontSize: 10,
    fontWeight: "600",
    color: "#667781",
    marginTop: 1,
    textAlign: "center"
  },
  shellChipPlaceholder: { width: 36, height: 36 },
  noVenueColumn: { flex: 1, minHeight: 0 },
  noVenueCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 24
  },
  noVenueSub: {
    marginTop: 6,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    color: "#667781"
  },
  noMenuHeadline: {
    textAlign: "center",
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "900",
    color: "#142B2C",
    letterSpacing: 0.2
  },
  switchVenueBtn: {
    marginTop: 8,
    minWidth: 228,
    paddingVertical: 15,
    paddingHorizontal: 28,
    borderRadius: 999,
    backgroundColor: unityColors.brand,
    alignItems: "center"
  },
  switchVenueBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2
  },
  pressed: { opacity: 0.88 }
});
