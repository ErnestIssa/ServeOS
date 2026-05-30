import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../theme/AppThemeContext";
import { ReservationImmersiveStepShell } from "./ReservationImmersiveStepShell";
import { immersiveShellPassThrough, type ReservationImmersiveShellProps } from "./reservationImmersiveShellProps";
import { ReservationStepHeader } from "./ReservationStepHeader";
import {
  ReservationGhostButton,
  ReservationPrimaryButton,
  ReservationSection,
  TapTile
} from "./ReservationUi";
import type { ReservationFlowContext } from "./reservationTypes";

type Props = ReservationFlowContext &
  ReservationImmersiveShellProps & {
    confirmationCode: string;
    onModify: () => void;
    onCancel: () => void;
    onCheckIn: () => void;
  };

export function ReservationManagementScreen(props: Props) {
  const { colors: t } = useAppTheme();

  return (
    <ReservationImmersiveStepShell
      {...immersiveShellPassThrough(props)}
      footer={
        <>
          <ReservationPrimaryButton variant="purple" label="Modify booking" onPress={props.onModify} />
          <ReservationGhostButton label="Cancel booking" onPress={props.onCancel} danger />
        </>
      }
    >
      <ReservationStepHeader title="Your booking" subtitle={props.restaurantName} />

      <View style={[styles.card, { borderColor: t.border, backgroundColor: t.bgElevated }]}>
        <Text style={[styles.ref, { color: t.textMuted }]}>{props.confirmationCode}</Text>
        <Text style={[styles.venue, { color: t.text }]}>{props.restaurantName}</Text>
        <View style={[styles.statusPill, { backgroundColor: `${t.ordersNavPurpleBright}22` }]}>
          <Text style={[styles.statusText, { color: t.ordersNavPurpleBright }]}>Confirmed</Text>
        </View>
      </View>

      <ReservationSection title="Check-in">
        <TapTile label="I'm here" sublabel="Notify the host desk" onPress={props.onCheckIn} />
        <TapTile label="Scan door QR" sublabel="Opens 15 min before" onPress={props.onCheckIn} accent="muted" />
      </ReservationSection>

      <ReservationSection title="Queue">
        <TapTile label="Not in queue yet" sublabel="Tap when you arrive" accent="muted" onPress={() => {}} />
      </ReservationSection>
    </ReservationImmersiveStepShell>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 2,
    padding: 16,
    marginTop: 4,
    marginBottom: 8
  },
  ref: { fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  venue: { fontSize: 24, fontWeight: "900", marginTop: 6 },
  statusPill: {
    alignSelf: "flex-start",
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999
  },
  statusText: { fontSize: 13, fontWeight: "800" }
});
