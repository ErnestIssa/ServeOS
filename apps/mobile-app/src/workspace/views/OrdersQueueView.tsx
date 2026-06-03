import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../theme/AppThemeContext";
import { FilterChips } from "../components/FilterChips";
import { OrderCard, type OrderCardData } from "../components/OrderCard";

type Payload = {
  filters: Array<{ id: string; label: string; count: number }>;
  activeFilter: string;
  orders: OrderCardData[];
  canUpdateStatus: boolean;
  modes?: string[];
  activeMode?: string;
  reservations?: Array<{ id: string; confirmationCode: string; startsAt: string; guestEmail: string | null }>;
};

type Props = {
  authToken: string;
  payload: Payload;
  onReload: (opts?: { filter?: string; queueMode?: string }) => void;
  onOpenOrder: (orderId: string) => void;
};

export function OrdersQueueView(props: Props) {
  const { colors: t } = useAppTheme();
  const p = props.payload;

  const advance = async (order: OrderCardData) => {
    if (!order.nextStatus || !props.payload.canUpdateStatus) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    props.onOpenOrder(order.id);
  };

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        section: { marginTop: t.space.md },
        sectionTitle: { fontSize: 13, fontWeight: "800", color: t.textMuted, marginBottom: 8 },
        resCard: {
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: 12,
          padding: 12,
          marginBottom: 8,
          backgroundColor: t.bgElevated
        }
      }),
    [t]
  );

  return (
    <>
      {p.modes?.length ? (
        <FilterChips
          chips={p.modes.map((m) => ({ id: m, label: m === "all" ? "All" : m.charAt(0).toUpperCase() + m.slice(1) }))}
          activeId={p.activeMode ?? "all"}
          onChange={(id) => props.onReload({ filter: p.activeFilter, queueMode: id })}
        />
      ) : null}
      <FilterChips
        chips={p.filters}
        activeId={p.activeFilter}
        onChange={(id) => props.onReload({ filter: id, queueMode: p.activeMode })}
      />
      {p.reservations?.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming reservations</Text>
          {p.reservations.slice(0, 5).map((r) => (
            <View key={r.id} style={styles.resCard}>
              <Text style={{ fontWeight: "800", color: t.text }}>{r.confirmationCode}</Text>
              <Text style={{ color: t.textSecondary, marginTop: 4 }}>
                {new Date(r.startsAt).toLocaleString()} · {r.guestEmail ?? "Guest"}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {p.orders.length === 0 ? (
        <Text style={{ marginTop: 24, textAlign: "center", color: t.textMuted, fontWeight: "600" }}>
          No orders in this queue.
        </Text>
      ) : (
        p.orders.map((o) => (
          <OrderCard
            key={o.id}
            order={o}
            selected={false}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              props.onOpenOrder(o.id);
            }}
            onAdvance={p.canUpdateStatus ? () => void advance(o) : undefined}
          />
        ))
      )}
    </>
  );
}
