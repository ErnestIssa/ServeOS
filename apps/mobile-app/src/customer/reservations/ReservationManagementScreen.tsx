import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { R } from "../../theme";
import {
  ReservationGhostButton,
  ReservationPrimaryButton,
  ReservationSection,
  TapTile
} from "./ReservationUi";
import { ReservationScreenShell } from "./ReservationScreenShell";
import type { ReservationFlowContext } from "./reservationTypes";

type Props = ReservationFlowContext & {
  confirmationCode: string;
  onScroll: ReturnType<typeof import("react-native").Animated.event>;
  scrollTopPad: number;
  scrollBottom: number;
  onBack: () => void;
  onModify: () => void;
  onCancel: () => void;
  onCheckIn: () => void;
};

const DEMO_BOOKING = {
  when: "Fri · 19:30",
  party: "4 guests",
  table: "Table 8 · Booth",
  status: "Confirmed"
} as const;

export function ReservationManagementScreen(props: Props) {
  return (
    <ReservationScreenShell
      title="Your booking"
      onBack={props.onBack}
      onScroll={props.onScroll}
      scrollTopPad={props.scrollTopPad}
      scrollBottom={props.scrollBottom}
      footer={
        <>
          <ReservationPrimaryButton label="Change reservation" onPress={props.onModify} />
          <ReservationGhostButton label="Check in" onPress={props.onCheckIn} />
          <ReservationGhostButton label="Cancel booking" onPress={props.onCancel} danger />
        </>
      }
    >
      <View style={styles.card}>
        <Text style={styles.ref}>{props.confirmationCode}</Text>
        <Text style={styles.venue}>{props.restaurantName}</Text>
        <Text style={styles.line}>{DEMO_BOOKING.when}</Text>
        <Text style={styles.line}>{DEMO_BOOKING.party}</Text>
        <Text style={styles.line}>{DEMO_BOOKING.table}</Text>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{DEMO_BOOKING.status}</Text>
        </View>
      </View>

      <ReservationSection title="Check-in">
        <TapTile label="I'm here" sublabel="Notify the host desk" onPress={props.onCheckIn} />
        <TapTile label="Scan door QR" sublabel="Opens 15 min before" onPress={props.onCheckIn} accent="muted" />
      </ReservationSection>

      <ReservationSection title="Queue">
        <TapTile label="Not in queue yet" sublabel="Tap when you arrive" accent="muted" onPress={() => {}} />
      </ReservationSection>
    </ReservationScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: R.radius.card,
    borderWidth: 2,
    borderColor: R.border,
    backgroundColor: R.bg,
    padding: R.space.sm,
    marginTop: 4
  },
  ref: { fontSize: 12, fontWeight: "800", color: R.textMuted, letterSpacing: 1 },
  venue: { fontSize: 24, fontWeight: "900", color: R.text, marginTop: 6 },
  line: { marginTop: 6, fontSize: 17, fontWeight: "600", color: R.textSecondary },
  statusPill: {
    alignSelf: "flex-start",
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: R.radius.pill,
    backgroundColor: "rgba(59, 130, 246, 0.12)"
  },
  statusText: { fontSize: R.type.label, fontWeight: "800", color: R.accentBlue }
});
