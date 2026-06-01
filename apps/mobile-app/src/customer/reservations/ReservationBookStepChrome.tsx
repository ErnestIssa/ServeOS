import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RESERVATION_BOOK_STEP_TOTAL } from "./reservationBookSteps";
import { reservationBookStyles } from "./reservationBookStyles";
import { useAppTheme } from "../../theme/AppThemeContext";

type Props = {
  /** 2 … total (step 1 is landing — not shown). */
  step: number;
  total?: number;
  onBack?: () => void;
};

export function ReservationBookStepChrome(props: Props) {
  const { colors: t } = useAppTheme();
  const total = props.total ?? RESERVATION_BOOK_STEP_TOTAL;
  const accent = t.ordersNavPurpleBright;

  return (
    <View style={styles.row}>
      <View style={styles.side}>
        {props.onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              props.onBack?.();
            }}
            hitSlop={10}
          >
            <Text style={[reservationBookStyles.backLink, { color: accent }]}>‹ Back</Text>
          </Pressable>
        ) : null}
      </View>

      <Text
        style={[reservationBookStyles.backLink, styles.stepCenter, { color: accent }]}
        accessibilityRole="text"
        accessibilityLabel={`Step ${props.step} of ${total}`}
        pointerEvents="none"
      >
        {props.step} of {total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 28,
    marginTop: 2,
    marginBottom: 4,
    justifyContent: "center"
  },
  side: {
    minHeight: 28,
    justifyContent: "center",
    alignSelf: "flex-start",
    zIndex: 2
  },
  stepCenter: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    marginTop: 0,
    marginBottom: 0,
    alignSelf: "center"
  }
});
