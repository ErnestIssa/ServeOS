import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { R } from "../../theme";
import { CHAT } from "./chatTheme";
import type { CustomerChatHubResponse } from "../customerChatApi";

type Props = {
  hub: CustomerChatHubResponse;
  venueTyping: boolean;
  money: (cents: number) => string;
  onQuickAction: (id: string) => void;
};

export function ChatThreadHeader({ hub, venueTyping, money, onQuickAction }: Props) {
  const copy = hub.copy;
  const order = hub.activeOrder;

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        {order ? (
          <>
            <Text style={styles.orderTitle}>
              Order #{order.shortLabel} · {order.statusLabel} {order.statusEmoji}
            </Text>
            {order.estimatedMinutes != null ? (
              <Text style={styles.eta}>Estimated time: {order.estimatedMinutes} min</Text>
            ) : null}
            <Text style={styles.meta}>
              {hub.restaurant?.name ?? "Venue"} · {money(order.totalCents)}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.headline}>{copy?.headline}</Text>
            <Text style={styles.sub}>{copy?.subheadline}</Text>
            {hub.restaurant?.name ? <Text style={styles.venue}>{hub.restaurant.name}</Text> : null}
          </>
        )}
        {venueTyping ? (
          <Text style={styles.typing}>Restaurant is typing…</Text>
        ) : null}
      </View>

      {hub.scene === "cart" && hub.cart && hub.cart.lineCount > 0 ? (
        <View style={[styles.card, styles.cartCard]}>
          <Text style={styles.cartLabel}>Cart · {hub.cart.totalQuantity} items</Text>
          {hub.cart.lines.slice(0, 3).map((l) => (
            <Text key={l.id} style={styles.cartLine} numberOfLines={1}>
              ×{l.quantity} {l.name}
            </Text>
          ))}
          <Text style={styles.cartTotal}>{money(hub.cart.subtotalCents)} subtotal</Text>
        </View>
      ) : null}

      {(hub.quickActions?.length ?? 0) > 0 ? (
        <View style={styles.chips}>
          {hub.quickActions!.slice(0, 4).map((a) => (
            <Pressable
              key={a.id}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
              onPress={() => onQuickAction(a.id)}
            >
              <Text style={styles.chipText}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: R.space.sm, paddingBottom: 8, gap: 8 },
  card: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: R.radius.card,
    borderWidth: 1,
    borderColor: R.border,
    padding: R.space.sm
  },
  cartCard: { borderColor: "rgba(124, 58, 237, 0.2)" },
  orderTitle: { fontSize: 17, fontWeight: "800", color: R.text },
  eta: { marginTop: 6, fontSize: 14, fontWeight: "700", color: "#15803D" },
  meta: { marginTop: 4, fontSize: 13, color: R.textMuted, fontWeight: "600" },
  headline: { fontSize: 18, fontWeight: "800", color: R.text },
  sub: { marginTop: 6, fontSize: 15, lineHeight: 21, color: R.textSecondary, fontWeight: "500" },
  venue: { marginTop: 8, fontSize: 12, fontWeight: "700", color: CHAT.brand },
  typing: { marginTop: 8, fontSize: 13, fontWeight: "700", color: CHAT.brand },
  cartLabel: { fontSize: 11, fontWeight: "800", color: R.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
  cartLine: { marginTop: 6, fontSize: 14, fontWeight: "600", color: R.text },
  cartTotal: { marginTop: 8, fontSize: 15, fontWeight: "800", color: R.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: R.radius.pill,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: R.border
  },
  chipText: { fontSize: 12, fontWeight: "700", color: CHAT.brand },
  pressed: { opacity: 0.88 }
});
