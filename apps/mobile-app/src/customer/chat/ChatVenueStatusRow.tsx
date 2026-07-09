import React from "react";
import { StyleSheet, Text } from "react-native";
import { useChatTheme } from "./useChatTheme";

type Props = {
  restaurantOnline: boolean;
};

/** Staff presence under the venue name — Online / Offline only. */
export function ChatVenueStatusRow({ restaurantOnline }: Props) {
  const { colors: t } = useChatTheme();
  return (
    <Text
      style={[styles.label, { color: restaurantOnline ? t.success : t.textMuted }]}
      numberOfLines={1}
    >
      {restaurantOnline ? "Online" : "Offline"}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
    marginTop: 1,
    textAlign: "center"
  }
});
