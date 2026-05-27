import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { R } from "../../theme";
import { ADDON_OPTIONS } from "./reservationPresets";
import {
  ReservationGhostButton,
  ReservationPrimaryButton,
  ReservationSection,
  TapTile
} from "./ReservationUi";
import { ReservationScreenShell } from "./ReservationScreenShell";
import type { ReservationDraft, ReservationFlowContext } from "./reservationTypes";

type Props = ReservationFlowContext & {
  draft: ReservationDraft;
  confirmationCode: string;
  onScroll: ReturnType<typeof import("react-native").Animated.event>;
  scrollTopPad: number;
  scrollBottom: number;
  onManage: () => void;
  onOpenChat: () => void;
  onDone: () => void;
};

export function ReservationConfirmationScreen(props: Props) {
  const { draft, confirmationCode } = props;
  const [addons, setAddons] = React.useState<Set<string>>(new Set());

  const toggleAddon = (id: string) => {
    setAddons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <ReservationScreenShell
      title="You're booked"
      stepLabel="Confirmed"
      onScroll={props.onScroll}
      scrollTopPad={props.scrollTopPad}
      scrollBottom={props.scrollBottom}
      footer={
        <>
          <ReservationPrimaryButton label="View booking" onPress={props.onManage} />
          <ReservationGhostButton label="Message restaurant" onPress={props.onOpenChat} />
          <ReservationGhostButton label="Done" onPress={props.onDone} />
        </>
      }
    >
      <View style={styles.successCard}>
        <Text style={styles.successEmoji}>✓</Text>
        <Text style={styles.code}>{confirmationCode}</Text>
        <Text style={styles.summary}>
          {props.restaurantName} · {draft.guests} guests · {draft.dateLabel} · {draft.timeLabel || draft.slotLabel}
        </Text>
        {draft.tableId ? <Text style={styles.table}>{draft.tableId}</Text> : null}
      </View>

      <ReservationSection title="While you wait">
        <TapTile label="Remind me before" sublabel="1 hour & 15 min" onPress={() => {}} />
        <TapTile label="Running late" sublabel="Notify the host" onPress={() => {}} />
        <TapTile label="Add to calendar" sublabel="Apple / Google" onPress={() => {}} />
      </ReservationSection>

      <ReservationSection title="Add-ons">
        {ADDON_OPTIONS.map((a) => (
          <TapTile
            key={a.id}
            label={a.label}
            selected={addons.has(a.id)}
            onPress={() => toggleAddon(a.id)}
          />
        ))}
      </ReservationSection>
    </ReservationScreenShell>
  );
}

const styles = StyleSheet.create({
  successCard: {
    borderRadius: R.radius.card,
    borderWidth: 2,
    borderColor: "rgba(16, 185, 129, 0.4)",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    padding: R.space.sm,
    alignItems: "center",
    marginTop: 4
  },
  successEmoji: { fontSize: 40, fontWeight: "800", color: R.success },
  code: {
    fontSize: 28,
    fontWeight: "900",
    color: R.text,
    letterSpacing: 2,
    marginTop: 8
  },
  summary: {
    marginTop: 10,
    fontSize: R.type.label,
    fontWeight: "600",
    color: R.textSecondary,
    textAlign: "center",
    lineHeight: 20
  },
  table: { marginTop: 8, fontSize: 17, fontWeight: "800", color: R.accentBlue }
});
