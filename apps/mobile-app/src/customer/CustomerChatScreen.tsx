import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
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
  type CustomerChatQuickActionId
} from "./customerChatApi";

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

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
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
  const [loading, setLoading] = React.useState(true);
  const [loadErr, setLoadErr] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [composerFocusSeed, setComposerFocusSeed] = React.useState(0);
  const inputRef = React.useRef<TextInput>(null);

  const loadHub = React.useCallback(async () => {
    setLoading(true);
    setLoadErr(null);
    const res = await fetchCustomerChatHub(token, restaurantId.trim() || undefined);
    if (!res.ok) {
      setLoadErr(typeof res.error === "string" ? res.error : "Could not load assistance.");
      setHub(null);
      setLoading(false);
      return;
    }
    setHub(res);
    setLoading(false);
  }, [token, restaurantId]);

  React.useEffect(() => {
    void loadHub();
  }, [loadHub, refreshKey]);

  const scene = hub?.scene ?? "new";
  const copy = hub?.copy ?? { headline: "Need help with your order?", subheadline: "Ask the restaurant anything here." };
  const quickActions = hub?.quickActions ?? [];

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
    setComposerFocusSeed((n) => n + 1);
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
    setDraft("");
    Keyboard.dismiss();
    void loadHub();
  }

  const needsVenue = hub?.needsVenue === true;

  return (
    <Animated.ScrollView
      style={styles.scrollLayer}
      onScroll={onScroll}
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={[styles.scrollPad, { paddingTop: scrollTopPad, paddingBottom: scrollBottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Chat</Text>
      <Text style={styles.pageSub}>Live restaurant assistance — not a blank messenger.</Text>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={R.accentPurple} />
          <Text style={styles.loadingText}>Loading assistance…</Text>
        </View>
      ) : null}

      {loadErr ? (
        <View style={[styles.cardShell, styles.surfaceCard]}>
          <Text style={styles.cardHeadline}>Could not connect</Text>
          <Text style={styles.cardBodyMuted}>{loadErr}</Text>
          <Pressable style={({ pressed }) => [styles.pillPrimary, styles.mtSm, pressed && styles.pressed]} onPress={() => void loadHub()}>
            <Text style={styles.pillPrimaryText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && hub?.ok ? (
        <>
          <View style={[styles.cardShell, styles.heroCard]}>
            <Text style={styles.heroHeadline}>{copy.headline}</Text>
            <Text style={styles.heroSub}>{copy.subheadline}</Text>
            {hub.restaurant?.name ? (
              <Text style={styles.venueChip}>{hub.restaurant.name}</Text>
            ) : null}
          </View>

          {needsVenue ? (
            <View style={[styles.cardShell, styles.surfaceCard, styles.mtSm]}>
              <Text style={styles.cardBodyMuted}>Pick your venue in Orders so we can route messages to the right kitchen.</Text>
              <Pressable
                style={({ pressed }) => [styles.pillPrimary, styles.mtSm, pressed && styles.pressed]}
                onPress={onChooseVenue}
              >
                <Text style={styles.pillPrimaryText}>Choose venue</Text>
              </Pressable>
            </View>
          ) : null}

          {scene === "active_order" && hub.activeOrder ? (
            <View style={[styles.cardShell, styles.liveOrderCard, styles.mtSm]}>
              <Text style={styles.liveOrderTitle}>
                Order #{hub.activeOrder.shortLabel} · {hub.activeOrder.statusLabel} {hub.activeOrder.statusEmoji}
              </Text>
              {hub.activeOrder.estimatedMinutes != null ? (
                <Text style={styles.liveOrderEta}>Estimated time: {hub.activeOrder.estimatedMinutes} min</Text>
              ) : null}
              <Text style={styles.liveOrderTotal}>{money(hub.activeOrder.totalCents)} total</Text>
            </View>
          ) : null}

          {scene === "cart" && hub.cart && hub.cart.lineCount > 0 ? (
            <View style={[styles.cardShell, styles.surfaceCard, styles.mtSm]}>
              <Text style={styles.sectionLabelSmall}>Cart summary</Text>
              {hub.cart.lines.slice(0, 4).map((line) => (
                <View key={line.id} style={styles.cartLineRow}>
                  <Text style={styles.cartLineName} numberOfLines={1}>
                    ×{line.quantity} {line.name}
                  </Text>
                  <Text style={styles.cartLinePrice}>{money(line.lineTotalCents)}</Text>
                </View>
              ))}
              {hub.cart.lineCount > 4 ? (
                <Text style={styles.cardBodyMuted}>+{hub.cart.lineCount - 4} more items</Text>
              ) : null}
              <Text style={[styles.cartSubtotal, styles.mtSm]}>{money(hub.cart.subtotalCents)} subtotal</Text>
            </View>
          ) : null}

          {scene === "completed_only" && (hub.recentOrders?.length ?? 0) > 0 ? (
            <View style={[styles.cardShell, styles.surfaceCard, styles.mtSm]}>
              <Text style={styles.sectionLabelSmall}>Recent orders</Text>
              {hub.recentOrders!.map((o) => (
                <View key={o.id} style={styles.recentOrderRow}>
                  <Text style={styles.recentOrderLabel}>#{o.id.slice(-6).toUpperCase()}</Text>
                  <Text style={styles.recentOrderMeta}>
                    {o.status} · {money(o.totalCents)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {(hub.timeline?.length ?? 0) > 0 ? (
            <View style={[styles.cardShell, styles.surfaceCard, styles.mtSm]}>
              <Text style={styles.sectionLabelSmall}>Order timeline</Text>
              {hub.timeline!.map((t) => (
                <View key={t.key} style={styles.timelineRow}>
                  <View style={styles.timelineDot} />
                  <Text style={styles.timelineText}>{t.content}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {(hub.messages?.length ?? 0) > 0 ? (
            <View style={[styles.cardShell, styles.surfaceCard, styles.mtSm]}>
              <Text style={styles.sectionLabelSmall}>Messages</Text>
              {hub.messages!.map((m) => {
                const isCustomer = m.senderRole === "CUSTOMER";
                const isSystem = m.type === "SYSTEM" || m.senderRole === "SYSTEM";
                return (
                  <View
                    key={m.id}
                    style={[
                      styles.msgBubble,
                      isSystem ? styles.msgSystem : isCustomer ? styles.msgCustomer : styles.msgOther
                    ]}
                  >
                    <Text style={[styles.msgText, isSystem && styles.msgTextSystem]}>{m.content}</Text>
                    {!isSystem ? <Text style={styles.msgTime}>{formatMessageTime(m.createdAt)}</Text> : null}
                  </View>
                );
              })}
            </View>
          ) : scene === "active_order" ? (
            <View style={[styles.cardShell, styles.hintCard, styles.mtSm]}>
              <Text style={styles.hintCardText}>Need anything else? Send a message below — the restaurant can reply here.</Text>
            </View>
          ) : null}

          {quickActions.length > 0 ? (
            <View style={styles.quickRow}>
              {quickActions.map((a) => (
                <Pressable
                  key={a.id}
                  style={({ pressed }) => [styles.quickChip, pressed && styles.pressed]}
                  onPress={() => runQuickAction(a.id)}
                >
                  <Text style={styles.quickChipText}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {!needsVenue ? (
            <View style={[styles.cardShell, styles.composerCard, styles.mtSm]}>
              <Text style={styles.composerHint}>{hub.composerHint}</Text>
              <TextInput
                key={composerFocusSeed}
                ref={inputRef}
                value={draft}
                onChangeText={setDraft}
                placeholder="Type your message…"
                placeholderTextColor={R.textMuted}
                style={styles.composerInput}
                multiline
                maxLength={2000}
                editable={!sending}
              />
              <Pressable
                style={({ pressed }) => [
                  styles.pillPrimary,
                  styles.mtSm,
                  pressed && styles.pressed,
                  (!draft.trim() || sending) && styles.disabled
                ]}
                disabled={!draft.trim() || sending}
                onPress={() => void sendMessage()}
              >
                <Text style={styles.pillPrimaryText}>{sending ? "Sending…" : "Send"}</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollLayer: { flex: 1, zIndex: 1 },
  scrollPad: { paddingHorizontal: R.space.sm },
  pageTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: R.text,
    letterSpacing: -0.4
  },
  pageSub: {
    fontSize: R.type.body,
    color: R.textSecondary,
    marginTop: 6,
    lineHeight: 22,
    fontWeight: "500",
    marginBottom: R.space.sm
  },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 24 },
  loadingText: { fontSize: R.type.label, color: R.textSecondary, fontWeight: "600" },
  cardShell: {
    backgroundColor: "rgba(255,255,255,0.84)",
    borderRadius: R.radius.card,
    borderWidth: 1,
    borderColor: R.border,
    padding: R.space.sm
  },
  surfaceCard: {},
  heroCard: {
    borderColor: "rgba(124, 58, 237, 0.22)",
    backgroundColor: "rgba(245, 243, 255, 0.92)"
  },
  heroHeadline: { fontSize: 20, fontWeight: "800", color: R.text, letterSpacing: -0.3 },
  heroSub: { marginTop: 8, fontSize: R.type.body, lineHeight: 22, color: R.textSecondary, fontWeight: "500" },
  venueChip: {
    marginTop: 12,
    alignSelf: "flex-start",
    fontSize: R.type.caption,
    fontWeight: "700",
    color: R.accentPurple,
    backgroundColor: "rgba(139, 92, 246, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: R.radius.pill,
    overflow: "hidden"
  },
  liveOrderCard: { borderColor: "rgba(34, 197, 94, 0.35)", backgroundColor: "rgba(240, 253, 244, 0.95)" },
  liveOrderTitle: { fontSize: 17, fontWeight: "800", color: R.text },
  liveOrderEta: { marginTop: 6, fontSize: R.type.label, fontWeight: "700", color: "#15803D" },
  liveOrderTotal: { marginTop: 4, fontSize: R.type.caption, color: R.textMuted, fontWeight: "600" },
  sectionLabelSmall: {
    fontSize: 11,
    fontWeight: "800",
    color: R.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 10
  },
  cartLineRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 },
  cartLineName: { flex: 1, fontSize: 15, fontWeight: "600", color: R.text },
  cartLinePrice: { fontSize: 14, fontWeight: "700", color: R.textSecondary },
  cartSubtotal: { fontSize: 15, fontWeight: "800", color: R.text },
  recentOrderRow: { marginBottom: 10 },
  recentOrderLabel: { fontSize: 15, fontWeight: "800", color: R.text },
  recentOrderMeta: { marginTop: 2, fontSize: 13, color: R.textMuted, fontWeight: "600" },
  timelineRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10, gap: 10 },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: R.accentPurple,
    marginTop: 7
  },
  timelineText: { flex: 1, fontSize: 15, lineHeight: 22, color: R.textSecondary, fontWeight: "600" },
  msgBubble: { marginBottom: 10, padding: 12, borderRadius: 14, maxWidth: "92%" },
  msgCustomer: { alignSelf: "flex-end", backgroundColor: "rgba(139, 92, 246, 0.14)" },
  msgOther: { alignSelf: "flex-start", backgroundColor: R.bgSubtle },
  msgSystem: { alignSelf: "stretch", backgroundColor: "rgba(59, 130, 246, 0.08)", borderWidth: 1, borderColor: "rgba(59, 130, 246, 0.15)" },
  msgText: { fontSize: 15, lineHeight: 21, color: R.text, fontWeight: "600" },
  msgTextSystem: { color: R.textSecondary, fontWeight: "600" },
  msgTime: { marginTop: 4, fontSize: 11, color: R.textMuted, fontWeight: "600" },
  hintCard: { backgroundColor: "rgba(255,255,255,0.72)" },
  hintCardText: { fontSize: 14, lineHeight: 20, color: R.textSecondary, fontWeight: "600" },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: R.space.sm },
  quickChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: R.radius.pill,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: R.border
  },
  quickChipText: { fontSize: R.type.label, fontWeight: "700", color: R.accentPurple },
  composerCard: {},
  composerHint: { fontSize: R.type.caption, color: R.textMuted, fontWeight: "600", marginBottom: 8 },
  composerInput: {
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: R.border,
    borderRadius: R.radius.input,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: R.text,
    backgroundColor: R.bg
  },
  cardHeadline: { fontSize: 17, fontWeight: "800", color: R.text },
  cardBodyMuted: { marginTop: 6, fontSize: R.type.body, lineHeight: 22, color: R.textSecondary },
  pillPrimary: {
    alignSelf: "stretch",
    backgroundColor: R.accentPurple,
    borderRadius: R.radius.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  pillPrimaryText: { color: "#fff", fontSize: R.type.label, fontWeight: "800" },
  mtSm: { marginTop: R.space.sm },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.45 }
});
