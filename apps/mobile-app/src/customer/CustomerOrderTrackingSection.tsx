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
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from "react-native-reanimated";
import { R } from "../theme";
import { menuImageSourceForKey } from "../menu/menuCardAssets";
import { OrderLiveStatusView } from "./OrderLiveStatusView";
import { OclTimelineStrip } from "./chat/OclTimelineStrip";
import { fetchCustomerOrderOcl } from "./customerOclApi";
import { API_URL, apiHttpToWsBase } from "../api";

const SHEET_OPEN_MS = 520;
const SHEET_CLOSE_MS = 420;

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

export function isActiveOrderStatus(status: string): boolean {
  return ACTIVE_STATUSES.has(status);
}

export function countActiveCustomerOrders(orders: CustomerMineOrder[]): number {
  return orders.filter((o) => isActiveOrderStatus(o.status)).length;
}

export function orderStatusMilestone(status: string): number {
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
  const active = orders.filter((o) => isActiveOrderStatus(o.status));
  if (!active.length) return null;
  const vid = venueId.trim();
  if (vid) {
    const atVenue = active.find((o) => o.restaurant?.id && String(o.restaurant.id).trim() === vid);
    if (atVenue) return atVenue;
  }
  return active[0] ?? null;
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
  token: string;
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
  const progress = useSharedValue(0);
  const [mounted, setMounted] = React.useState(visible);

  const finishClose = React.useCallback(() => {
    setMounted(false);
  }, []);

  React.useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withTiming(1, {
        duration: SHEET_OPEN_MS,
        easing: Easing.out(Easing.cubic)
      });
      return;
    }
    if (!mounted) return;
    progress.value = withTiming(
      0,
      { duration: SHEET_CLOSE_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(finishClose)();
      }
    );
  }, [visible, mounted, progress, finishClose]);

  const requestClose = React.useCallback(() => {
    onClose();
  }, [onClose]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.52
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 48 }]
  }));

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={requestClose} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} accessibilityLabel="Close order details">
        <Animated.View style={[styles.sheetBackdrop, backdropStyle]} pointerEvents="none" />
      </Pressable>
      <Animated.View style={[styles.sheetCard, { maxHeight: maxH }, cardStyle]}>
        <View style={styles.sheetGrab} />
        <Text style={styles.sheetTitle}>Order #{shortOrderLabel(order.id)}</Text>
        <Text style={styles.sheetVenue}>{order.restaurant?.name ?? "Venue"}</Text>
        <Image
          source={heroDishSource(order)}
          style={styles.sheetHeroImage}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          accessibilityLabel="Order item"
        />
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
            requestClose();
          }}
        >
          <Text style={styles.sheetDoneText}>Done</Text>
        </Pressable>
      </Animated.View>
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

  const milestone = order ? orderStatusMilestone(order.status) : 0;
  if (!order) {
    return null;
  }

  const activeOrder = order;

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
          key={activeOrder.id}
          milestone={milestone}
          status={activeOrder.status}
          venueName={activeOrder.restaurant?.name}
          createdAt={activeOrder.createdAt}
          updatedAt={activeOrder.updatedAt}
          variant="hero"
        />
      </View>

      {timelineRows.length > 0 ? (
        <View style={{ marginTop: 12 }}>
          <OclTimelineStrip rows={timelineRows} />
        </View>
      ) : null}

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
  sheetHeroImage: {
    width: "100%",
    height: 200,
    borderRadius: 16,
    marginTop: 14,
    backgroundColor: R.bgSubtle,
    borderWidth: 1,
    borderColor: R.border
  },
  expandPlain: {
    marginTop: 22,
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
    backgroundColor: "rgba(2,6,23,0.52)"
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
