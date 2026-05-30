import React from "react";
import { ReservationImmersiveStepShell } from "./ReservationImmersiveStepShell";
import { immersiveShellPassThrough, type ReservationImmersiveShellProps } from "./reservationImmersiveShellProps";
import { ReservationStepHeader } from "./ReservationStepHeader";
import { ReservationPrimaryButton, ReservationSection, TapTile, TapToggleCard } from "./ReservationUi";
import type { ReservationDraft, ReservationFlowContext } from "./reservationTypes";

type Props = ReservationFlowContext &
  ReservationImmersiveShellProps & {
    draft: ReservationDraft;
    onChange: (patch: Partial<ReservationDraft>) => void;
    onConfirm: () => void;
  };

export function ReservationGuestCheckoutScreen(props: Props) {
  const { draft, onChange } = props;
  const displayName = props.userDisplayName.trim() || "Guest";

  return (
    <ReservationImmersiveStepShell
      {...immersiveShellPassThrough(props)}
      footer={
        <ReservationPrimaryButton variant="purple" label="Confirm booking" onPress={props.onConfirm} />
      }
    >
      <ReservationStepHeader stepLabel="Step 3 · Confirm you" title="Almost done" />

      <ReservationSection title="Your details">
        <TapTile
          label="Use my profile"
          sublabel={displayName}
          selected={draft.checkoutUseProfile}
          accent="success"
          onPress={() => onChange({ checkoutUseProfile: true })}
        />
        <TapTile
          label="Different guest"
          sublabel="Coming soon — use profile for now"
          selected={!draft.checkoutUseProfile}
          accent="muted"
          onPress={() => onChange({ checkoutUseProfile: false })}
        />
      </ReservationSection>

      <ReservationSection title="Deposit">
        <TapToggleCard
          label="Pay deposit now"
          sublabel="Optional hold for peak times"
          on={draft.checkoutDeposit}
          onPress={() => onChange({ checkoutDeposit: !draft.checkoutDeposit })}
        />
      </ReservationSection>

      <ReservationSection title="How should we reach you?">
        <TapToggleCard
          label="SMS reminders"
          on={draft.checkoutSms}
          onPress={() => onChange({ checkoutSms: !draft.checkoutSms })}
        />
        <TapToggleCard
          label="Email updates"
          on={draft.checkoutEmail}
          onPress={() => onChange({ checkoutEmail: !draft.checkoutEmail })}
        />
      </ReservationSection>
    </ReservationImmersiveStepShell>
  );
}
