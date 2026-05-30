import React from "react";
import { StyleSheet, View } from "react-native";

/** Keeps booking steps mounted so back navigation does not remount / flash the whole sheet. */
export function ReservationFlowScreenLayer(props: { active: boolean; children: React.ReactNode }) {
  return (
    <View
      style={[styles.layer, !props.active && styles.hidden]}
      pointerEvents={props.active ? "auto" : "none"}
      accessibilityElementsHidden={!props.active}
      importantForAccessibility={props.active ? "auto" : "no-hide-descendants"}
    >
      {props.children}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject
  },
  hidden: {
    opacity: 0
  }
});
