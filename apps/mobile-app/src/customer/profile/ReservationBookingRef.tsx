import React from "react";
import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from "react-native";

type Props = {
  confirmationCode: string;
  labelColor?: string;
  codeColor?: string;
  style?: ViewStyle;
  codeStyle?: TextStyle;
};

/** Booking reference shown under countdown / on detail cards. */
export function ReservationBookingRef(props: Props) {
  return (
    <View style={[styles.wrap, props.style]} accessibilityLabel={`Booking number ${props.confirmationCode}`}>
      <Text style={[styles.label, props.labelColor != null && { color: props.labelColor }]}>Booking#</Text>
      <Text style={[styles.code, props.codeColor != null && { color: props.codeColor }, props.codeStyle]}>
        {props.confirmationCode}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    marginTop: 20
  },
  label: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#64748B",
    marginBottom: 4
  },
  code: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1.2
  }
});
