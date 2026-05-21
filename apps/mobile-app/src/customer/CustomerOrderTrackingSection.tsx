import * as Haptics from "expo-haptics";
import React from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { R } from "../theme";
import { menuImageSourceForKey } from "../menu/menuCardAssets";
import { OrderLiveStatusView } from "./OrderLiveStatusView";

export type CustomerMineOrderLine = {
  menuItemId?: string;
  name: string;
  quantity: number;
  lineTotalCents: number;
};

export type CustomerMineOrder = {
  id: string;
  restaurant?: { id: string; name: string } | null;
  status: string;
  totalCents: number;
  createdAt?: string;
  updatedAt?: string;
  note?: string | null;
  lines?: CustomerMineOrderLine[];
};

const ACTIVE_STATUSES = new Set(["PENDING", "CONFIRMED", "PREPARING", "READY"]);

function isActiveStatus(status: string): boolean {
  return ACTIVE_STATUSES.has(status);
}

function milestoneIndex(status: string): number {
  switch (status) {
    case "PENDING":
    case "CONFIRMED":
      return 0;
    case "PREPARING":
      return 1;
    case "READY":
      return 2;
    default:
      return 0;
  }
}

export function pickActiveOrder(orders: CustomerMineOrder[], venueId: string): CustomerMineOrder | null {
  const active = orders.filter((o) => isActiveStatus(o.status));
  if (!active.length) return null;
  const vid = venueId.trim();
  if (vid) {
    const atVenue = active.find((o) => o.restaurant?.id && String(o.restaurant.id).trim() === vid);
    if (atVenue) return atVenue;
  }
  return active[0] ?? null;
}

function activityLines(order: CustomerMineOrder): string[] {
  const venue = order.restaurant?.name?.trim() || "the restaurant";
  const lines: string[] = [];
  switch (order.status) {
    case "PENDING":
      lines.push("Order sent to the kitchen");
      lines.push(`Preparing at ${venue}`);
      break;
    case "CONFIRMED":
      lines.push("Kitchen accepted your order");
      lines.push("Cooking will start shortly");
      break;
    case "PREPARING":
      lines.push("Kitchen is working on your items");
      lines.push("We will notify you when it is ready");
      break;
    case "READY":
      lines.push("Your order is bagged and waiting");
      lines.push("Head to the pickup area");
      break;
    default:
      lines.push("Thanks for ordering with ServeOS");
  }
  return lines;
}

function heroDishSource(order: CustomerMineOrder) {
  const first = (order.lines ?? [])[0];
  const id = first?.menuItemId?.trim();
  const key = id && id.length > 0 ? id : `${order.id}:${first?.name ?? "line"}`;
  return menuImageSourceForKey(key);
}

function shortOrderLabel(id: string): string {
  const t = id.replace(/\s/g, "");
  if (t.length <= 6) return t.toUpperCase();
  return t.slice(-6).toUpperCase();
}

type Props = {
  orders: CustomerMineOrder[];
  activeVenueId: string;
  money: (cents: number) => string;
  onBrowseMenu: () => void;
  onNeedHelp: () => void;
};

function OrderDetailsSheet(props: {
  visible: boolean;
  onClose: () => void;
  order: CustomerMineOrder;
  money: (cents: number) => string;
}) {
  const { visible, onClose, order, money } = props;
  const { height } = useWindowDimensions();
  const maxH = Math.min(height * 0.72, 520);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} accessibilityLabel="Close order details" />
      <View style={[styles.sheetCard, { maxHeight: maxH }]}>
        <View style={styles.sheetGrab} />
        <Text style={styles.sheetTitle}>Order #{shortOrderLabel(order.id)}</Text>
        <Text style={styles.sheetVenue}>{order.restaurant?.name ?? "Venue"}</Text>
        <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
          {(order.lines ?? []).map((line, i) => (
            <View key={`${line.name}-${i}`} style={styles.sheetLineRow}>
              <View style={styles.sheetLineLeft}>
                <Text style={styles.sheetLineQty}>×{line.quantity}</Text>
                <Text style={styles.sheetLineName} numberOfLines={3}>
                  {line.name}
                </Text>
              </View>
              <Text style={styles.sheetLinePrice}>{money(line.lineTotalCents)}</Text>
            </View>
          ))}
          {order.note?.trim() ? (
            <View style={styles.sheetNoteBlock}>
              <Text style={styles.sheetNoteLabel}>Note</Text>
              <Text style={styles.sheetNoteBody}>{order.note.trim()}</Text>
            </View>
          ) : null}
          <View style={styles.sheetTotalRow}>
            <Text style={styles.sheetTotalLabel}>Total</Text>
            <Text style={styles.sheetTotalValue}>{money(order.totalCents)}</Text>
          </View>
        </ScrollView>
        <Pressable
          style={({ pressed }) => [styles.sheetDoneBtn, pressed && styles.pressed]}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onClose();
          }}
        >
          <Text style={styles.sheetDoneText}>Done</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

