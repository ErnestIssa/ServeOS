import React from "react";
import {
  ACCESSIBILITY_OPTIONS,
  OCCASION_OPTIONS,
  SEATING_OPTIONS
} from "./reservationPresets";
import { ReservationImmersiveStepShell } from "./ReservationImmersiveStepShell";
import { immersiveShellPassThrough, type ReservationImmersiveShellProps } from "./reservationImmersiveShellProps";
import { ReservationStepHeader } from "./ReservationStepHeader";
import {
  ReservationPrimaryButton,
  ReservationSection,
  TapPillRow,
  TapTile
} from "./ReservationUi";
import type { ReservationDraft } from "./reservationTypes";

type Props = ReservationImmersiveShellProps & {
  draft: ReservationDraft;
  onChange: (patch: Partial<ReservationDraft>) => void;
  onContinue: () => void;
};

export function ReservationBuilderScreen(props: Props) {
  const { draft, onChange } = props;

  return (
    <ReservationImmersiveStepShell
      {...immersiveShellPassThrough(props)}
      footer={
        <ReservationPrimaryButton variant="purple" label="Check availability" onPress={props.onContinue} />
      }
    >
      <ReservationStepHeader
        stepLabel="Step 1 · Preferences"
        title="Build your visit"
        subtitle={`${draft.guests} guests · ${draft.dateLabel} · ${draft.timeLabel}`}
      />

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
    </ReservationImmersiveStepShell>
  );
}
