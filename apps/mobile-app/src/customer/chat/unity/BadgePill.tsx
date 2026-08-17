import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors, radius } from "./theme";

type Props = {
  count: number;
  style?: ViewStyle;
  compact?: boolean;
};

export function BadgePill({ count, style, compact }: Props) {
  if (count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);

  return (
    <View style={[styles.badge, compact && styles.badgeCompact, style]}>
      <Text style={[styles.text, compact && styles.textCompact]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: radius.full,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    borderWidth: 1.5,
    borderColor: colors.white
  },
  badgeCompact: {
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4
  },
  text: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "800"
  },
  textCompact: {
    fontSize: 9
  }
});