export function CustomerOrderTrackingSection(props: Props) {
  const { orders, activeVenueId, money, onBrowseMenu, onNeedHelp } = props;
  const { width: winW, height: winH } = useWindowDimensions();
  const order = React.useMemo(() => pickActiveOrder(orders, activeVenueId), [orders, activeVenueId]);
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  const heroStripHeight = React.useMemo(
    () => Math.round(Math.min(Math.max(winH * 0.44, 300), 480, winW * 0.98)),
    [winH, winW]
  );

  const milestone = order ? milestoneIndex(order.status) : 0;
  if (!order) {
    return null;
  }

  const bullets = activityLines(order);
  const activeOrder = order;
  const thumbSize = Math.max(44, Math.round(heroStripHeight / 6));

  function contextualPrimary() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (activeOrder.status === "READY") {
      Alert.alert(
        "Pickup",
        "Show your order number at the counter. If the venue uses a pickup shelf, look for the label with your name or order code.",
        [{ text: "OK" }]
      );
      return;
    }
    if (activeOrder.status === "PREPARING" || activeOrder.status === "CONFIRMED" || activeOrder.status === "PENDING") {
      onNeedHelp();
    }
  }

  const ctaLabel = activeOrder.status === "READY" ? "View pickup instructions" : "Need help?";

  return (
    <View style={styles.block}>
      <View style={[styles.heroStrip, { height: heroStripHeight }]}>
        <OrderLiveStatusView
          milestone={milestone}
          status={activeOrder.status}
          venueName={activeOrder.restaurant?.name}
          createdAt={activeOrder.createdAt}
          updatedAt={activeOrder.updatedAt}
          variant="hero"
        />
      </View>

      <View style={[styles.section, styles.thumbRow]}>
        <Image
          source={heroDishSource(order)}
          style={[styles.thumbImage, { width: thumbSize, height: thumbSize, borderRadius: Math.round(thumbSize / 4) }]}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
        <View style={styles.thumbMeta}>
          <Text style={styles.thumbMetaTitle}>Order #{shortOrderLabel(order.id)}</Text>
          <Text style={styles.thumbMetaSub} numberOfLines={1}>
            {order.restaurant?.name ?? "Venue"}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Live updates</Text>
        {bullets.map((t) => (
          <View key={t} style={styles.bulletRow}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>{t}</Text>
          </View>
        ))}
      </View>

      <Pressable
        style={({ pressed }) => [styles.expandPlain, pressed && styles.pressed]}
        onPress={() => {
          void Haptics.selectionAsync();
          setDetailsOpen(true);
        }}
      >
        <Text style={styles.expandLabel}>View order details</Text>
        <Text style={styles.expandChevron}>▼</Text>
      </Pressable>

      <Pressable style={({ pressed }) => [styles.secondaryCta, pressed && styles.pressed]} onPress={contextualPrimary}>
        <Text style={styles.secondaryCtaText}>{ctaLabel}</Text>
      </Pressable>

      <OrderDetailsSheet visible={detailsOpen} onClose={() => setDetailsOpen(false)} order={order} money={money} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: 6, width: "100%", paddingHorizontal: 10, paddingBottom: 12, backgroundColor: "transparent" },
  heroStrip: {
    alignSelf: "stretch",
    marginHorizontal: -10,
    marginTop: 16,
    marginBottom: 0,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "transparent",
    justifyContent: "center"
  },
  section: {
    marginTop: 22,
    paddingHorizontal: 2
  },
  thumbRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  thumbImage: { backgroundColor: "transparent", borderWidth: 1, borderColor: R.border },
  thumbMeta: { flex: 1, minHeight: 40, justifyContent: "center" },
  thumbMetaTitle: { fontSize: 15, fontWeight: "800", color: R.text, letterSpacing: -0.2 },
  thumbMetaSub: { marginTop: 3, fontSize: 13, fontWeight: "700", color: R.textMuted },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: R.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 12
  },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  bulletDot: { width: 18, fontSize: 16, color: R.accentPurple, fontWeight: "800", marginTop: -1 },
  bulletText: { flex: 1, fontSize: 15, lineHeight: 22, color: R.textSecondary, fontWeight: "600" },
  expandPlain: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10
  },
  expandLabel: { fontSize: 16, fontWeight: "700", color: R.accentBlue },
  expandChevron: { marginLeft: 6, fontSize: 14, color: R.accentBlue, fontWeight: "800" },
  secondaryCta: {
    marginTop: 14,
    alignSelf: "stretch",
    paddingVertical: 16,
    borderRadius: R.radius.tile,
    backgroundColor: R.text,
    alignItems: "center"
  },
  secondaryCtaText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  pressed: { opacity: 0.9 },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,6,23,0.5)"
  },
  sheetCard: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 24,
    borderRadius: 22,
    backgroundColor: R.bg,
    borderWidth: 1,
    borderColor: R.border,
    paddingBottom: 16,
    paddingHorizontal: 18,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12
  },
  sheetGrab: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: R.borderStrong,
    marginTop: 10,
    marginBottom: 12
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: R.text, textAlign: "center" },
  sheetVenue: { fontSize: 14, fontWeight: "600", color: R.textMuted, textAlign: "center", marginTop: 4 },
  sheetScroll: { marginTop: 16, maxHeight: 360 },
  sheetLineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: R.border
  },
  sheetLineLeft: { flex: 1, flexDirection: "row", alignItems: "flex-start", paddingRight: 12 },
  sheetLineQty: { fontSize: 14, fontWeight: "800", color: R.textMuted, minWidth: 28, marginRight: 8 },
  sheetLineName: { flex: 1, fontSize: 15, fontWeight: "600", color: R.text },
  sheetLinePrice: { fontSize: 15, fontWeight: "700", color: R.text },
  sheetNoteBlock: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: R.bgSubtle
  },
  sheetNoteLabel: { fontSize: 11, fontWeight: "800", color: R.textMuted, textTransform: "uppercase" },
  sheetNoteBody: { marginTop: 6, fontSize: 15, lineHeight: 22, color: R.textSecondary, fontWeight: "600" },
  sheetTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: R.border
  },
  sheetTotalLabel: { fontSize: 16, fontWeight: "800", color: R.text },
  sheetTotalValue: { fontSize: 17, fontWeight: "800", color: R.text },
  sheetDoneBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: R.bgSubtle,
    alignItems: "center"
  },
  sheetDoneText: { fontSize: 16, fontWeight: "700", color: R.text }
});
