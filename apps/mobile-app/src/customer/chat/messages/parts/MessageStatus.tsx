import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { deliveryTickColor, type ChatTokens } from "../../chatTheme";
import type { DeliveryStatus } from "../types";

type Props = {
  status?: DeliveryStatus;
  tokens: ChatTokens;
  light?: boolean;
};

export function MessageStatus({ status = "sent", tokens, light }: Props) {
  if (status === "failed") {
    return <Text style={[styles.failed, { color: tokens.brandDeep }]}>!</Text>;
  }
  if (status === "sending" || status === "uploading") {
    return <Text style={[styles.tick, { color: deliveryTickColor(tokens, "sent"), opacity: 0.6 }]}>◷</Text>;
  }
  const color = light ? deliveryTickColor(tokens, status) : deliveryTickColor(tokens, status);
  const isDouble = status === "delivered" || status === "read";
  return (
    <View style={styles.wrap} accessibilityLabel={status}>
      <Text style={[styles.tick, { color }]}>✓</Text>
      {isDouble ? <Text style={[styles.tick, styles.second, { color }]}>✓</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", height: 12 },
  tick: { fontSize: 11, fontWeight: "900", lineHeight: 12 },
  second: { marginLeft: -5 },
  failed: { fontSize: 12, fontWeight: "900" }
});
