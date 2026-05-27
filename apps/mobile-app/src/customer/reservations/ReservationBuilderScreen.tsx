import React from "react";
import {
  ACCESSIBILITY_OPTIONS,
  OCCASION_OPTIONS,
  SEATING_OPTIONS
} from "./reservationPresets";
import {
  ReservationPrimaryButton,
  ReservationSection,
  TapPillRow,
  TapTile
} from "./ReservationUi";
import { ReservationScreenShell } from "./ReservationScreenShell";
import type { ReservationDraft } from "./reservationTypes";

type Props = {
  draft: ReservationDraft;
  onChange: (patch: Partial<ReservationDraft>) => void;
  onScroll: ReturnType<typeof import("react-native").Animated.event>;
  scrollTopPad: number;
  scrollBottom: number;
  onBack: () => void;
  onContinue: () => void;
};

export function ReservationBuilderScreen(props: Props) {
  const { draft, onChange } = props;

  return (
    <ReservationScreenShell
      title="Build your visit"
      stepLabel="Step 1 · Preferences"
      onBack={props.onBack}
      onScroll={props.onScroll}
      scrollTopPad={props.scrollTopPad}
      scrollBottom={props.scrollBottom}
      footer={<ReservationPrimaryButton label="Check availability" onPress={props.onContinue} />}
    >
      <ReservationSection title="Seating">
        <TapPillRow
          options={[...SEATING_OPTIONS]}
          selected={draft.seatingPreference}
          onSelect={(seatingPreference) => onChange({ seatingPreference })}
        />
      </ReservationSection>

      <ReservationSection title="Accessibility">
        {ACCESSIBILITY_OPTIONS.map((a) => (
          <TapTile
            key={a.id}
            label={a.label}
            selected={draft.accessibilityNotes === a.label}
            onPress={() => onChange({ accessibilityNotes: a.label })}
          />
        ))}
      </ReservationSection>

      <ReservationSection title="Occasion">
        <TapPillRow
          options={[...OCCASION_OPTIONS]}
          selected={draft.occasion}
          onSelect={(occasion) => onChange({ occasion })}
        />
      </ReservationSection>
    </ReservationScreenShell>
  );
}
