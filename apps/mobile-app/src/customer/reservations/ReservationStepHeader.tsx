import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../theme/AppThemeContext";

type Props = {
  stepLabel?: string;
  title: string;
  subtitle?: string;
};

export function ReservationStepHeader(props: Props) {
  const { colors: t } = useAppTheme();

  return (
    <View style={styles.wrap}>
      {props.stepLabel ? (
        <Text style={[styles.stepLabel, { color: t.ordersNavPurpleBright }]}>{props.stepLabel}</Text>
      ) : null}
      <Text style={[styles.title, { color: t.text }]}>{props.title}</Text>
      {props.subtitle ? (
        <Text style={[styles.subtitle, { color: t.textSecondary }]}>{props.subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 6,
    marginBottom: 14
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.35,
    textTransform: "uppercase",
    marginBottom: 8
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.4
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20
  }
});
