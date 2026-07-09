import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { deliveryTickColor } from "./chatTheme";
import { useChatTheme } from "./useChatTheme";

type Status = "sent" | "delivered" | "read";

type Props = {
  status: Status;
};

export function ChatDeliveryTicks({ status }: Props) {
  const { tokens } = useChatTheme();
  const color = deliveryTickColor(tokens, status);
  const isDouble = status === "delivered" || status === "read";

  return (
    <View style={styles.wrap} accessibilityLabel={status === "read" ? "Read" : status === "delivered" ? "Delivered" : "Sent"}>
      <Text style={[styles.tick, { color }]}>✓</Text>
      {isDouble ? <Text style={[styles.tick, styles.tickSecond, { color }]}>✓</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", marginLeft: 2, height: 12 },
  tick: { fontSize: 11, fontWeight: "900", lineHeight: 12, includeFontPadding: false },
  tickSecond: { marginLeft: -5 }
});
