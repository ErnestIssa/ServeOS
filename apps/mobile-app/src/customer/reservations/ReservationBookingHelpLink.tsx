import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { ProfileReviewInfoIcon } from "../profile/profileMenuChipIcons";
import { useAppTheme } from "../../theme/AppThemeContext";

type Props = {
  onPress: () => void;
};

/** Matches ProfileReviewScreen top info control (dark circle + white icon). */
export function ReservationBookingHelpLink(props: Props) {
  const { colors: t } = useAppTheme();

  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        props.onPress();
      }}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel="Need help with booking"
    >
      <View style={styles.iconBtn}>
        <ProfileReviewInfoIcon size={26} color="#FFFFFF" />
      </View>
      <Text style={[styles.label, { color: t.text }]}>Need help with booking</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 28,
    alignSelf: "center"
  },
  rowPressed: {
    opacity: 0.82
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.22)",
    borderRadius: 22,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4
      },
      android: { elevation: 2 },
      default: {}
    })
  },
  label: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2
  }
});
