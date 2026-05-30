import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../theme/AppThemeContext";
import { ADDON_OPTIONS } from "./reservationPresets";
import { ReservationImmersiveStepShell } from "./ReservationImmersiveStepShell";
import { immersiveShellPassThrough, type ReservationImmersiveShellProps } from "./reservationImmersiveShellProps";
import { ReservationStepHeader } from "./ReservationStepHeader";
import {
  ReservationGhostButton,
  ReservationPrimaryButton,
  ReservationSection,
  TapTile
} from "./ReservationUi";
import type { ReservationDraft, ReservationFlowContext } from "./reservationTypes";

type Props = ReservationFlowContext &
  ReservationImmersiveShellProps & {
    draft: ReservationDraft;
    confirmationCode: string;
    addonIds: string[];
    onToggleAddon: (id: string) => void;
    onManage: () => void;
    onOpenChat: () => void;
    onDone: () => void;
  };

export function ReservationConfirmationScreen(props: Props) {
  const { colors: t } = useAppTheme();
  const { draft, confirmationCode } = props;

  return (
    <ReservationImmersiveStepShell
      {...immersiveShellPassThrough(props)}
      footer={
        <>
          <ReservationPrimaryButton variant="purple" label="Done" onPress={props.onDone} />
          <ReservationGhostButton label="Manage booking" onPress={props.onManage} />
          <ReservationGhostButton label="Message the restaurant" onPress={props.onOpenChat} />
        </>
      }
    >
      <ReservationStepHeader stepLabel="Confirmed" title="You're booked" />

      <View
        style={[
          styles.successCard,
          {
            borderColor: `${t.success}66`,
            backgroundColor: `${t.success}18`
          }
        ]}
      >
        <Text style={[styles.successEmoji, { color: t.success }]}>✓</Text>
        <Text style={[styles.code, { color: t.text }]}>{confirmationCode}</Text>
        <Text style={[styles.summary, { color: t.textSecondary }]}>
          {props.restaurantName} · {draft.guests} guests · {draft.dateLabel} ·{" "}
          {draft.timeLabel || draft.slotLabel}
        </Text>
        {draft.tableId ? (
          <Text style={[styles.table, { color: t.ordersNavPurpleBright }]}>{draft.tableId}</Text>
        ) : null}
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
            selected={props.addonIds.includes(a.id)}
            onPress={() => props.onToggleAddon(a.id)}
          />
        ))}
      </ReservationSection>
    </ReservationImmersiveStepShell>
  );
}

const styles = StyleSheet.create({
  successCard: {
    borderRadius: 20,
    borderWidth: 2,
    padding: 16,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 8
  },
  successEmoji: { fontSize: 40, fontWeight: "800" },
  code: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 2,
    marginTop: 8
  },
  summary: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 20
  },
  table: { marginTop: 8, fontSize: 17, fontWeight: "800" }
});
