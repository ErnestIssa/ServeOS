import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";
import type { MessageDeliveryStatus } from "./chatUi";
import { colors } from "./theme";

type Props = {
  status: MessageDeliveryStatus;
  readColor?: string;
  onGreen?: boolean;
};

export function MessageStatusTicks({ status, readColor = "#53BDEB", onGreen = true }: Props) {
  if (status === "sending") {
    return (
      <View style={styles.wrap}>
        <Ionicons name="time-outline" size={13} color={onGreen ? "#667781" : colors.textMuted} />
      </View>
    );
  }

  if (status === "failed") {
    return (
      <View style={styles.wrap}>
        <Ionicons name="alert-circle" size={13} color={colors.danger} />
      </View>
    );
  }

  const gray = onGreen ? "#667781" : colors.textMuted;
  const double = status === "delivered" || status === "read";
  const blue = status === "read";

  return (
    <View style={styles.wrap}>
      <Ionicons name="checkmark" size={13} color={blue ? readColor : gray} style={styles.first} />
      {double ? (
        <Ionicons name="checkmark" size={13} color={blue ? readColor : gray} style={styles.second} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", marginLeft: 3, minWidth: 16 },
  first: { marginRight: -7 },
  second: {}
});
