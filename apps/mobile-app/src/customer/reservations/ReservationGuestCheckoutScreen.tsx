import React from "react";
import {
  ReservationPrimaryButton,
  ReservationSection,
  TapTile,
  TapToggleCard
} from "./ReservationUi";
import { ReservationScreenShell } from "./ReservationScreenShell";
import type { ReservationFlowContext } from "./reservationTypes";

type Props = ReservationFlowContext & {
  onScroll: ReturnType<typeof import("react-native").Animated.event>;
  scrollTopPad: number;
  scrollBottom: number;
  onBack: () => void;
  onConfirm: () => void;
};

export function ReservationGuestCheckoutScreen(props: Props) {
  const [useProfile, setUseProfile] = React.useState(true);
  const [deposit, setDeposit] = React.useState(false);
  const [sms, setSms] = React.useState(true);
  const [emailPref, setEmailPref] = React.useState(true);

  const displayName = props.userDisplayName.trim() || "Guest";

  return (
    <ReservationScreenShell
      title="Almost done"
      stepLabel="Step 3 · Confirm you"
      onBack={props.onBack}
      onScroll={props.onScroll}
      scrollTopPad={props.scrollTopPad}
      scrollBottom={props.scrollBottom}
      footer={
        <ReservationPrimaryButton
          label="Confirm reservation"
          onPress={props.onConfirm}
          disabled={!useProfile}
        />
      }
    >
      <ReservationSection title="Your details">
        <TapTile
          label={`Use my profile`}
          sublabel={displayName}
          selected={useProfile}
          accent="success"
          onPress={() => setUseProfile(true)}
        />
        <TapTile
          label="Different guest"
          sublabel="Coming soon — use profile for now"
          selected={!useProfile}
          accent="muted"
          onPress={() => setUseProfile(false)}
        />
      </ReservationSection>

      <ReservationSection title="Deposit">
        <TapToggleCard
          label="Pay deposit now"
          sublabel="Optional hold for peak times"
          on={deposit}
          onPress={() => setDeposit((v) => !v)}
        />
      </ReservationSection>

      <ReservationSection title="How should we reach you?">
        <TapToggleCard label="SMS reminders" on={sms} onPress={() => setSms((v) => !v)} />
        <TapToggleCard label="Email updates" on={emailPref} onPress={() => setEmailPref((v) => !v)} />
      </ReservationSection>
    </ReservationScreenShell>
  );
}
