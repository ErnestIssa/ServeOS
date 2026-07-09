import * as Haptics from "expo-haptics";
import React from "react";
import {
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
import { FLOAT_MARGIN_SIDE } from "../shell/navBottomMetrics";
import { R } from "../theme";
import {
  mergeThreadFeed,
  readChatSnapshot,
  refreshChatHubSilent,
  writeChatSnapshot
} from "../data/customerDataCache";
import {
  fetchCustomerChatHub,
  postCustomerChatDocument,
  postCustomerChatImages,
  postCustomerChatMessage,
  type CustomerChatHubResponse,
  type CustomerChatQuickActionId,
  type ThreadFeedItem
} from "./customerChatApi";
import { MessageComposer } from "./chat/composer/MessageComposer";
import { ChatMessage, DateSeparator } from "./chat/messages/ChatMessage";
import { buildListRows, sameMessageGroup } from "./chat/messages/mapFeedItem";
import { isChatMessage, isDateSeparator, type ChatMessageViewModel, type ListRow } from "./chat/messages/types";
import { TypingIndicator } from "./chat/messages/TypingIndicator";
import { MessageActionMenu } from "./chat/menu/MessageActionMenu";
import { ChatVenueInfoModal } from "./chat/ChatVenueInfoModal";
import { ChatThreadNavBar, chatThreadListTopInset } from "./chat/ChatThreadNavBar";
import { AttachmentMenu, ATTACH_MENU_DISMISS_MS, type AttachmentChoice } from "./chat/composer/AttachmentMenu";
import { playCartAddCue } from "./cartCueSound";
import { ChatCameraCapture } from "./chat/ChatCameraCapture";
import { pickChatImagesFromLibrary, prepareChatImageFromUri, type PreparedChatImage } from "./chat/chatImageAttach";
import { pickChatDocument, type PreparedChatDocument } from "./chat/chatDocumentAttach";
import { OclTimelineStrip } from "./chat/OclTimelineStrip";
import { isIncomingMessage, isMessageUnread } from "./chat/chatUnreadHelpers";
import { joinChatRoom, sendChatRead, sendChatTyping, subscribeChatRelay } from "./chat/customerChatSocket";
import { ChatVenueTypeRotator } from "./chat/ChatVenueTypeRotator";
import { ScreenErrorState } from "../errors";
import { SkeletonChatThread, SkeletonSyncDot } from "../components/skeleton/SkeletonUi";
import { loadProfileAvatarUri } from "./profile/profileAvatarStorage";
import { noMenuAtVenueMessage } from "./venueContentHelpers";

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
    money,
    scrollY,
    onScroll,
    onScrollEndDrag,
    onMomentumScrollEnd,
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
  const [venueInfoPanel, setVenueInfoPanel] = React.useState<"menu" | "call_staff" | "opening_hours">("menu");
  const [attachOpen, setAttachOpen] = React.useState(false);
  const [cameraOpen, setCameraOpen] = React.useState(false);
  const pendingAttachRef = React.useRef<AttachmentChoice | null>(null);
  const [menuMessage, setMenuMessage] = React.useState<ChatMessageViewModel | null>(null);
  const inputRef = React.useRef<TextInput>(null);
  const listRef = React.useRef<FlatList<ListRow>>(null);
  const typingStopRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingClearRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmitRef = React.useRef(0);
  const roomIdRef = React.useRef<string | null>(null);
  const customerLastReadAtRef = React.useRef<string | null>(null);
  const dismissedNewRef = React.useRef<Set<string>>(new Set());
  const newDismissTimersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [newDismissTick, setNewDismissTick] = React.useState(0);
  const [customerAvatarUri, setCustomerAvatarUri] = React.useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const loadGenRef = React.useRef(0);

  const hasVenueSelected = Boolean(restaurantId.trim());

  const venueInitial = React.useMemo(() => {
    const name = hub?.restaurant?.name?.trim() || venueDisplayName.trim() || "R";
    return name.charAt(0).toUpperCase();
  }, [hub?.restaurant?.name, venueDisplayName]);

  const customerInitial = React.useMemo(() => "U", []);

  React.useEffect(() => {
    let cancelled = false;
    void loadProfileAvatarUri().then((uri) => {
      if (!cancelled) setCustomerAvatarUri(uri);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const listRows = React.useMemo(() => buildListRows(feed), [feed]);

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
        const row = v.item as ListRow | undefined;
        if (!row || !isChatMessage(row)) continue;
        const item = row.raw;
        if (!isMessageUnread(item, readAt)) continue;
        scheduleNewDismiss(item.id);
      }
    },
    [chatFocused, scheduleNewDismiss]
  );

  const viewabilityConfig = React.useRef({ itemVisiblePercentThreshold: 55 }).current;

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

  function openVenueInfo(panel: "menu" | "call_staff" | "opening_hours") {
    setVenueInfoPanel(panel);
    setVenueInfoOpen(true);
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

  function handleAttachChoice(choice: AttachmentChoice) {
    pendingAttachRef.current = choice;
  }

  React.useEffect(() => {
    if (attachOpen) return;
    const choice = pendingAttachRef.current;
    if (!choice) return;
    pendingAttachRef.current = null;
    const timer = setTimeout(() => {
      if (choice === "camera") {
        setCameraOpen(true);
        return;
      }
      if (choice === "photos") {
        pickAndSendImages();
        return;
      }
      if (choice === "document") {
        pickAndSendDocument();
      }
    }, ATTACH_MENU_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [attachOpen]);

  function handleCallVenue() {
    openVenueInfo("call_staff");
  }

  async function sendMessage() {
    const rid = hub?.restaurant?.id ?? restaurantId.trim();
    const content = draft.trim();
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
      inputRef.current?.focus();
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

  /** Immersive chat — sticky thread nav below safe area. */
  const listTopInset = chatThreadListTopInset(insets.top);
  const chatScrollBottom = Math.max(insets.bottom, 8) + 16;
  const composerBottomPad = Math.max(2, insets.bottom);
  const showVenueCall = Boolean(hub?.ok && !needsVenue);
  const showVenueStatus = showVenueCall;
  const threadVenueName = hub?.restaurant?.name?.trim() || venueDisplayName.trim() || "Venue";

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <ChatThreadNavBar
        safeAreaTop={insets.top}
        venueName={threadVenueName}
        showStatus={showVenueStatus}
        restaurantOnline={hub?.restaurantOnline ?? false}
        onBack={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onBack();
        }}
        onCallPress={
          showVenueCall
            ? () => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                handleCallVenue();
              }
            : undefined
        }
      />

      <MessageActionMenu
        visible={!!menuMessage}
        message={menuMessage}
        onClose={() => setMenuMessage(null)}
        onCopy={
          menuMessage?.content
            ? () => Alert.alert("Copied", "Message copied to clipboard.")
            : undefined
        }
        onReply={() => Alert.alert("Reply", "Reply threading is coming soon.")}
        onDelete={() => Alert.alert("Delete", "Delete is not available yet.")}
      />

      <AttachmentMenu
        visible={attachOpen}
        onClose={() => setAttachOpen(false)}
        onChoose={handleAttachChoice}
      />

      <ChatCameraCapture
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onSend={(uri) => {
          setCameraOpen(false);
          sendCapturedImage(uri);
        }}
      />

      <ChatVenueInfoModal
        visible={venueInfoOpen}
        onClose={() => setVenueInfoOpen(false)}
        venueName={hub?.restaurant?.name ?? "Restaurant"}
        openingHours={hub?.restaurant?.openingHours}
        onAddItems={() => runQuickAction("view_menu")}
        initialPanel={venueInfoPanel}
      />

      {loading && !hub?.ok && !needsVenue && !needsMenu ? (
        <View style={[styles.threadColumn, { paddingTop: listTopInset }]}>
          <SkeletonChatThread count={7} style={{ flex: 1 }} />
          <View style={[styles.composerDock, { paddingBottom: composerBottomPad, opacity: 0.55 }]}>
            <MessageComposer
              value=""
              onChange={() => {}}
              onSend={() => {}}
              onOpenAttach={() => {}}
              pickingImage={false}
              inputRef={inputRef}
            />
          </View>
        </View>
      ) : null}
      {revalidating && hub?.ok ? (
        <View style={[styles.syncDotRow, { top: listTopInset - 28 }]} pointerEvents="none">
          <SkeletonSyncDot size={7} />
        </View>
      ) : null}

      {loadErr && !loading && hasVenueSelected && !needsVenue && !needsMenu ? (
        <ScreenErrorState
          style={{ flex: 1, marginTop: listTopInset }}
          title="Could not connect"
          message={loadErr}
          onRetry={() => void loadHub({ force: true })}
        />
      ) : null}

      {needsVenue && !loadErr && !needsMenu ? (
        <View style={[styles.noVenueColumn, { paddingTop: listTopInset, paddingBottom: chatScrollBottom }]}>
          <View style={styles.noVenueCenter}>
            <ChatVenueTypeRotator />
            <Text style={styles.noVenueSub}>Choose a venue to proceed</Text>
          </View>
        </View>
      ) : null}

      {needsMenu && !loadErr ? (
        <View style={[styles.noVenueColumn, { paddingTop: listTopInset, paddingBottom: chatScrollBottom }]}>
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

      {!needsVenue && !needsMenu && !loading && hub?.ok && !loadErr ? (
        <View style={styles.threadColumn}>
          <Animated.FlatList
            ref={listRef as React.RefObject<FlatList<ListRow>>}
            data={listRows}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={[styles.listContent, { paddingTop: listTopInset }]}
            onScroll={onScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="never"
            keyboardDismissMode="on-drag"
            ListHeaderComponent={oclTimeline}
            ListFooterComponent={listFooter}
            onScrollBeginDrag={dismissKeyboard}
            onScrollEndDrag={onScrollEndDrag}
            onMomentumScrollEnd={onMomentumScrollEnd}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            initialNumToRender={14}
            maxToRenderPerBatch={12}
            windowSize={9}
            removeClippedSubviews={Platform.OS === "android"}
            renderItem={({ item, index }) => {
              if (isDateSeparator(item)) {
                return <DateSeparator label={item.label} />;
              }
              const prev = listRows[index - 1];
              const next = listRows[index + 1];
              void newDismissTick;
              const readAt = customerLastReadAtRef.current;
              const raw = item.raw;
              const itemUnread =
                raw.kind === "message" && isMessageUnread(raw, readAt) && !dismissedNewRef.current.has(item.id);
              const prevUnreadIncoming =
                prev &&
                isChatMessage(prev) &&
                isIncomingMessage(prev.raw) &&
                isMessageUnread(prev.raw, readAt) &&
                !dismissedNewRef.current.has(prev.id);
              const incomingUnread = itemUnread && isIncomingMessage(raw);
              const showNew = incomingUnread && !prevUnreadIncoming;
              const groupWithPrev = sameMessageGroup(item, prev);
              const groupWithNext = sameMessageGroup(item, next);
              return (
                <ChatMessage
                  message={item}
                  groupWithPrev={groupWithPrev}
                  groupWithNext={groupWithNext}
                  showAvatar={!groupWithNext}
                  showNewLabel={showNew}
                  timeUnread={incomingUnread}
                  authorAvatarUri={item.mine ? customerAvatarUri : null}
                  authorInitial={item.mine ? customerInitial : venueInitial}
                  onLongPress={setMenuMessage}
                />
              );
            }}
            ListEmptyComponent={
              <Pressable style={styles.emptyHint} onPress={dismissKeyboard}>
                <Text style={styles.emptyText}>
                  No messages yet — ask about your order, ingredients, or pickup.
                </Text>
              </Pressable>
            }
          />

          <View style={[styles.composerDock, { paddingBottom: composerBottomPad }]}>
            <MessageComposer
              value={draft}
              onChange={onDraftChange}
              onSend={() => void sendMessage()}
              onOpenAttach={() => setAttachOpen(true)}
              pickingImage={pickingImage}
              inputRef={inputRef}
            />
          </View>
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
    paddingHorizontal: FLOAT_MARGIN_SIDE,
    backgroundColor: "transparent"
  },
  list: { flex: 1 },
  listContent: { paddingBottom: 8, flexGrow: 1 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 24 },
  syncDotRow: { position: "absolute", right: 16, zIndex: 14 },
  loadingText: { fontSize: R.type.label, color: R.textSecondary, fontWeight: "600" },
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
    color: R.textMuted
  },
  noMenuHeadline: {
    textAlign: "center",
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "900",
    color: R.textSecondary,
    letterSpacing: 0.2
  },
  switchVenueBtn: {
    marginTop: 8,
    minWidth: 228,
    paddingVertical: 15,
    paddingHorizontal: 28,
    borderRadius: R.radius.pill,
    backgroundColor: R.accentPurple,
    alignItems: "center"
  },
  switchVenueBtnText: {
    color: "#FFFFFF",
    fontSize: R.type.body,
    fontWeight: "800",
    letterSpacing: 0.2
  },
  footerPad: { paddingHorizontal: 8, paddingTop: 8 },
  typingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, paddingLeft: 8 },
  typingLabel: { fontSize: 13, fontWeight: "700", color: R.accentPurple },
  emptyHint: { padding: 24, alignItems: "center" },
  emptyText: { textAlign: "center", fontSize: 15, lineHeight: 22, color: R.textSecondary, fontWeight: "600" },
  pressed: { opacity: 0.88 }
});
